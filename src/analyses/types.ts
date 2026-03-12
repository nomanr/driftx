import type {
  DiffFinding,
  DiffRegion,
  RunMetadata,
  ComponentNode,
  DeviceInfo,
  InspectionCapabilities,
} from '../types.js';
import type { DriftxConfig } from '../config.js';
import type { RunStore } from '../run-store.js';

export interface DriftxImage {
  buffer: Buffer;
  rawPixels: Buffer;
  width: number;
  height: number;
  aspectRatio: number;
  path: string;
}

export interface AnalysisConfig {
  enabled: string[];
  disabled: string[];
  options: Record<string, Record<string, unknown>>;
}

export interface CompareContext {
  screenshot: DriftxImage;
  design?: DriftxImage;
  baseline?: DriftxImage;
  tree?: ComponentNode[];
  device?: DeviceInfo;
  config: DriftxConfig;
  analysisConfig: AnalysisConfig;
  runId: string;
  store: RunStore;
}

export interface AnalysisResult {
  analysisName: string;
  findings: DiffFinding[];
  summary: string;
  metadata: Record<string, unknown>;
  durationMs: number;
  error?: string;
}

export interface AnalysisPlugin {
  name: string;
  description: string;
  isAvailable(ctx: CompareContext): boolean;
  run(ctx: CompareContext): Promise<AnalysisResult>;
}

export interface MetaAnalysisPlugin extends AnalysisPlugin {
  run(ctx: CompareContext, orchestrator?: unknown): Promise<AnalysisResult>;
}

export interface CompareReport {
  runId: string;
  analyses: AnalysisResult[];
  findings: DiffFinding[];
  summary: string;
  metadata: RunMetadata;
  durationMs: number;
}
