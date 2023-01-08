import {compileStringAsync} from 'sass';
import {loadSoul} from './unistylus';

export async function processCode(content: string) {
  content = doAssets(content);
  content = doHtml(content);
  content = await doUnistylus(content);
  content = await doCss(content);
  return content;
}

function doHtml(content: string) {
  const hasRender = content.indexOf('render() {') !== -1;
  const templateMatching = content.match(/(template = html`)([\s\S]*?)(`;)/);
  if (!hasRender && templateMatching) {
    const matchedTemplate = templateMatching[0];
    const newTemplate =
      matchedTemplate.replace('template =', 'render() {\n  return') + '}';
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

async function doUnistylus(content: string) {
  const htmlMatching = content.match(/(html`)([\s\S]*?)(`)/);
  const unistylusMatching = content.match(/(unistylus`)([\s\S]*?)(`)/);
  if (!htmlMatching || !unistylusMatching) return content;
  const htmlContent = htmlMatching[2];
  const tags = extractHTMLTags(htmlContent); // native tags
  const classes = extractHTMLClasses(htmlContent); // custom classes
  const unistylusClasses = unistylusMatching[2]
    .split('\n')
    .map(item => item.trim()); // additional Unistylus classes
  // construct the style and patch the content,
  const {native, custom} = await loadSoul();
  const nativeStyles = constructNativeStyles(tags, native);
  const customStyles = constructCustomStyles(
    [...classes, ...unistylusClasses],
    custom
  );
  const styles = `${nativeStyles}\n${customStyles}`;
  content = content.replace(unistylusMatching[0], `css\`${styles}\`,`);
  // result
  return content;
}

function extractHTMLTags(htmlContent: string) {
  const tags = new Set<string>();
  const tagsMatchingArr = htmlContent.match(/<[a-zA-Z]+(>|.*?[^?]>)/gi);
  if (tagsMatchingArr) {
    for (let i = 0; i < tagsMatchingArr.length; i++) {
      let [tag] = tagsMatchingArr[i].split(' ');
      tag = tag.replace('<', '');
      tags.add(tag);
    }
  }
  return Array.from(tags);
}

function extractHTMLClasses(htmlContent: string) {
  const classes = new Set<string>();
  const classesMatchingArr = htmlContent.match(/(class=")([\s\S]*?)(")/g);
  if (classesMatchingArr) {
    for (let i = 0; i < classesMatchingArr.length; i++) {
      const arr = classesMatchingArr[i]
        .replace(/(class=")|(")/g, '')
        .split(' ');
      for (let j = 0; j < arr.length; j++) {
        classes.add(arr[j]);
      }
    }
  }
  return Array.from(classes);
}

function constructNativeStyles(tags: string[], native: Record<string, string>) {
  const resultArr = [] as string[];
  // for all
  const forAll = native['*'];
  if (forAll) {
    resultArr.push(forAll);
  }
  // by tag
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const byTag = native[tag];
    if (byTag) {
      resultArr.push(byTag);
    }
  }
  // result
  return resultArr.join('\n');
}

function constructCustomStyles(
  classes: string[],
  custom: Record<string, string>
) {
  const resultArr = [] as string[];
  // by class
  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i];
    const byClass = custom[cls];
    if (byClass) {
      resultArr.push(byClass);
    }
  }
  // result
  return resultArr.join('\n');
}
