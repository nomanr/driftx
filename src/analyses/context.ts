import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import type { DriftImage, AnalysisConfig } from './types.js';

export async function buildDriftImage(filePath: string): Promise<DriftImage> {
  const buffer = readFileSync(filePath);
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;
  const rawPixels = await image.raw().ensureAlpha().toBuffer();

  return {
    buffer,
    rawPixels,
    width,
    height,
    aspectRatio: width / height,
    path: filePath,
  };
}

export function buildAnalysisConfig(
  configAnalyses: { default: string[]; disabled: string[]; options: Record<string, Record<string, unknown>> },
  withFlag?: string,
  withoutFlag?: string,
): AnalysisConfig {
  const enabled = withFlag
    ? withFlag.split(',').map((s) => s.trim())
    : [...configAnalyses.default];

  const disabled = withoutFlag
    ? withoutFlag.split(',').map((s) => s.trim())
    : [...configAnalyses.disabled];

  return {
    enabled,
    disabled,
    options: configAnalyses.options,
  };
}
