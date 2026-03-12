import { exec } from 'node:child_process';
import { getLogger } from '../logger.js';

export function getClipboardCommand(platform: string): string | undefined {
  if (platform === 'darwin') return 'pbcopy';
  if (platform === 'win32') return 'clip';
  if (platform === 'linux') return 'xclip -selection clipboard';
  return undefined;
}

export async function copyToClipboard(text: string): Promise<void> {
  const logger = getLogger();
  const cmd = getClipboardCommand(process.platform);

  if (!cmd) {
    logger.debug(`Clipboard not supported on ${process.platform}`);
    return;
  }

  return new Promise((resolve) => {
    const proc = exec(cmd, (err) => {
      if (err) {
        logger.debug(`Clipboard copy failed: ${err.message}`);
      }
      resolve();
    });
    proc.stdin?.write(text);
    proc.stdin?.end();
  });
}
