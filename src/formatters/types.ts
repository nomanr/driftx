import type { DiffResult, DeviceInfo, PrerequisiteCheck, ComponentNode } from '../types.js';
import type { InspectResult } from '../inspect/tree-inspector.js';

export type OutputFormat = 'terminal' | 'markdown' | 'json';

export interface FormatterContext {
  format: OutputFormat;
  copy: boolean;
  quiet: boolean;
}

export interface OutputFormatter<T> {
  terminal(data: T): string;
  markdown(data: T): string;
  json(data: T): string;
}

export interface CompareFormatData {
  result: DiffResult;
  device?: { name: string; platform: 'android' | 'ios' };
  artifactDir: string;
  tree?: ComponentNode[];
  inspectHints?: string[];
}
