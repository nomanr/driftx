import type { ComponentMatch } from '../types.js';

export interface RegionComponentMatch {
  regionId: string;
  component: ComponentMatch;
  confidence: number;
  overlapRatio: number;
}
