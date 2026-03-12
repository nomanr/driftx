import pc from 'picocolors';
import type { PrerequisiteCheck } from '../types.js';
import type { OutputFormatter } from './types.js';

export const doctorFormatter: OutputFormatter<PrerequisiteCheck[]> = {
  terminal(checks) {
    const lines: string[] = [];
    lines.push('Prerequisite Check');
    lines.push('─'.repeat(60));
    for (const check of checks) {
      const icon = check.available ? pc.green('+') : pc.red('-');
      const status = check.available ? 'ok' : pc.red('missing');
      const version = check.version ?? '';
      const required = check.required ? 'required' : 'optional';
      lines.push(`  [${icon}] ${check.name.padEnd(12)} ${String(status).padEnd(10)} ${version.padEnd(16)} (${required})`);
      if (!check.available && check.fix) {
        lines.push(`      Fix: ${check.fix}`);
      }
    }
    lines.push('─'.repeat(60));
    return lines.join('\n');
  },

  markdown(checks) {
    const lines: string[] = ['# Drift Doctor', '', '| Tool | Status | Version | Required | Fix |', '|------|--------|---------|----------|-----|'];
    for (const check of checks) {
      const status = check.available ? 'available' : 'unavailable';
      const version = check.version || '—';
      const required = check.required ? 'yes' : 'no';
      const fix = check.fix || '—';
      lines.push(`| ${check.name} | ${status} | ${version} | ${required} | ${fix} |`);
    }
    return lines.join('\n');
  },

  json(checks) {
    return JSON.stringify(checks, null, 2);
  },
};
