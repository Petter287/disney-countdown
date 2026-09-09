const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function validateImage(file) {
  if (!file) return null;
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'La imagen debe ser JPG, PNG o WebP.';
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen no puede superar los 4 MB.';
  if (!file.size) return 'La imagen está vacía.';
  return null;
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      if (comma < 0) return reject(new Error('No se pudo procesar la imagen seleccionada.'));
      resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}
