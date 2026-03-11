export const ExitCode = {
  Success: 0,
  DiffFound: 1,
  ConfigError: 2,
  RuntimeError: 3,
  PrerequisiteMissing: 4,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
