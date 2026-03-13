import { spawn, ChildProcess } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { CompanionClient } from './client.js';
import { rewriteXctestrun } from './xctestrun.js';
import { getLogger } from '../logger.js';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREBUILT_DIR = join(PKG_ROOT, 'ios-companion', 'prebuilt');
const SOURCE_DIR = join(PKG_ROOT, 'ios-companion');

const POLL_INTERVAL_MS = 500;
const PREBUILT_LAUNCH_TIMEOUT_MS = 30_000;
const SOURCE_LAUNCH_TIMEOUT_MS = 120_000;

interface BuildInfo {
  xcodeVersion?: string;
  xcodeMajor?: number;
  buildDate?: string;
  sourceHash?: string;
}

export interface LaunchStrategy {
  type: 'prebuilt' | 'source' | 'error';
  prebuiltDir?: string;
  sourceDir?: string;
  reason?: string;
}

interface StrategyInput {
  prebuiltDir: string;
  prebuiltExists: boolean;
  buildInfoXcodeMajor: number | null;
  localXcodeMajor: number | null;
  sourceDir: string;
  sourceExists: boolean;
}

export function resolveLaunchStrategy(input: StrategyInput): LaunchStrategy {
  if (input.localXcodeMajor === null && !input.prebuiltExists) {
    return { type: 'error', reason: 'Xcode is required for iOS simulator support' };
  }

  if (!input.prebuiltExists) {
    return { type: 'source', sourceDir: input.sourceDir, reason: 'prebuilt not found' };
  }

  if (input.buildInfoXcodeMajor === null) {
    return { type: 'source', sourceDir: input.sourceDir, reason: 'build-info.json missing or invalid' };
  }

  if (input.localXcodeMajor !== null && input.buildInfoXcodeMajor !== input.localXcodeMajor) {
    return {
      type: 'source',
      sourceDir: input.sourceDir,
      reason: `Xcode major version mismatch: prebuilt=${input.buildInfoXcodeMajor}, local=${input.localXcodeMajor}`,
    };
  }

  return { type: 'prebuilt', prebuiltDir: input.prebuiltDir };
}

function readBuildInfo(prebuiltDir: string): BuildInfo | null {
  try {
    const raw = readFileSync(join(prebuiltDir, 'build-info.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getLocalXcodeMajor(): Promise<number | null> {
  try {
    const { execSync } = await import('node:child_process');
    const output = execSync('xcodebuild -version', { encoding: 'utf-8', timeout: 5000 });
    const match = output.match(/Xcode\s+(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

export class CompanionLauncher {
  private processes = new Map<string, ChildProcess>();
  private clients = new Map<string, CompanionClient>();
  private portIndex = 0;
  private basePort: number;

  constructor(basePort = 8300) {
    this.basePort = basePort;

    const cleanup = () => this.stop();
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  async ensureRunning(deviceId: string, bundleId?: string): Promise<CompanionClient> {
    const existing = this.clients.get(deviceId);
    if (existing) {
      try {
        await existing.status();
        return existing;
      } catch {
        this.clients.delete(deviceId);
        this.killProcess(deviceId);
      }
    }

    const port = this.getPort(deviceId);
    const client = new CompanionClient(port);

    try {
      await client.status();
      this.clients.set(deviceId, client);
      return client;
    } catch {
      // Not running yet, launch it
    }

    const logger = getLogger();

    const buildInfo = readBuildInfo(PREBUILT_DIR);
    const localXcodeMajor = await getLocalXcodeMajor();

    const strategy = resolveLaunchStrategy({
      prebuiltDir: PREBUILT_DIR,
      prebuiltExists: existsSync(join(PREBUILT_DIR, 'DriftxCompanionUITests.xctestrun')),
      buildInfoXcodeMajor: buildInfo?.xcodeMajor ?? null,
      localXcodeMajor,
      sourceDir: SOURCE_DIR,
      sourceExists: existsSync(join(SOURCE_DIR, 'DriftxCompanion.xcodeproj')),
    });

    logger.debug(`Companion launch strategy: ${strategy.type}${strategy.reason ? ` (${strategy.reason})` : ''}`);

    if (strategy.type === 'error') {
      throw new Error(strategy.reason ?? 'Cannot launch iOS companion');
    }

    let launched = false;

    if (strategy.type === 'prebuilt') {
      try {
        this.launchPrebuilt(deviceId, port);
        await this.waitForReadyWithEarlyExit(deviceId, client, PREBUILT_LAUNCH_TIMEOUT_MS);
        launched = true;
      } catch (err) {
        logger.debug(`Pre-built launch failed, falling back to source: ${err}`);
        this.killProcess(deviceId);
      }
    }

    if (!launched) {
      logger.debug(`Launching companion from source for device ${deviceId} on port ${port}`);
      this.launchSource(deviceId, port);
      await this.waitForReadyWithEarlyExit(deviceId, client, SOURCE_LAUNCH_TIMEOUT_MS);
    }

    if (bundleId) {
      logger.debug(`Configuring companion for bundle ${bundleId}`);
      await client.configure(bundleId);
    }

    this.clients.set(deviceId, client);
    return client;
  }

  stop(deviceId?: string): void {
    if (deviceId) {
      this.killProcess(deviceId);
      this.clients.delete(deviceId);
      return;
    }

    for (const id of this.processes.keys()) {
      this.killProcess(id);
    }
    this.clients.clear();
  }

  private getPort(deviceId: string): number {
    const existing = [...this.processes.keys()].indexOf(deviceId);
    if (existing >= 0) return this.basePort + existing;
    return this.basePort + this.portIndex++;
  }

  private launchPrebuilt(deviceId: string, port: number): void {
    const xctestrunPath = join(PREBUILT_DIR, 'DriftxCompanionUITests.xctestrun');
    const original = readFileSync(xctestrunPath, 'utf-8');
    const rewritten = rewriteXctestrun(original, PREBUILT_DIR, port);

    const tmpXctestrun = join(tmpdir(), `driftx-companion-${deviceId}-${port}.xctestrun`);
    writeFileSync(tmpXctestrun, rewritten);

    const proc = spawn('xcodebuild', [
      'test-without-building',
      '-xctestrun', tmpXctestrun,
      '-destination', `platform=iOS Simulator,id=${deviceId}`,
      '-only-testing:DriftxCompanionUITests/DriftxCompanionUITests/testCompanionServer',
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logger = getLogger();

    proc.stdout?.on('data', (data: Buffer) => {
      logger.debug(`[companion:${deviceId}] ${data.toString().trimEnd()}`);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      logger.debug(`[companion:${deviceId}] ${data.toString().trimEnd()}`);
    });

    proc.on('exit', (code) => {
      logger.debug(`Companion (prebuilt) for ${deviceId} exited with code ${code}`);
      this.processes.delete(deviceId);
    });

    this.processes.set(deviceId, proc);
  }

  private launchSource(deviceId: string, port: number): void {
    const env: Record<string, string> = { ...process.env as Record<string, string>, DRIFTX_PORT: String(port) };

    const proc = spawn('xcodebuild', [
      'test',
      '-project', resolve(SOURCE_DIR, 'DriftxCompanion.xcodeproj'),
      '-scheme', 'DriftxCompanionUITests',
      '-destination', `platform=iOS Simulator,id=${deviceId}`,
      '-only-testing:DriftxCompanionUITests/DriftxCompanionUITests/testCompanionServer',
    ], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logger = getLogger();

    proc.stdout?.on('data', (data: Buffer) => {
      logger.debug(`[companion:${deviceId}] ${data.toString().trimEnd()}`);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      logger.debug(`[companion:${deviceId}] ${data.toString().trimEnd()}`);
    });

    proc.on('exit', (code) => {
      logger.debug(`Companion (source) for ${deviceId} exited with code ${code}`);
      this.processes.delete(deviceId);
    });

    this.processes.set(deviceId, proc);
  }

  private async waitForReadyWithEarlyExit(deviceId: string, client: CompanionClient, timeoutMs: number): Promise<void> {
    const proc = this.processes.get(deviceId);
    let earlyExitCode: number | null = null;

    const exitListener = (code: number | null) => { earlyExitCode = code; };
    proc?.on('exit', exitListener);

    const deadline = Date.now() + timeoutMs;
    try {
      while (Date.now() < deadline) {
        if (earlyExitCode !== null) {
          throw new Error(`xcodebuild exited early with code ${earlyExitCode}`);
        }
        try {
          await client.status();
          return;
        } catch {
          await this.sleep(POLL_INTERVAL_MS);
        }
      }
      throw new Error(`Companion server did not become ready within ${timeoutMs}ms`);
    } finally {
      proc?.removeListener('exit', exitListener);
    }
  }

  private killProcess(deviceId: string): void {
    const proc = this.processes.get(deviceId);
    if (proc) {
      try { proc.kill('SIGTERM'); } catch {}
      this.processes.delete(deviceId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
