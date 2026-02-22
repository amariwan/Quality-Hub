import { useEffect, useState } from 'react';

export function useMediaQuery() {
  const [isOpen, setIsOpen] = useState(() =>
    globalThis.window
      ? globalThis.window.matchMedia('(max-width: 768px)').matches
      : false
  );

  useEffect(() => {
    const mediaQuery = globalThis.window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      setIsOpen(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return { isOpen };
}
