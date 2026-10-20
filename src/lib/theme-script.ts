// Sin 'use client': el layout (Server Component) lo inyecta en <head>.
export const THEME_STORAGE_KEY = 'theme';

export const THEME_INIT_SCRIPT =
  `try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;
