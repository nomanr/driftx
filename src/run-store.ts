import * as fs from 'node:fs';
import * as path from 'node:path';
import { nanoid } from 'nanoid';

export interface RunHandle {
  runId: string;
  dir: string;
}

export class RunStore {
  private baseDir: string;

  constructor(projectRoot: string) {
    this.baseDir = path.join(projectRoot, '.driftx', 'runs');
  }

  createRun(): RunHandle {
    const runId = nanoid(12);
    const dir = path.join(this.baseDir, runId);
    fs.mkdirSync(dir, { recursive: true });
    return { runId, dir };
  }

  private getRunDir(runId: string): string {
    return path.join(this.baseDir, runId);
  }

  async writeMetadata(runId: string, metadata: Record<string, unknown>): Promise<void> {
    const filePath = path.join(this.getRunDir(runId), 'metadata.json');
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
  }

  async writeArtifact(runId: string, relativePath: string, data: Buffer): Promise<void> {
    const filePath = path.join(this.getRunDir(runId), relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data);
  }

  listRuns(): string[] {
    if (!fs.existsSync(this.baseDir)) return [];
    return fs.readdirSync(this.baseDir).filter((f) => {
      return fs.statSync(path.join(this.baseDir, f)).isDirectory();
    });
  }

  getRunPath(runId: string, relativePath?: string): string {
    const dir = this.getRunDir(runId);
    return relativePath ? path.join(dir, relativePath) : dir;
  }

  readArtifact(runId: string, relativePath: string): Buffer | null {
    const fullPath = path.join(this.getRunDir(runId), relativePath);
    try {
      return fs.readFileSync(fullPath);
    } catch {
      return null;
    }
  }

  getLatestRun(): string | undefined {
    const runs = this.listRuns();
    if (runs.length === 0) return undefined;
    let latest: string | undefined;
    let latestTime = 0;
    for (const runId of runs) {
      try {
        const stat = fs.statSync(this.getRunDir(runId));
        if (stat.mtimeMs > latestTime) {
          latestTime = stat.mtimeMs;
          latest = runId;
        }
      } catch {
        continue;
      }
    }
    return latest;
  }
}
