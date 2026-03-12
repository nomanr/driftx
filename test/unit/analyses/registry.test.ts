import { describe, it, expect } from 'vitest';
import { AnalysisRegistry } from '../../../src/analyses/registry.js';
import type { AnalysisPlugin } from '../../../src/analyses/types.js';

function makePlugin(name: string): AnalysisPlugin {
  return {
    name,
    description: `${name} analysis`,
    isAvailable: () => true,
    run: async () => ({
      analysisName: name,
      findings: [],
      summary: 'ok',
      metadata: {},
      durationMs: 0,
    }),
  };
}

describe('AnalysisRegistry', () => {
  it('registers and retrieves a plugin', () => {
    const registry = new AnalysisRegistry();
    const plugin = makePlugin('pixel');
    registry.register(plugin);
    expect(registry.get('pixel')).toBe(plugin);
  });

  it('returns undefined for unknown plugin', () => {
    const registry = new AnalysisRegistry();
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('lists all registered plugins', () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel'));
    registry.register(makePlugin('a11y'));
    const all = registry.all();
    expect(all.map((p) => p.name)).toEqual(['pixel', 'a11y']);
  });

  it('throws on duplicate registration', () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel'));
    expect(() => registry.register(makePlugin('pixel'))).toThrow('already registered');
  });

  it('names returns list of registered names', () => {
    const registry = new AnalysisRegistry();
    registry.register(makePlugin('pixel'));
    registry.register(makePlugin('semantic'));
    expect(registry.names()).toEqual(['pixel', 'semantic']);
  });
});
