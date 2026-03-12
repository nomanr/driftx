import type { OutputFormatter, FormatterContext } from './types.js';
import { copyToClipboard } from './clipboard.js';

export async function formatOutput<T>(
  formatter: OutputFormatter<T>,
  data: T,
  ctx: FormatterContext,
): Promise<string> {
  const output = formatter[ctx.format](data);

  if (!ctx.quiet) {
    console.log(output);
  }

  if (ctx.copy) {
    const clipboardContent = ctx.format === 'terminal'
      ? formatter.markdown(data)
      : output;
    await copyToClipboard(clipboardContent);
  }

  return output;
}
