// אימות וכיווץ תמונות לפני העלאה. הקידוד מחדש גם מסיר מטא-דאטה (EXIF/GPS).
export const ALLOWED_TYPES = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] };
export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export function validateImageFile(file) {
  if (!file) return 'לא נבחר קובץ.';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const allowedExt = ALLOWED_TYPES[file.type];
  if (!allowedExt) return `סוג הקובץ "${file.name}" אינו נתמך. מותר: JPG, PNG, WebP.`;
  if (!allowedExt.includes(ext)) return `סיומת הקובץ "${file.name}" אינה תואמת לסוג הקובץ.`;
  if (file.size > MAX_BYTES) return `הקובץ "${file.name}" גדול מ-10MB.`;
  return null;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function processImage(file, { maxDim = 1600, quality = 0.85 } = {}) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error(`לא ניתן לקרוא את התמונה "${file.name}". ייתכן שהקובץ פגום.`); }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  let blob = await canvasToBlob(canvas, 'image/webp', quality);
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await canvasToBlob(canvas, 'image/jpeg', quality); ext = 'jpg'; }
  if (!blob) throw new Error('עיבוד התמונה נכשל.');
  return { blob, width, height, type: blob.type, ext };
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function uid(prefix = '') {
  const rnd = crypto.getRandomValues(new Uint32Array(2));
  return prefix + Date.now().toString(36) + rnd[0].toString(36) + rnd[1].toString(36).slice(0, 4);
}
