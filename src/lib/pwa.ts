export function injectPWA(content: string) {
  const wbCode = `
    if ('serviceWorker' in navigator) {
      this.$workbox = new Workbox('/sw.js');
      this.$workbox.register();
    }
  `;
  // import workbox-window
  content = "import {Workbox} from 'workbox-window';\n" + content;
  // add code
  const anchorMatching = content.match(/(onCreate\()([\s\S]*?)(\{)/);
  if (anchorMatching) {
    const anchorStr = anchorMatching[0];
    content = content.replace(anchorStr, anchorStr + `\n${wbCode}`);
  } else {
    const anchorStr = 'export class AppRoot extends TiniComponent {';
    content = content.replace(
      anchorStr,
      anchorStr + `\nonCreate() {${wbCode}}`
    );
  }
  return content;
}
