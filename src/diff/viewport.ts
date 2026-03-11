import sharp from 'sharp';

export interface ViewportOptions {
  platform: 'android' | 'ios';
  cropStatusBar: boolean;
  statusBarHeight: { android: number; ios: number };
  cropNavigationBar: boolean;
}

export interface CroppedResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export async function cropViewport(imageBuffer: Buffer, options: ViewportOptions): Promise<CroppedResult> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width!;
  let height = metadata.height!;
  let top = 0;

  if (options.cropStatusBar) {
    const barHeight = options.platform === 'android'
      ? options.statusBarHeight.android
      : options.statusBarHeight.ios;
    top = barHeight;
    height -= barHeight;
  }

  if (top === 0 && height === metadata.height) {
    return { buffer: imageBuffer, width, height };
  }

  const buffer = await sharp(imageBuffer)
    .extract({ left: 0, top, width, height })
    .png()
    .toBuffer();

  return { buffer, width, height };
}
