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
      const checks = await checkPrerequisites(shell);
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

  return program;
}

export function run(argv: string[]): void {
  const program = createProgram();
  program.parseAsync(argv);
}
