import { AnalysisRegistry } from './registry.js';
import { PixelAnalysis } from './plugins/pixel.js';

export function createDefaultRegistry(): AnalysisRegistry {
  const registry = new AnalysisRegistry();
  registry.register(new PixelAnalysis());
  return registry;
}
