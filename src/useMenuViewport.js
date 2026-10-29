import { useLayoutEffect } from 'react';

export default function useMenuViewport(menuRef, open) {
  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const viewport = window.visualViewport;
    const fit = () => {
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const mobile = window.matchMedia('(max-width:639px)').matches;
      if (mobile) {
        const anchor = menu.parentElement.getBoundingClientRect();
        const top = Math.max(viewport?.offsetTop || 0, Math.min(anchor.bottom + 8, bottom - 220));
        Object.assign(menu.style, {position:'fixed',top:`${top}px`,right:'12px',left:'auto',width:`${Math.min(320,(viewport?.width || window.innerWidth)-24)}px`,marginTop:'0px'});
      } else {
        Object.assign(menu.style,{position:'',top:'',right:'',left:'',width:'',marginTop:''});
      }
      // Leave the mobile navigation and home indicator clear below the menu.
      menu.style.maxHeight = `${Math.max(0, bottom - menu.getBoundingClientRect().top - (mobile ? 88 : 16))}px`;
      menu.style.overflowY = 'auto';
      menu.style.scrollbarWidth = 'thin';
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
