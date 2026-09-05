function normalizePath(path) {
  const value = path?.trim() || '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : '/';
}

export function currentRoute() {
  const path = normalizePath(window.location.hash.slice(1) || '/');

  if (path === '/') return { name: 'trips', path };
  if (path === '/users') return { name: 'users', path };
  if (path === '/trips/new') return { name: 'trip-new', path };

  const editMatch = path.match(/^\/trips\/([^/]+)\/edit$/);
  if (editMatch) {
    try {
      return { name: 'trip-edit', path, slug: decodeURIComponent(editMatch[1]) };
    } catch {
      return { name: 'not-found', path };
    }
  }

  const tripMatch = path.match(/^\/trips\/([^/]+)$/);
  if (tripMatch) {
    try {
      return { name: 'trip', path, slug: decodeURIComponent(tripMatch[1]) };
    } catch {
      return { name: 'not-found', path };
    }
  }

  return { name: 'not-found', path };
}

export function tripPath(slug) {
  return `/trips/${encodeURIComponent(slug)}`;
}

export function tripEditPath(slug) {
  return `/trips/${encodeURIComponent(slug)}/edit`;
}

export function navigate(path, { replace = false } = {}) {
  const targetPath = normalizePath(path);
  const targetHash = `#${targetPath}`;

  if (window.location.hash === targetHash) return false;

  if (replace) {
    window.location.replace(`${window.location.pathname}${window.location.search}${targetHash}`);
  } else {
    window.location.hash = targetPath;
  }

  return true;
}

export function bindRouter(onRoute) {
  window.addEventListener('hashchange', () => onRoute(currentRoute()));
}
