import { Command } from 'commander';
import { createRequire } from 'module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { RealShell } from './shell.js';
import { loadConfig } from './config.js';
import { createLogger, setLogger, getLogger } from './logger.js';
import { checkPrerequisites } from './prerequisites.js';
import { computeDoctorExitCode } from './commands/doctor.js';
import { detectFramework, generateConfig } from './commands/init.js';
import { DeviceDiscovery } from './devices/discovery.js';
import { runCapture } from './commands/capture.js';
import { runCompare } from './commands/compare.js';
import { TreeInspector } from './inspect/tree-inspector.js';
import { pickDevice } from './commands/device-picker.js';
import { formatOutput } from './formatters/format.js';
import { devicesFormatter } from './formatters/devices.js';
import { doctorFormatter } from './formatters/doctor.js';
import { inspectFormatter } from './formatters/inspect.js';
import { compareFormatter } from './formatters/compare.js';
import type { FormatterContext } from './formatters/types.js';
import { createBackend } from './interact/backend.js';
import { GestureExecutor } from './interact/gestures.js';
import { CompanionLauncher } from './ios-companion/launcher.js';
import { parseCompanionHierarchy } from './ios-companion/hierarchy-parser.js';
import { measureElementByText, detectBundleId } from './inspect/cdp-client.js';
import { checkForUpdate } from './update-notifier.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

function getFormatterContext(opts: Record<string, unknown>): FormatterContext {
  return {
    format: (opts.format as FormatterContext['format']) ?? 'terminal',
    copy: !!opts.copy,
    quiet: !!opts.quiet,
  };
}

export function createProgram(): Command {
  let companionLauncher: CompanionLauncher | undefined;
  let resolvedBundleId: string | undefined;

  function getCompanionLauncher(port: number): CompanionLauncher {
    if (!companionLauncher) {
      companionLauncher = new CompanionLauncher(port);
    }
    return companionLauncher;

  }

  async function getBundleId(program: Command, metroPort: number, deviceName?: string): Promise<string | undefined> {
    const explicit = program.opts().bundleId as string | undefined;
    if (explicit) return explicit;
    if (resolvedBundleId) return resolvedBundleId;
    const detected = await detectBundleId(metroPort, deviceName);
    if (detected) {
      resolvedBundleId = detected;
      getLogger().debug(`Auto-detected bundle ID: ${detected}`);
    }
    return resolvedBundleId;
  }

  const program = new Command();
  program
    .name('driftx')
    .description('Visual diff tool for React Native and Android development')
    .version(pkg.version)
    .option('--verbose', 'enable debug logging')
    .option('--quiet', 'suppress all output except errors')
    .option('--format <type>', 'output format: terminal, markdown, json', 'terminal')
    .option('--copy', 'copy output to clipboard')
    .option('--bundle-id <id>', 'iOS app bundle identifier for companion');

  program.hook('preAction', (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    const level = opts.verbose ? 'debug' : opts.quiet ? 'silent' : 'info';
    setLogger(createLogger(level));
  });

  program
    .command('doctor')
    .description('Check system prerequisites for driftx')
    .action(async function(this: Command) {
      const shell = new RealShell();
      const config = await loadConfig();
      const checks = await checkPrerequisites(shell, config.metroPort);
      const ctx = getFormatterContext(this.optsWithGlobals());
      await formatOutput(doctorFormatter, checks, ctx);
      process.exitCode = computeDoctorExitCode(checks);
    });

  program
    .command('init')
    .description('Initialize driftx configuration for this project')
    .action(async () => {
      const cwd = process.cwd();
      const files = readdirSync(cwd);
      let packageJson: Record<string, unknown> | undefined;
      try {
        packageJson = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'));
      } catch {
        // no package.json
      }
      const framework = detectFramework(files, packageJson);
      const config = generateConfig(framework);
      const configPath = join(cwd, '.driftxrc.json');
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      console.log(`Created ${configPath} (framework: ${framework})`);
    });

  program
    .command('devices')
    .description('List connected devices and simulators')
    .action(async function(this: Command) {
      const shell = new RealShell();
      const discovery = new DeviceDiscovery(shell);
      const devices = await discovery.list();
      const ctx = getFormatterContext(this.optsWithGlobals());
      await formatOutput(devicesFormatter, devices, ctx);
    });

  program
    .command('capture')
    .description('Capture a screenshot from a device')
    .option('-d, --device <id>', 'device ID or name')
    .option('-o, --output <path>', 'output file path')
    .option('--settle', 'enable settle-time check')
    .option('--no-settle', 'disable settle-time check')
    .action(async (opts) => {
      const shell = new RealShell();
      const config = await loadConfig();
      const result = await runCapture(shell, config, {
        device: opts.device,
        output: opts.output,
        settleCheck: opts.settle,
      });
      console.log(`Screenshot saved: ${result.path}`);
      if (result.runId) {
        console.log(`Run ID: ${result.runId}`);
      }
    });

  program
    .command('compare')
    .description('Compare a screenshot against a design')
    .option('--design <path>', 'path to design image')
    .option('-d, --device <id>', 'device ID or name')
    .option('--threshold <n>', 'diff percentage threshold', parseFloat)
    .option('--screenshot <path>', 'use existing screenshot instead of capturing')
    .option('--with <analyses>', 'comma-separated analyses to run')
    .option('--without <analyses>', 'exclude specific analyses')
    .option('--baseline', 'compare against previous run screenshot')
    .action(async function(this: Command, opts: Record<string, unknown>) {
      if (!opts.design && !opts.baseline) {
        throw new Error('Either --design or --baseline must be provided');
      }
      const shell = new RealShell();
      const config = await loadConfig();
      const { exitCode, formatData } = await runCompare(shell, config, {
        design: opts.design as string | undefined,
        device: opts.device as string | undefined,
        threshold: opts.threshold as number | undefined,
        screenshot: opts.screenshot as string | undefined,
        with: opts.with as string | undefined,
        without: opts.without as string | undefined,
        baseline: !!opts.baseline,
      });
      const ctx = getFormatterContext(this.optsWithGlobals());
      await formatOutput(compareFormatter, formatData, ctx);
      process.exitCode = exitCode;
    });

  program
    .command('inspect')
    .description('Inspect component tree on device')
    .option('-d, --device <id>', 'device ID or name')
    .option('--json', 'output as JSON (alias for --format json)')
    .option('--capabilities', 'show inspection capabilities only')
    .action(async function(this: Command, opts: Record<string, unknown>) {
      const shell = new RealShell();
      const config = await loadConfig();
      const discovery = new DeviceDiscovery(shell);
      const devices = await discovery.list();
      const booted = devices.filter((d) => d.state === 'booted');
      if (booted.length === 0) throw new Error('No booted devices found');

      let device;
      if (opts.device) {
        device = booted.find((d) => d.id === opts.device || d.name === opts.device);
        if (!device) throw new Error(`Device not found: ${opts.device}`);
      } else {
        device = await pickDevice(booted);
      }

      const launcher = device.platform === 'ios' ? getCompanionLauncher(config.companionPort) : undefined;
      const inspector = new TreeInspector(shell, process.cwd(), launcher);
      const globalOpts = this.optsWithGlobals();
      const result = await inspector.inspect(device, {
        metroPort: config.metroPort,
        devToolsPort: config.devToolsPort,
        timeoutMs: config.timeouts.treeInspectionMs,
        bundleId: await getBundleId(program, config.metroPort, device.name),
      });

      if (opts.json) globalOpts.format = 'json';
      const ctx = getFormatterContext(globalOpts);
      await formatOutput(inspectFormatter, result, ctx);
    });

  program
    .command('tap <target>')
    .description('Tap a component by testID, name, or text')
    .option('-d, --device <id>', 'device ID or name')
    .option('--xy', 'treat target as x,y coordinates')
    .action(async (target: string, opts: Record<string, unknown>) => {
      const shell = new RealShell();
      const config = await loadConfig();
      const discovery = new DeviceDiscovery(shell);
      const devices = await discovery.list();
      const booted = devices.filter((d) => d.state === 'booted');
      if (booted.length === 0) throw new Error('No booted devices found');
      let device;
      if (opts.device) {
        device = booted.find((d) => d.id === opts.device || d.name === opts.device);
        if (!device) throw new Error(`Device not found: ${opts.device}`);
      } else {
        device = await pickDevice(booted);
      }

      const launcher = device.platform === 'ios' ? getCompanionLauncher(config.companionPort) : undefined;
      const companion = launcher ? await launcher.ensureRunning(device.id, await getBundleId(program, config.metroPort, device.name)) : undefined;
      const backend = createBackend(shell, device.platform, companion);
      const executor = new GestureExecutor(backend);

      let result;
      if (opts.xy) {
        const [x, y] = target.split(',').map(Number);
        result = await executor.tapXY(device, x, y);
      } else {
        const inspector = new TreeInspector(shell, process.cwd(), launcher);
        const inspectResult = await inspector.inspect(device, {
          metroPort: config.metroPort,
          devToolsPort: config.devToolsPort,
          timeoutMs: config.timeouts.treeInspectionMs,
          bundleId: await getBundleId(program, config.metroPort, device.name),
        });
        result = await executor.tap(device, inspectResult.tree, target);

        if (!result.success && result.error?.includes('Target not found') && companion) {
          const rawNodes = await companion.hierarchy();
          const companionTree = parseCompanionHierarchy(rawNodes);
          result = await executor.tap(device, companionTree, target);
        }

        if (!result.success && result.error?.includes('Target not found') && companion) {
          const frame = await companion.find(target);
          if (frame) {
            const cx = Math.round(frame.x + frame.width / 2);
            const cy = Math.round(frame.y + frame.height / 2);
            result = await executor.tapXY(device, cx, cy);
            result.target = { x: cx, y: cy, resolvedFrom: `xcuitest-find:${target}` };
          }
        }

        if (!result.success && result.error?.includes('Target not found')) {
          const bounds = await measureElementByText(config.metroPort, target, device.name);
          if (bounds) {
            const cx = Math.round(bounds.x + bounds.width / 2);
            const cy = Math.round(bounds.y + bounds.height / 2);
            result = await executor.tapXY(device, cx, cy);
            result.target = { x: cx, y: cy, resolvedFrom: `cdp-measure:${target}` };
          }
        }
      }
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('type <target> <text>')
    .description('Tap a component then type text into it')
    .option('-d, --device <id>', 'device ID or name')
    .action(async (target: string, text: string, opts: Record<string, unknown>) => {
      const shell = new RealShell();
      const config = await loadConfig();
      const discovery = new DeviceDiscovery(shell);
      const devices = await discovery.list();
      const booted = devices.filter((d) => d.state === 'booted');
      if (booted.length === 0) throw new Error('No booted devices found');
      let device;
      if (opts.device) {
        device = booted.find((d) => d.id === opts.device || d.name === opts.device);
        if (!device) throw new Error(`Device not found: ${opts.device}`);
      } else {
        device = await pickDevice(booted);
      }

      const launcher = device.platform === 'ios' ? getCompanionLauncher(config.companionPort) : undefined;
      const companion = launcher ? await launcher.ensureRunning(device.id, await getBundleId(program, config.metroPort, device.name)) : undefined;
      const inspector = new TreeInspector(shell, process.cwd(), launcher);
      const inspectResult = await inspector.inspect(device, {
        metroPort: config.metroPort,
        devToolsPort: config.devToolsPort,
        timeoutMs: config.timeouts.treeInspectionMs,
        bundleId: await getBundleId(program, config.metroPort, device.name),
      });

      const backend = createBackend(shell, device.platform, companion);
      const executor = new GestureExecutor(backend);
      let result = await executor.typeInto(device, inspectResult.tree, target, text);

      if (!result.success && result.error?.includes('Target not found') && companion) {
        const rawNodes = await companion.hierarchy();
        const companionTree = parseCompanionHierarchy(rawNodes);
        result = await executor.typeInto(device, companionTree, target, text);
      }

      if (!result.success && result.error?.includes('Target not found') && companion) {
        const frame = await companion.find(target);
        if (frame) {
          const cx = Math.round(frame.x + frame.width / 2);
          const cy = Math.round(frame.y + frame.height / 2);
          await backend.tap(device, { x: cx, y: cy });
          await backend.type(device, text);
          result = { success: true, action: 'typeInto', target: { x: cx, y: cy, resolvedFrom: `xcuitest-find:${target}` }, durationMs: Date.now() };
        }
      }
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('swipe <direction>')
    .description('Swipe up, down, left, or right')
    .option('-d, --device <id>', 'device ID or name')
    .option('--distance <n>', 'swipe distance in points', parseInt)
    .action(async (direction: string, opts: Record<string, unknown>) => {
      const shell = new RealShell();
      const config = await loadConfig();
      const discovery = new DeviceDiscovery(shell);
      const devices = await discovery.list();
      const booted = devices.filter((d) => d.state === 'booted');
      if (booted.length === 0) throw new Error('No booted devices found');
      let device;
      if (opts.device) {
        device = booted.find((d) => d.id === opts.device || d.name === opts.device);
        if (!device) throw new Error(`Device not found: ${opts.device}`);
      } else {
        device = await pickDevice(booted);
      }

      const launcher = device.platform === 'ios' ? getCompanionLauncher(config.companionPort) : undefined;
      const companion = launcher ? await launcher.ensureRunning(device.id, await getBundleId(program, config.metroPort, device.name)) : undefined;
      const backend = createBackend(shell, device.platform, companion);
      const executor = new GestureExecutor(backend);
      const result = await executor.swipe(device, direction as 'up' | 'down' | 'left' | 'right', opts.distance as number | undefined);
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('go-back')
    .description('Press the back button')
    .option('-d, --device <id>', 'device ID or name')
    .action(async (opts: Record<string, unknown>) => {
      const shell = new RealShell();
      const config = await loadConfig();
      const discovery = new DeviceDiscovery(shell);
      const devices = await discovery.list();
      const booted = devices.filter((d) => d.state === 'booted');
      if (booted.length === 0) throw new Error('No booted devices found');
      let device;
      if (opts.device) {
        device = booted.find((d) => d.id === opts.device || d.name === opts.device);
        if (!device) throw new Error(`Device not found: ${opts.device}`);
      } else {
        device = await pickDevice(booted);
      }

      const launcher = device.platform === 'ios' ? getCompanionLauncher(config.companionPort) : undefined;
      const companion = launcher ? await launcher.ensureRunning(device.id, await getBundleId(program, config.metroPort, device.name)) : undefined;
      const backend = createBackend(shell, device.platform, companion);
      const executor = new GestureExecutor(backend);
      const result = await executor.goBack(device);
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('open-url <url>')
    .description('Open a deep link or URL on the device')
    .option('-d, --device <id>', 'device ID or name')
    .action(async (url: string, opts: Record<string, unknown>) => {
      const shell = new RealShell();
      const config = await loadConfig();
      const discovery = new DeviceDiscovery(shell);
      const devices = await discovery.list();
      const booted = devices.filter((d) => d.state === 'booted');
      if (booted.length === 0) throw new Error('No booted devices found');
      let device;
      if (opts.device) {
        device = booted.find((d) => d.id === opts.device || d.name === opts.device);
        if (!device) throw new Error(`Device not found: ${opts.device}`);
      } else {
        device = await pickDevice(booted);
      }

      const launcher = device.platform === 'ios' ? getCompanionLauncher(config.companionPort) : undefined;
      const companion = launcher ? await launcher.ensureRunning(device.id, await getBundleId(program, config.metroPort, device.name)) : undefined;
      const backend = createBackend(shell, device.platform, companion);
      const executor = new GestureExecutor(backend);
      const result = await executor.openUrl(device, url);
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('setup-claude')
    .description('Register driftx as a Claude Code plugin')
    .option('--silent', 'suppress output')
    .action((opts: Record<string, unknown>) => {
      const silent = !!opts.silent;
      const log = (...args: unknown[]) => { if (!silent) console.log(...args); };
      const claudeDir = join(homedir(), '.claude');
      const pluginsDir = join(claudeDir, 'plugins');
      const driftxPluginDir = join(pluginsDir, 'driftx');
      const registryPath = join(pluginsDir, 'installed_plugins.json');

      const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
      const skillSource = join(packageRoot, 'driftx-plugin');

      if (!existsSync(skillSource)) {
        console.error(`driftx-plugin directory not found at ${skillSource}`);
        process.exitCode = 1;
        return;
      }

      mkdirSync(pluginsDir, { recursive: true });

      if (existsSync(driftxPluginDir)) {
        try { unlinkSync(driftxPluginDir); } catch {
          console.error(`Could not remove existing ${driftxPluginDir}. Remove it manually and retry.`);
          process.exitCode = 1;
          return;
        }
      }
      symlinkSync(skillSource, driftxPluginDir);

      const pluginJsonPath = join(skillSource, '.claude-plugin', 'plugin.json');
      try {
        const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf-8'));
        pluginJson.version = pkg.version;
        writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + '\n');
      } catch {}

      const cacheDir = join(pluginsDir, 'cache', 'local', 'driftx');
      if (existsSync(cacheDir)) {
        rmSync(cacheDir, { recursive: true, force: true });
      }

      let registry: { version: number; plugins: Record<string, unknown[]> } = { version: 2, plugins: {} };
      try {
        registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
      } catch {}

      registry.plugins['driftx@local'] = [{
        scope: 'user',
        installPath: driftxPluginDir,
        version: pkg.version,
        installedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      }];

      writeFileSync(registryPath, JSON.stringify(registry, null, 2));
      log('driftx registered as Claude Code plugin.');
      log(`  Symlink: ${driftxPluginDir} -> ${skillSource}`);
      log(`  Registry: ${registryPath}`);
      log('\nRestart Claude Code to pick up the driftx skill.');
    });

  program
    .command('setup-cursor')
    .description('Add driftx skill to a Cursor project')
    .action(() => {
      const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
      const skillPath = join(packageRoot, 'driftx-plugin', 'skills', 'driftx', 'SKILL.md');

      if (!existsSync(skillPath)) {
        console.error(`SKILL.md not found at ${skillPath}`);
        process.exitCode = 1;
        return;
      }

      const skillContent = readFileSync(skillPath, 'utf-8')
        .replace(/^---[\s\S]*?---\n*/, '');

      const rulesDir = join(process.cwd(), '.cursor', 'rules');
      mkdirSync(rulesDir, { recursive: true });

      const targetPath = join(rulesDir, 'driftx.mdc');
      writeFileSync(targetPath, `---
description: driftx - Visual comparison, accessibility audit, layout regression, and device interaction for mobile apps
globs:
alwaysApply: true
---

${skillContent}`);

      console.log(`driftx skill written to ${targetPath}`);
      console.log('Cursor will pick it up automatically.');
    });

  return program;
}

export function run(argv: string[]): void {
  const program = createProgram();
  checkForUpdate(pkg.version).then((msg) => {
    if (msg) process.stderr.write(msg + '\n');
  }).catch(() => {});
  program.parseAsync(argv);
}
