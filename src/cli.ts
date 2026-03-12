import { Command } from 'commander';
import { createRequire } from 'module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RealShell } from './shell.js';
import { loadConfig } from './config.js';
import { createLogger, setLogger } from './logger.js';
import { checkPrerequisites } from './prerequisites.js';
import { formatPrerequisiteTable } from './commands/doctor.js';
import { detectFramework, generateConfig } from './commands/init.js';
import { DeviceDiscovery } from './devices/discovery.js';
import { formatDeviceTable } from './commands/devices.js';
import { runCapture } from './commands/capture.js';
import { runCompare, formatCompareOutput } from './commands/compare.js';
import { TreeInspector } from './inspect/tree-inspector.js';
import { formatTree, formatCapabilities, formatStrategy } from './commands/inspect.js';
import { pickDevice } from './commands/device-picker.js';
import { ExitCode } from './exit-codes.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export function createProgram(): Command {
  const program = new Command();
  program
    .name('drift')
    .description('Visual diff tool for React Native and Android development')
    .version(pkg.version)
    .option('--verbose', 'enable debug logging')
    .option('--quiet', 'suppress all output except errors');

  program.hook('preAction', (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    const level = opts.verbose ? 'debug' : opts.quiet ? 'silent' : 'info';
    setLogger(createLogger(level));
  });

  program
    .command('doctor')
    .description('Check system prerequisites for drift')
    .action(async () => {
      const shell = new RealShell();
      const config = await loadConfig();
      const checks = await checkPrerequisites(shell, config.metroPort);
      const { table, exitCode } = formatPrerequisiteTable(checks);
      console.log(table);
      process.exitCode = exitCode;
    });

  program
    .command('init')
    .description('Initialize drift configuration for this project')
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
      const configPath = join(cwd, '.driftrc.json');
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      console.log(`Created ${configPath} (framework: ${framework})`);
    });

  program
    .command('devices')
    .description('List connected devices and simulators')
    .action(async () => {
      const shell = new RealShell();
      const discovery = new DeviceDiscovery(shell);
      const devices = await discovery.list();
      console.log(formatDeviceTable(devices));
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
    .requiredOption('--design <path>', 'path to design image')
    .option('-d, --device <id>', 'device ID or name')
    .option('--threshold <n>', 'diff percentage threshold', parseFloat)
    .option('--screenshot <path>', 'use existing screenshot instead of capturing')
    .action(async (opts) => {
      const shell = new RealShell();
      const config = await loadConfig();
      const { result, exitCode } = await runCompare(shell, config, {
        design: opts.design,
        device: opts.device,
        threshold: opts.threshold,
        screenshot: opts.screenshot,
      });
      console.log(formatCompareOutput(result));
      process.exitCode = exitCode;
    });

  program
    .command('inspect')
    .description('Inspect component tree on device')
    .option('-d, --device <id>', 'device ID or name')
    .option('--json', 'output as JSON')
    .option('--capabilities', 'show inspection capabilities only')
    .action(async (opts) => {
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

      const inspector = new TreeInspector(shell);
      const result = await inspector.inspect(device, {
        metroPort: config.metroPort,
        devToolsPort: config.devToolsPort,
        timeoutMs: config.timeouts.treeInspectionMs,
      });

      if (opts.capabilities) {
        console.log(formatStrategy(result));
        console.log(formatCapabilities(result.capabilities));
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify({
          tree: result.tree,
          capabilities: result.capabilities,
          strategy: result.strategy,
          device: result.device,
        }, null, 2));
        return;
      }

      console.log(formatStrategy(result));

      if (result.tree.length === 0) {
        console.log('  No component tree available. Try running with React DevTools enabled.');
        return;
      }

      console.log(formatTree(result.tree));
      console.log(formatCapabilities(result.capabilities));
    });

  return program;
}

export function run(argv: string[]): void {
  const program = createProgram();
  program.parseAsync(argv);
}
