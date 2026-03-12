import { describe, it, expect } from 'vitest';
import { computeDoctorExitCode } from '../../../src/commands/doctor.js';
import type { PrerequisiteCheck } from '../../../src/types.js';
import { ExitCode } from '../../../src/exit-codes.js';

describe('computeDoctorExitCode', () => {
  it('returns Success when all required tools available', () => {
    const checks: PrerequisiteCheck[] = [
      { name: 'node', required: true, available: true, version: '20.11.0' },
      { name: 'adb', required: false, available: false },
    ];
    expect(computeDoctorExitCode(checks)).toBe(ExitCode.Success);
  });

  it('returns PrerequisiteMissing when required tool missing', () => {
    const checks: PrerequisiteCheck[] = [
      { name: 'node', required: true, available: false, fix: 'Install Node.js' },
    ];
    expect(computeDoctorExitCode(checks)).toBe(ExitCode.PrerequisiteMissing);
  });

  it('returns Success for empty list', () => {
    expect(computeDoctorExitCode([])).toBe(ExitCode.Success);
  });
});
