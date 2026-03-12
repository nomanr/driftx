export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InspectionCapabilities {
  tree: 'none' | 'basic' | 'detailed';
  sourceMapping: 'none' | 'partial' | 'precise';
  styles: 'none' | 'partial' | 'detailed';
  protocol: string;
}

export interface ScrollCaptureSupport {
  supported: boolean;
  reason: string;
  mode: 'none' | 'experimental' | 'stable';
}

export interface SourceResolution {
  fileName: string;
  lineNumber?: number;
  columnNumber?: number;
  method: 'inspectElement' | 'sourceMap' | 'filesystem' | 'resourceId';
  confidence: number;
}

export interface ExpectedValue {
  value: string | number;
  source: 'heuristic' | 'design-metadata' | 'unknown';
  confidence: number;
  label?: string;
}

export interface DiffEvidence {
  type: 'pixel' | 'tree' | 'accessibility' | 'semantic' | 'token' | 'regression';
  score: number;
  note: string;
}

export interface ComponentMatch {
  name: string;
  testID?: string;
  source?: SourceResolution;
  bounds: BoundingBox;
  depth: number;
}

export interface DiffFinding {
  id: string;
  category:
    | 'spacing'
    | 'color'
    | 'font'
    | 'alignment'
    | 'size'
    | 'content'
    | 'missing'
    | 'extra'
    | 'unknown'
    | 'accessibility'
    | 'text-mismatch'
    | 'hierarchy'
    | 'regression'
    | 'design-token';
  severity: 'critical' | 'major' | 'minor' | 'info';
  confidence: number;
  region: BoundingBox;
  component?: ComponentMatch;
  expected?: ExpectedValue;
  actual?: ExpectedValue;
  evidence: DiffEvidence[];
  description?: string;
}

export interface RunMetadata {
  runId: string;
  startedAt: string;
  completedAt?: string;
  projectRoot: string;
  gitCommit?: string;
  gitBranch?: string;
  deviceId: string;
  platform: 'android' | 'ios';
  framework: 'react-native' | 'native-android' | 'native-ios' | 'unknown';
  orientation: 'portrait' | 'landscape';
  appId?: string;
  configHash: string;
  driftxVersion: string;
}

export interface PrerequisiteCheck {
  name: string;
  required: boolean;
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
  fix?: string;
}

export interface CapabilityReport {
  inspection: InspectionCapabilities;
  scrollCapture: ScrollCaptureSupport;
  sourceMapping: boolean;
  prerequisites: PrerequisiteCheck[];
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface TimeoutConfig {
  deviceDiscoveryMs: number;
  screenshotCaptureMs: number;
  treeInspectionMs: number;
  devToolsConnectMs: number;
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: 'android' | 'ios';
  osVersion: string;
  screenSize?: { width: number; height: number; density: number };
  state: 'booted' | 'offline' | 'unauthorized';
  transport?: string;
}

export interface DiffRegion {
  id: string;
  bounds: BoundingBox;
  pixelCount: number;
  percentage: number;
  cropped?: string;
}

export interface DiffResult {
  runId: string;
  metadata: RunMetadata;
  totalPixels: number;
  diffPixels: number;
  diffPercentage: number;
  regions: DiffRegion[];
  findings: DiffFinding[];
  capabilities: CapabilityReport;
  durationMs: number;
}

export interface ColorRange {
  r: [number, number];
  g: [number, number];
  b: [number, number];
  a?: [number, number];
}

export interface IgnoreRule {
  type:
    | 'testID'
    | 'componentName'
    | 'textPattern'
    | 'boundingBox'
    | 'sourceFile'
    | 'colorRange';
  value: string | BoundingBox | ColorRange;
  reason?: string;
}

export interface ComponentNode {
  id: string;
  name: string;
  nativeName?: string;
  reactName?: string;
  testID?: string;
  bounds: BoundingBox;
  text?: string;
  children: ComponentNode[];
  source?: SourceResolution;
  styles?: Record<string, string | number>;
  inspectionTier: 'basic' | 'detailed';
}

export interface Shell {
  exec(
    cmd: string,
    args: string[],
    options?: { timeout?: number },
  ): Promise<{ stdout: string; stderr: string }>;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: ['device busy', 'transport error', 'ECONNRESET'],
};

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  deviceDiscoveryMs: 5000,
  screenshotCaptureMs: 10000,
  treeInspectionMs: 15000,
  devToolsConnectMs: 3000,
};
