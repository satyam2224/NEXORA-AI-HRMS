import { useEffect, useState } from 'react';

// Minimal hash-based router. Routes look like "#/employees/abc".
export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/dashboard');

  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/dashboard');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return hash;
}

export function navigate(path: string) {
  if (!path.startsWith('#')) path = `#${path}`;
  if (window.location.hash === path) return;
  window.location.hash = path;
}

export function parseRoute(hash: string): { page: string; params: string[] } {
  const clean = hash.replace(/^#\/?/, '');
  if (!clean) return { page: 'dashboard', params: [] };
  const parts = clean.split('/').filter(Boolean);
  return { page: parts[0] || 'dashboard', params: parts.slice(1) };
}
