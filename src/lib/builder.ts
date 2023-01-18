import {compileStringAsync} from 'sass';

import {TiniConfig} from './types';
import {loadSoul} from './unistylus';

export async function processCode(content: string, tiniConfig: TiniConfig) {
  content = doAssets(content);
  content = doHtml(content);
  content = await doUnistylus(content, tiniConfig);
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
  const stylesMatchingArr = content.match(/(css`)([\s\S]*?)(`,|`;)/g);
  if (stylesMatchingArr) {
    for (let i = 0; i < stylesMatchingArr.length; i++) {
      const styleMatching = stylesMatchingArr[i];
      let originalStyles = styleMatching.replace('css`', '');
      originalStyles = originalStyles.substring(0, originalStyles.length - 2);
      const {css: compiledStyles} = await compileStringAsync(originalStyles);
      content = content.replace(originalStyles, compiledStyles);
    }
  }
  // has styling
  const stylingStr = 'styling() {';
  const hasStyling = content.indexOf(stylingStr) !== -1;
  if (hasStyling) {
    content = content.replace(stylingStr, 'static get styles() {');
  }
  // result
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

async function doUnistylus(content: string, tiniConfig: TiniConfig) {
  const htmlMatchingArr = content.match(/(html`)([\s\S]*?)(`;)/g);
  const unistylusMatching = content.match(/(unistylus`)([\s\S]*?)(`)/);
  if (!htmlMatchingArr || !unistylusMatching) return content;
  // import css()
  const hasCss = content.match(/(css`)([\s\S]*?)(`)/);
  if (!hasCss && unistylusMatching) {
    content = content.replace('unistylus', 'css');
  }
  // extract tags and classes
  const tags = [] as string[];
  const classes = [] as string[];
  // class="..."
  for (let i = 0; i < htmlMatchingArr.length; i++) {
    const htmlMatching = htmlMatchingArr[i];
    tags.push(...extractHTMLTags(htmlMatching)); // native tags
    classes.push(...extractHTMLClasses(htmlMatching)); // custom classes
  }
  // ${classMap(...)}
  classes.push(...extractClassMapClasses(content));
  // additional Unistylus classes
  classes.push(...unistylusMatching[2].replace(/\s\s+/g, ' ').split(' '));
  // filter blank
  // construct the style and patch the content,
  const {native, custom} = await loadSoul(tiniConfig);
  const nativeStyles = constructNativeStyles(tags, native);
  const customStyles = constructCustomStyles(
    classes.filter(item => !!item),
    custom
  );
  content = content.replace(
    unistylusMatching[0],
    `css\`${nativeStyles + '\n' + customStyles}\``
  );
  // result
  return content;
}

function extractHTMLTags(htmlContent: string) {
  const tags = new Set<string>();
  const tagsMatchingArr = htmlContent.match(/<[a-zA-Z]+(>|.*?[^?]>)/gi);
  if (tagsMatchingArr) {
    for (let i = 0; i < tagsMatchingArr.length; i++) {
      let [tag] = tagsMatchingArr[i].replace(/\s\s+/g, ' ').split(' ');
      tag = tag.replace(/<|>/g, '');
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
        .replace(/(class=)|((\$\{)([\s\S]*?)(\}))|(\))|(\})|(")/g, '')
        .replace(/\s\s+/g, ' ')
        .split(' ');
      for (let j = 0; j < arr.length; j++) {
        classes.add(arr[j]);
      }
    }
  }
  return Array.from(classes);
}

function extractClassMapClasses(content: string) {
  const classMapMatchingArr = content.match(
    /(\$\{classMap\(\{)([\s\S]*?)(\}\)\})/g
  );
  if (!classMapMatchingArr) return [];
  const classes = new Set<string>();
  for (let i = 0; i < classMapMatchingArr.length; i++) {
    const classMapMatching = classMapMatchingArr[i];
    let arr = classMapMatching
      .replace(/\s\s+/g, '')
      .replace(/(:)([\s\S]*?)(,)/g, '|')
      .replace(/(\n|'|"|`|\$|\(|\)|\{|\}|classMap)/g, '')
      .split('|')
      .map(item => item.trim());
    arr ||= [];
    for (let j = 0; j < arr.length; j++) {
      classes.add(arr[j]);
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
    const byTag = native[tags[i]];
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
    const byClass = custom[classes[i]];
    if (byClass) {
      resultArr.push(byClass);
    }
  }
  // result
  return resultArr.join('\n');
}
