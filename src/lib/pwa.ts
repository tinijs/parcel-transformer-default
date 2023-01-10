export function injectPWA(content: string) {
  return (
    content +
    '\n' +
    `
import {Workbox} from 'workbox-window';
if ('serviceWorker' in navigator) {
  const wb = new Workbox('/sw.js');
  wb.register();
}
`
  );
}
