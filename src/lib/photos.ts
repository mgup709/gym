/** Downscale an image file to at most `max` px on the long side, JPEG-encoded. */
export async function resizeImage(file: Blob, max = 1600, quality = 0.86): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', quality))
  return { blob, width: w, height: h }
}
