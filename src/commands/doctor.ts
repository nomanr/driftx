import type { PrerequisiteCheck } from '../types.js';
import { ExitCode } from '../exit-codes.js';

export function formatPrerequisiteTable(checks: PrerequisiteCheck[]): {
  table: string;
  exitCode: typeof ExitCode.Success | typeof ExitCode.PrerequisiteMissing;
} {
  const lines: string[] = [];
  let hasRequiredMissing = false;

  lines.push('Prerequisite Check');
  lines.push('─'.repeat(60));

  for (const check of checks) {
    const status = check.available ? 'ok' : 'missing';
    const icon = check.available ? '+' : '-';
    const version = check.version ?? '';
    const required = check.required ? 'required' : 'optional';

    lines.push(`  [${icon}] ${check.name.padEnd(12)} ${status.padEnd(10)} ${version.padEnd(16)} (${required})`);

    if (!check.available && check.fix) {
      lines.push(`      Fix: ${check.fix}`);
    }

    if (!check.available && check.required) {
      hasRequiredMissing = true;
    }
  }

  lines.push('─'.repeat(60));

  return {
    table: lines.join('\n'),
    exitCode: hasRequiredMissing ? ExitCode.PrerequisiteMissing : ExitCode.Success,
  };
}
