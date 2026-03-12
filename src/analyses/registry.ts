import type { AnalysisPlugin } from './types.js';

export class AnalysisRegistry {
  private plugins = new Map<string, AnalysisPlugin>();

  register(plugin: AnalysisPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Analysis "${plugin.name}" already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  get(name: string): AnalysisPlugin | undefined {
    return this.plugins.get(name);
  }

  all(): AnalysisPlugin[] {
    return [...this.plugins.values()];
  }

  names(): string[] {
    return [...this.plugins.keys()];
  }
}
