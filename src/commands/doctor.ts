import type { PrerequisiteCheck } from '../types.js';
import { ExitCode } from '../exit-codes.js';

export function computeDoctorExitCode(checks: PrerequisiteCheck[]): number {
  return checks.some((c) => c.required && !c.available)
    ? ExitCode.PrerequisiteMissing
    : ExitCode.Success;
}
