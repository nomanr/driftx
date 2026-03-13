import { z } from 'zod';
import { cosmiconfig } from 'cosmiconfig';
import { DEFAULT_TIMEOUT_CONFIG, DEFAULT_RETRY_POLICY } from './types.js';

const timeoutSchema = z.object({
  deviceDiscoveryMs: z.number().int().positive().optional(),
  screenshotCaptureMs: z.number().int().positive().optional(),
  treeInspectionMs: z.number().int().positive().optional(),
  devToolsConnectMs: z.number().int().positive().optional(),
});

const retrySchema = z.object({
  maxAttempts: z.number().int().positive().optional(),
  baseDelayMs: z.number().int().positive().optional(),
  maxDelayMs: z.number().int().positive().optional(),
  backoffMultiplier: z.number().positive().optional(),
  retryableErrors: z.array(z.string()).optional(),
});

const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const colorRangeSchema = z.object({
  r: z.tuple([z.number(), z.number()]),
  g: z.tuple([z.number(), z.number()]),
  b: z.tuple([z.number(), z.number()]),
  a: z.tuple([z.number(), z.number()]).optional(),
});

const ignoreRuleSchema = z.object({
  type: z.enum(['testID', 'componentName', 'textPattern', 'boundingBox', 'sourceFile', 'colorRange']),
  value: z.union([z.string(), boundingBoxSchema, colorRangeSchema]),
  reason: z.string().optional(),
});

const viewportSchema = z.object({
  cropStatusBar: z.boolean().optional(),
  cropNavigationBar: z.boolean().optional(),
  statusBarHeight: z.number().int().nonnegative().optional(),
  navigationBarHeight: z.number().int().nonnegative().optional(),
});

const analysesSchema = z.object({
  default: z.array(z.string()).optional(),
  disabled: z.array(z.string()).optional(),
  options: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
}).optional();

export const configSchema = z.object({
  threshold: z.number().min(0).max(1).optional(),
  diffThreshold: z.number().min(0).max(1).optional(),
  settleTimeMs: z.number().int().positive().optional(),
  settleCheckEnabled: z.boolean().optional(),
  settleMaxDelta: z.number().min(0).max(1).optional(),
  primaryDevice: z.string().optional(),
  groups: z.record(z.string(), z.array(z.string())).optional(),
  platform: z.enum(['android', 'ios']).optional(),
  metroPort: z.number().int().positive().optional(),
  devToolsPort: z.number().int().positive().optional(),
  ignoreRules: z.array(ignoreRuleSchema).optional(),
  viewport: viewportSchema.optional(),
  timeouts: timeoutSchema.optional(),
  retry: retrySchema.optional(),
  regionMergeGap: z.number().int().nonnegative().optional(),
  regionMinArea: z.number().int().nonnegative().optional(),
  diffMaskColor: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  companionPort: z.number().int().positive().optional(),
  analyses: analysesSchema,
});

export type DriftxConfig = {
  threshold: number;
  diffThreshold: number;
  settleTimeMs: number;
  settleCheckEnabled: boolean;
  settleMaxDelta: number;
  primaryDevice?: string;
  groups: Record<string, string[]>;
  platform: 'android' | 'ios';
  metroPort: number;
  devToolsPort: number;
  ignoreRules: z.infer<typeof ignoreRuleSchema>[];
  viewport: {
    cropStatusBar: boolean;
    cropNavigationBar: boolean;
    statusBarHeight: number;
    navigationBarHeight: number;
  };
  timeouts: typeof DEFAULT_TIMEOUT_CONFIG;
  retry: typeof DEFAULT_RETRY_POLICY;
  regionMergeGap: number;
  regionMinArea: number;
  diffMaskColor: [number, number, number, number];
  companionPort: number;
  analyses: {
    default: string[];
    disabled: string[];
    options: Record<string, Record<string, unknown>>;
  };
};

const DEFAULTS: DriftxConfig = {
  threshold: 0.1,
  diffThreshold: 0.01,
  settleTimeMs: 300,
  settleCheckEnabled: true,
  settleMaxDelta: 0.001,
  primaryDevice: undefined,
  groups: {},
  platform: 'android',
  metroPort: 8081,
  devToolsPort: 8097,
  ignoreRules: [],
  viewport: {
    cropStatusBar: true,
    cropNavigationBar: true,
    statusBarHeight: 24,
    navigationBarHeight: 48,
  },
  timeouts: { ...DEFAULT_TIMEOUT_CONFIG },
  retry: { ...DEFAULT_RETRY_POLICY },
  regionMergeGap: 8,
  regionMinArea: 100,
  diffMaskColor: [255, 0, 0, 128],
  companionPort: 8300,
  analyses: {
    default: [],
    disabled: [],
    options: {},
  },
};

export function getDefaultConfig(): DriftxConfig {
  return structuredClone(DEFAULTS);
}

export function parseConfig(raw: unknown): DriftxConfig {
  const parsed = configSchema.parse(raw);
  const defaults = getDefaultConfig();

  return {
    ...defaults,
    ...parsed,
    companionPort: parsed.companionPort ?? defaults.companionPort,
    viewport: { ...defaults.viewport, ...parsed.viewport },
    timeouts: { ...defaults.timeouts, ...parsed.timeouts },
    retry: { ...defaults.retry, ...parsed.retry },
    analyses: {
      default: parsed.analyses?.default ?? DEFAULTS.analyses.default,
      disabled: parsed.analyses?.disabled ?? DEFAULTS.analyses.disabled,
      options: { ...DEFAULTS.analyses.options, ...parsed.analyses?.options },
    },
  };
}

const explorer = cosmiconfig('driftx');

export async function loadConfig(searchFrom?: string): Promise<DriftxConfig> {
  const result = await explorer.search(searchFrom);
  if (!result || result.isEmpty) {
    return getDefaultConfig();
  }
  return parseConfig(result.config);
}
