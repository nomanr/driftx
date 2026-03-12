import { AnalysisRegistry } from './registry.js';
import { PixelAnalysis } from './plugins/pixel.js';
import { AccessibilityAnalysis } from './plugins/a11y.js';
import { RegressionAnalysis } from './plugins/regression.js';

export function createDefaultRegistry(): AnalysisRegistry {
  const registry = new AnalysisRegistry();
  registry.register(new PixelAnalysis());
  registry.register(new AccessibilityAnalysis());
  registry.register(new RegressionAnalysis());
  return registry;
}
