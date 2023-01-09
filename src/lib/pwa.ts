import {resolve} from 'path';
import {exists} from 'fs-extra';

function pwaAvailable() {
  return exists(resolve('build-sw.js'));
}

export async function injectPWA(content: string) {
  if (await pwaAvailable()) {
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
  return content;
}
