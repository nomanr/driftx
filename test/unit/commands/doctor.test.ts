import { describe, it, expect } from 'vitest';
import { formatPrerequisiteTable } from '../../../src/commands/doctor.js';
import type { PrerequisiteCheck } from '../../../src/types.js';
import { ExitCode } from '../../../src/exit-codes.js';

describe('formatPrerequisiteTable', () => {
  it('formats all-pass checks', () => {
    const checks: PrerequisiteCheck[] = [
      { name: 'node', required: true, available: true, version: '20.11.0' },
      { name: 'adb', required: false, available: true, version: '34.0.5' },
    ];
    const { table, exitCode } = formatPrerequisiteTable(checks);
    expect(table).toContain('node');
    expect(table).toContain('20.11.0');
    expect(table).toContain('adb');
    expect(exitCode).toBe(ExitCode.Success);
  });

  it('formats missing optional tool', () => {
    const checks: PrerequisiteCheck[] = [
      { name: 'node', required: true, available: true, version: '20.11.0' },
      { name: 'xcrun', required: false, available: false, fix: 'xcode-select --install' },
    ];
    const { table, exitCode } = formatPrerequisiteTable(checks);
    expect(table).toContain('xcrun');
    expect(table).toContain('missing');
    expect(exitCode).toBe(ExitCode.Success);
  });

  it('returns PrerequisiteMissing exit code when required tool is missing', () => {
    const checks: PrerequisiteCheck[] = [
      { name: 'node', required: true, available: false, fix: 'Install Node.js' },
    ];
    const { table, exitCode } = formatPrerequisiteTable(checks);
    expect(table).toContain('node');
    expect(exitCode).toBe(ExitCode.PrerequisiteMissing);
  });

  it('includes fix instructions for missing tools', () => {
    const checks: PrerequisiteCheck[] = [
      { name: 'adb', required: false, available: false, fix: 'Install Android SDK Platform-Tools' },
    ];
    const { table } = formatPrerequisiteTable(checks);
    expect(table).toContain('Install Android SDK Platform-Tools');
  });

  it('handles empty checks list', () => {
    const { table, exitCode } = formatPrerequisiteTable([]);
    expect(table).toBeDefined();
    expect(exitCode).toBe(ExitCode.Success);
  });
});
