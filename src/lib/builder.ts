import {compileStringAsync} from 'sass';

export async function processCode(content: string) {
  content = doAssets(content);
  content = doHtml(content);
  content = await doCss(content);
  return content;
}

function doHtml(content: string) {
  const hasRender = content.indexOf('render() {') !== -1;
  const templateMatching = content.match(
    /(protected template = html`)([\s\S]*?)(`;)/
  );
  if (!hasRender && templateMatching) {
    const matchedTemplate = templateMatching[0];
    const newTemplate =
      matchedTemplate.replace(
        'protected template =',
        'protected render() {\n  return'
      ) + '}';
    content = content.replace(matchedTemplate, newTemplate);
  }
  return content;
}

async function doCss(content: string) {
  const stylesMatchingArr = content.match(/(css`)([\s\S]*?)(`)/g);
  if (stylesMatchingArr) {
    for (let i = 0; i < stylesMatchingArr.length; i++) {
      const styleMatching = stylesMatchingArr[i];
      let originalStyles = styleMatching.replace('css`', '');
      originalStyles = originalStyles.substring(0, originalStyles.length - 1);
      const {css: compiledStyles} = await compileStringAsync(originalStyles);
      content = content.replace(originalStyles, compiledStyles);
    }
  }
  return content;
}

function doAssets(content: string) {
  const formats = [
    // images
    'jpe?g',
    'png',
    'webp',
    'svg',
    'bmp',
    'gif',
    'ico',
    'tiff?',
    // audios
    'mp3',
    'ogg',
    'aac',
    'wav',
    'midi?',
    // videos
    'mp4',
    'webm',
    'flv',
    'm3u8',
    'mpd',
    // fonts
    'woff',
    'woff2',
    // documents
    'txt',
    'md',
    'pdf',
    'docx?',
    'pptx?',
    'xlsx?',
    'odt',
  ];
  const lookups = [
    ['src="', '"'],
    ['srcset="', '"'],
    ['href="', '"'],
    ["url\\('", "'\\)"],
    ["asset\\('", "'\\)"],
  ];
  const validator = new RegExp(`.(${formats.join('|')})`, 'i');
  for (let i = 0; i < lookups.length; i++) {
    const [A, B] = lookups[i];
    const matchingArr = (
      content.match(new RegExp(`(${A})([\\s\\S]*?)(${B})`, 'g')) || []
    ).filter(item => validator.test(item));
    for (let i = 0; i < matchingArr.length; i++) {
      const originalStr = matchingArr[i];
      const url = originalStr
        .replace(A.replace('\\', ''), '')
        .replace(B.replace('\\', ''), '');
      const URL = `new URL('${url}', import.meta.url)`;
      // build new str
      let newStr = originalStr;
      if (/(src|srcset|href)/.test(A)) {
        const newA = A.replace('"', '');
        const newB = '';
        newStr = `${newA}\${${URL}}${newB}`;
      } else if (/(url)/.test(A)) {
        const newA = A.replace(/(\\|')/g, '');
        const newB = ')';
        newStr = `${newA}\${${URL}}${newB}`;
      } else {
        newStr = URL;
      }
      // apply new content
      content = content.replace(originalStr, newStr);
    }
  }
  return content;
}
