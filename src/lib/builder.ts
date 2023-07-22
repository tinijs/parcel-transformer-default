import {compileStringAsync} from 'sass';
import {minifyHTMLLiterals} from 'minify-html-literals';

export async function processCode(content: string, isDev: boolean) {
  content = doAssets(content);
  content = doHtml(content, isDev);
  content = await doCss(content, isDev);
  return content;
}

function doHtml(content: string, isDev: boolean) {
  const templateMatching = content.match(/(return html`)([\s\S]*?)(`;)/);
  // dev or no return html`...`
  if (isDev || !templateMatching) return content;
  // minify
  const matchedTemplate = templateMatching[0];
  let minifiedTemplate: string;
  try {
    const result = minifyHTMLLiterals(matchedTemplate);
    if (!result) throw new Error('minifyHTMLLiterals() failed.');
    minifiedTemplate = result.code;
  } catch (err) {
    minifiedTemplate = matchedTemplate;
  }
  return content.replace(matchedTemplate, minifiedTemplate);
}

async function doCss(content: string, isDev: boolean) {
  const stylesMatchingArr = content.match(/(css`)([\s\S]*?)(`,|`;)/g);
  // no css``
  if (!stylesMatchingArr) return content;
  // compile scss
  for (let i = 0; i < stylesMatchingArr.length; i++) {
    const styleMatching = stylesMatchingArr[i];
    // original
    let originalStyles = styleMatching.replace('css`', '');
    originalStyles = originalStyles.substring(0, originalStyles.length - 2);
    // compile
    let compiledStyles: string;
    try {
      compiledStyles = (
        await compileStringAsync(originalStyles, {
          style: isDev ? 'expanded' : 'compressed',
        })
      ).css;
    } catch (err) {
      compiledStyles = isDev
        ? originalStyles
        : originalStyles.replace(/(?:\r\n|\r|\n)/g, '').replace(/\s\s+/g, ' ');
    }
    // replacing
    content = content.replace(originalStyles, compiledStyles);
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
    'ttf',
    'otf',
    'woff2?',
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
  const validator = new RegExp(`\\.(${formats.join('|')})`, 'i');
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
