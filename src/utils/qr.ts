/** Generate a QR code data URL; the `qrcode` library (~70 KB) is loaded on first use. */
export const qrToDataUrl = async (text: string, opts: { width?: number; margin?: number } = {}): Promise<string> => {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(text, { width: opts.width ?? 220, margin: opts.margin ?? 1 });
};
