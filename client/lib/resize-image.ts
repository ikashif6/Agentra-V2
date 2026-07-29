/**
 * Square-crop and shrink an image in the browser before upload.
 *
 * Profile photos are shown at 20–80px in the app and 28–34px in the chat widget.
 * Uploading the camera original means every widget visitor downloads a few hundred
 * KB, and browsers render such an extreme downscale softly.
 */
export async function resizeImageToSquare(file: File, size = 384): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  const bitmap = await loadBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  if (side <= size) {
    closeBitmap(bitmap);
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    closeBitmap(bitmap);
    return file;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap as CanvasImageSource,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  closeBitmap(bitmap);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to an <img> decode */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function closeBitmap(bitmap: ImageBitmap | HTMLImageElement) {
  if ("close" in bitmap) bitmap.close();
}
