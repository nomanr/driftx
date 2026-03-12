import { Command } from 'commander';
import { createRequire } from 'module';
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { RealShell } from './shell.js';
import { loadConfig } from './config.js';
import { createLogger, setLogger } from './logger.js';
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
  const program = new Command();
  program
    .name('driftx')
    .description('Visual diff tool for React Native and Android development')
    .version(pkg.version)
    .option('--verbose', 'enable debug logging')
    .option('--quiet', 'suppress all output except errors')
    .option('--format <type>', 'output format: terminal, markdown, json', 'terminal')
    .option('--copy', 'copy output to clipboard');

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

      const inspector = new TreeInspector(shell, process.cwd());
      const result = await inspector.inspect(device, {
        metroPort: config.metroPort,
        devToolsPort: config.devToolsPort,
        timeoutMs: config.timeouts.treeInspectionMs,
      });

      const globalOpts = this.optsWithGlobals();
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

      const backend = createBackend(shell, device.platform);
      const executor = new GestureExecutor(backend);

      let result;
      if (opts.xy) {
        const [x, y] = target.split(',').map(Number);
        result = await executor.tapXY(device, x, y);
      } else {
        const inspector = new TreeInspector(shell, process.cwd());
        const inspectResult = await inspector.inspect(device, {
          metroPort: config.metroPort,
          devToolsPort: config.devToolsPort,
          timeoutMs: config.timeouts.treeInspectionMs,
        });
        result = await executor.tap(device, inspectResult.tree, target);
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

      const inspector = new TreeInspector(shell, process.cwd());
      const inspectResult = await inspector.inspect(device, {
        metroPort: config.metroPort,
        devToolsPort: config.devToolsPort,
        timeoutMs: config.timeouts.treeInspectionMs,
      });

      const backend = createBackend(shell, device.platform);
      const executor = new GestureExecutor(backend);
      const result = await executor.typeInto(device, inspectResult.tree, target, text);
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('swipe <direction>')
    .description('Swipe up, down, left, or right')
    .option('-d, --device <id>', 'device ID or name')
    .action(async (direction: string, opts: Record<string, unknown>) => {
      const shell = new RealShell();
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

      const backend = createBackend(shell, device.platform);
      const executor = new GestureExecutor(backend);
      const result = await executor.swipe(device, direction as 'up' | 'down' | 'left' | 'right');
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('go-back')
    .description('Press the back button')
    .option('-d, --device <id>', 'device ID or name')
    .action(async (opts: Record<string, unknown>) => {
      const shell = new RealShell();
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

      const backend = createBackend(shell, device.platform);
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

      const backend = createBackend(shell, device.platform);
      const executor = new GestureExecutor(backend);
      const result = await executor.openUrl(device, url);
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('setup-claude')
    .description('Register driftx as a Claude Code plugin')
    .action(() => {
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
      console.log('driftx registered as Claude Code plugin.');
      console.log(`  Symlink: ${driftxPluginDir} -> ${skillSource}`);
      console.log(`  Registry: ${registryPath}`);
      console.log('\nRestart Claude Code to pick up the driftx skill.');
    });

  return program;
}

export function run(argv: string[]): void {
  const program = createProgram();
  program.parseAsync(argv);
}
