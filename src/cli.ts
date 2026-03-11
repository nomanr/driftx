import { Command } from 'commander';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export function createProgram(): Command {
  const program = new Command();
  program
    .name('drift')
    .description('Visual diff tool for React Native and Android development')
    .version(pkg.version);
  return program;
}

export function run(argv: string[]): void {
  const program = createProgram();
  program.parse(argv);
}
