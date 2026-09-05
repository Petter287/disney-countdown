export const $ = (id) => document.getElementById(id);

export function setStatus(element, message = '', type = '') {
  if (!element) return;
  element.textContent = message;
  element.className = `small mt-2 ${type === 'error' ? 'text-danger' : type === 'ok' ? 'text-success' : 'trip-muted'}`;
}
