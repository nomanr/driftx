import { existsSync, rmSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8'));
const skillSource = join(packageRoot, 'driftx-plugin');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const claudeDir = join(homedir(), '.claude');
const pluginsDir = join(claudeDir, 'plugins');
const driftxPluginDir = join(pluginsDir, 'driftx');
const registryPath = join(pluginsDir, 'installed_plugins.json');
const cacheDir = join(pluginsDir, 'cache', 'local', 'driftx');

let updated = false;

if (existsSync(pluginsDir)) {
  try {
    // Sync plugin.json version
    const pluginJsonPath = join(skillSource, '.claude-plugin', 'plugin.json');
    if (existsSync(pluginJsonPath)) {
      const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf-8'));
      pluginJson.version = pkg.version;
      writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + '\n');
    }

    // Re-create symlink
    if (existsSync(driftxPluginDir)) {
      try { unlinkSync(driftxPluginDir); } catch {}
    }
    mkdirSync(pluginsDir, { recursive: true });
    symlinkSync(skillSource, driftxPluginDir);

    // Clear cache
    if (existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true, force: true });
    }

    // Update registry
    let registry = { version: 2, plugins: {} };
    try {
      registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
    } catch {}

    registry.plugins['driftx@local'] = [{
      scope: 'user',
      installPath: driftxPluginDir,
      version: pkg.version,
      installedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    }];

    writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    updated = true;
  } catch {}
}

console.log('');
console.log(`  ${green('+')} ${bold('driftx')} v${pkg.version} installed`);
console.log('');

if (updated) {
  console.log(`  ${green('\u2713')} Claude Code plugin updated to v${pkg.version}`);
  console.log(`    ${dim('Restart Claude Code to pick up the new skill.')}`);
} else {
  console.log(`  ${cyan('i')} Run ${bold('driftx setup-claude')} to register the Claude Code plugin`);
}

console.log(`  ${cyan('i')} Run ${bold('driftx setup-cursor')} to add the skill to a Cursor project`);
console.log('');
