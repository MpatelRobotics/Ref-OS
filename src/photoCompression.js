/* =====================================================================
   Robot photo compression (reference/identification photos only).

   Violation evidence photos do NOT use this module; they keep their own
   existing compression in App.jsx so evidence behavior is unchanged.

   Policy:
   - Decode with EXIF orientation applied (portrait phone photos stay upright).
   - Resize so the longest side is at most 1440 px, keeping the aspect ratio.
   - Encode as WebP at quality 0.78 when the browser can encode WebP,
     otherwise JPEG at quality 0.80.
   - Re-encoding through a canvas drops camera metadata (EXIF, GPS, etc.).
   - Aim for 700 KB or less: if a photo is larger, step quality down a little
     (never below 0.66), then try a 1280 px longest side. Never upload the
     original file, and never upload anything over 1.5 MB.
   ===================================================================== */

export const ROBOT_PHOTO_POLICY = {
  maxDimension: 1440,
  fallbackDimension: 1280,
  webpQuality: 0.78,
  jpegQuality: 0.8,
  minQuality: 0.66,
  targetBytes: 700 * 1024,
  hardLimitBytes: 1.5 * 1024 * 1024,
  maxInputBytes: 40 * 1024 * 1024,
};

export class RobotPhotoError extends Error {}

const dataUrlBytes = (dataUrl) => {
  const b64 = String(dataUrl).split(",")[1] || "";
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
};
export const dataUrlMime = (dataUrl) => (String(dataUrl).match(/^data:([^;,]+)/) || [])[1] || "";

export function fitWithin(width, height, maxDimension) {
  const longest = Math.max(width, height);
  if (!longest || longest <= maxDimension) return { width, height };
  const scale = maxDimension / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* fall back to <img> */ }
  }
  // <img> applies EXIF orientation by default in current browsers (CSS image-orientation: from-image).
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new RobotPhotoError("This picture could not be opened. Take the picture again."));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function encode(source, width, height, mime, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new RobotPhotoError("This device could not process the picture.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL(mime, quality);
}

// Returns { dataUrl, mime, bytes, width, height, originalBytes }. Throws RobotPhotoError on failure;
// callers must show the error instead of uploading the original file.
export async function compressRobotPhoto(file, policy = ROBOT_PHOTO_POLICY) {
  if (!file) throw new RobotPhotoError("No picture was selected.");
  if (file.type && !/^image\//i.test(file.type)) throw new RobotPhotoError("That file is not a picture.");
  if (file.size > policy.maxInputBytes) {
    throw new RobotPhotoError(`That picture is unexpectedly large (${Math.round(file.size / 1048576)} MB). Take a new picture with the camera instead.`);
  }
  const source = await decode(file);
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new RobotPhotoError("This picture could not be read. Take the picture again.");

  // Feature-detect WebP encoding: browsers without it silently return PNG.
  const probe = encode(source, 1, 1, "image/webp", policy.webpQuality);
  const mime = probe.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
  const startQuality = mime === "image/webp" ? policy.webpQuality : policy.jpegQuality;

  const attempts = [];
  for (const dimension of [policy.maxDimension, policy.fallbackDimension]) {
    const { width, height } = fitWithin(sourceWidth, sourceHeight, dimension);
    for (let quality = startQuality; quality >= policy.minQuality - 1e-9; quality = Math.round((quality - 0.06) * 100) / 100) {
      const dataUrl = encode(source, width, height, mime, quality);
      if (!dataUrl.startsWith(`data:${mime}`)) throw new RobotPhotoError("This device could not compress the picture.");
      const bytes = dataUrlBytes(dataUrl);
      attempts.push({ dataUrl, mime, bytes, width, height });
      if (bytes <= policy.targetBytes) {
        if (typeof source.close === "function") source.close();
        return { dataUrl, mime, bytes, width, height, originalBytes: file.size || 0 };
      }
    }
  }
  if (typeof source.close === "function") source.close();
  // Keep reasonable quality: accept the smallest attempt if it is still within the hard limit.
  const best = attempts.reduce((a, b) => (b.bytes < a.bytes ? b : a));
  if (best.bytes > policy.hardLimitBytes) {
    throw new RobotPhotoError(`This picture is still too large after compression (${Math.round(best.bytes / 1024)} KB). Take the picture again with less detail in the background.`);
  }
  return { ...best, originalBytes: file.size || 0 };
}
