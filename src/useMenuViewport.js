import { useLayoutEffect } from 'react';

export default function useMenuViewport(menuRef, open) {
  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const viewport = window.visualViewport;
    const fit = () => {
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      menu.style.maxHeight = `${Math.max(0, bottom - menu.getBoundingClientRect().top - 16)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    viewport?.addEventListener('resize', fit);
    viewport?.addEventListener('scroll', fit);
    return () => {
      window.removeEventListener('resize', fit);
      viewport?.removeEventListener('resize', fit);
      viewport?.removeEventListener('scroll', fit);
    };
  }, [menuRef, open]);
}
