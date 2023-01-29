import {resolve} from 'path';
import {readdir, exists, readFile, readJson, outputFile} from 'fs-extra';
import * as recursiveReaddir from 'recursive-readdir';

import {TiniConfig} from './types';

interface AutoImportDef {
  name: string;
  members: Array<[string, string, string?]>;
}

const TINI_DIR = '.tini';
const TINI_NPM_DIR = 'node_modules/@tinijs';
const tiniPath = resolve(TINI_DIR);
const tiniNPMPath = resolve(TINI_NPM_DIR);

const APP_DIR = 'app';
const LAYOUTS_DIR = 'layouts';
const PAGES_DIR = 'pages';
const COMPONENTS_DIR = 'components';
const CONSTS_DIR = 'consts';
const HELPERS_DIR = 'helpers';
const SERVICES_DIR = 'services';

export async function injectAutoImports(content: string) {
  const autoImports = await buildAutoImportsContent();
  return autoImports + '\n' + content;
}

export async function injectAutoDependencies(
  content: string,
  assetPath: string
) {
  const typesDef = await loadTypesDef();
  const statesDef = await loadStatesDef();
  const dependencyDef = await loadDependencyDefs();
  const isApp = assetPath.indexOf(`${APP_DIR}/`) !== -1;
  const isConst = assetPath.indexOf(`${CONSTS_DIR}/`) !== -1;
  const isHelper = assetPath.indexOf(`${HELPERS_DIR}/`) !== -1;
  const isService = assetPath.indexOf(`${SERVICES_DIR}/`) !== -1;
  const autoDependenciesArr = [] as string[];
  // types
  if (typesDef.types?.length) {
    autoDependenciesArr.push(
      `import {${typesDef.types.map(item => item[0]).join(',')}} from '${
        isApp ? '.' : '..'
      }/${!isApp ? typesDef.path : typesDef.path.replace(`${APP_DIR}/`, '')}';`
    );
  }
  // states
  if (statesDef.types?.length) {
    autoDependenciesArr.push(
      `import {${statesDef.types.map(item => item[0]).join(',')}} from '${
        isApp ? '.' : '..'
      }/${
        !isApp ? statesDef.path : statesDef.path.replace(`${APP_DIR}/`, '')
      }';`
    );
  }
  // cosnt
  const constDefs = dependencyDef.constDefs;
  constDefs.forEach(({path, name: member}) => {
    autoDependenciesArr.push(
      `import {${member}} from '${isConst ? '.' : '..'}/${
        !isConst ? path : path.replace(`${CONSTS_DIR}/`, '')
      }';`
    );
  });
  // helper
  const helperDefs = dependencyDef.helperDefs;
  helperDefs.forEach(({path, name: member}) => {
    autoDependenciesArr.push(
      `import {${member}} from '${isHelper ? '.' : '..'}/${
        !isHelper ? path : path.replace(`${HELPERS_DIR}/`, '')
      }';`
    );
  });
  // service
  const serviceDefs = dependencyDef.serviceDefs;
  serviceDefs.forEach(({path, name: member}) => {
    autoDependenciesArr.push(
      `import {${member}} from '${isService ? '.' : '..'}/${
        !isService ? path : path.replace(`${SERVICES_DIR}/`, '')
      }';`
    );
  });
  // result
  const autoDependencies = autoDependenciesArr.join('\n');
  return autoDependencies + '\n' + content;
}

export async function injectAutoComponents(
  content: string,
  assetPath: string,
  tiniConfig: TiniConfig
) {
  const prefix = tiniConfig.componentPrefix;
  const isComponent = assetPath.indexOf(`${COMPONENTS_DIR}/`) !== -1;
  const customTags = extractCustomHTMLTags(content, prefix);
  const autoComponents = customTags
    .map(tag => {
      const name = tag.replace(`${prefix}-`, '');
      return `import '${isComponent ? '.' : `../${COMPONENTS_DIR}`}/${name}';`;
    })
    .filter(statement => content.indexOf(statement) === -1)
    .join('\n');
  return autoComponents + '\n' + content;
}

export async function outputDTSFiles(tiniConfig: TiniConfig) {
  await saveVendorsDTS();
  await saveDependenciesDTS();
  await saveComponentsDTS(tiniConfig);
  await saveTiniDTS();
}

function saveTiniDTS() {
  return outputFile(
    resolve(tiniPath, 'tini.d.ts'),
    `/* eslint-disable @typescript-eslint/triple-slash-reference */

/// <reference path="vendors.d.ts" />
/// <reference path="dependencies.d.ts" />
/// <reference path="components.d.ts" />

export {};
`
  );
}

async function saveVendorsDTS() {
  const vendorsDTSContent = await buildVendorsDTSContent();
  await outputFile(resolve(tiniPath, 'vendors.d.ts'), vendorsDTSContent);
}

async function saveDependenciesDTS() {
  const dependenciesDTSContent = await buildDependenciesDTSContent();
  await outputFile(
    resolve(tiniPath, 'dependencies.d.ts'),
    dependenciesDTSContent
  );
}

async function saveComponentsDTS(tiniConfig: TiniConfig) {
  const componentsDTSContent = await buildComponentsDTSContent(tiniConfig);
  await outputFile(resolve(tiniPath, 'components.d.ts'), componentsDTSContent);
}

async function buildComponentsDTSContent(tiniConfig: TiniConfig) {
  // pre-processing
  const imps: string[] = [];
  const tagMap: string[] = [];
  [
    loadAppRoot(),
    ...(await loadComponentAlikes('layout', LAYOUTS_DIR)),
    ...(await loadComponentAlikes('page', PAGES_DIR)),
    ...(await loadComponentAlikes(
      'component',
      COMPONENTS_DIR,
      tiniConfig.componentPrefix
    )),
  ].forEach(({tag, cls, path}) => {
    imps.push(`import {${cls}} from '../../${path}';`);
    tagMap.push(`    '${tag}': ${cls};`);
  });
  // construct contents
  const componentsDTSContent = `${imps.join('\n')}

declare global {
  interface HTMLElementTagNameMap {
${tagMap.join('\n')}
  }
}

export {};
`;
  return componentsDTSContent;
}

function loadAppRoot() {
  return {
    tag: 'app-root',
    cls: 'AppRoot',
    path: 'app/app',
  };
}

async function loadComponentAlikes(
  type: string,
  dir: string,
  componentPrefix = 'app'
) {
  const paths = await recursiveReaddir(resolve(dir));
  return paths
    .filter(item => item.indexOf('.ts') !== -1)
    .map(item => {
      const path = item
        .replace(/\\/g, '/')
        .split(`${dir}/`)
        .pop()
        ?.replace('.ts', '');
      const fileName = (path || '').split('/').pop();
      const tag = `${
        type !== 'component' ? type : componentPrefix
      }-${fileName}`;
      const clsName = fileName
        ?.split('-')
        .map(item => item[0].toUpperCase() + item.substring(1))
        .join('');
      const cls = `${clsName}${type[0].toUpperCase() + type.substring(1)}`;
      return {tag, cls, path};
    });
}

async function loadAutoImports() {
  const dirs = await readdir(tiniNPMPath);
  // extract data
  const autoImportDefs = [] as AutoImportDef[];
  for (let i = 0; i < dirs.length; i++) {
    const defPath = resolve(tiniNPMPath, dirs[i], 'auto-imports.json');
    if (!(await exists(defPath))) continue;
    autoImportDefs.push(await readJson(defPath));
  }
  // result
  return autoImportDefs;
}

async function buildAutoImportsContent() {
  const autoImportDefs = await loadAutoImports();
  return autoImportDefs
    .map(
      ({name, members}) =>
        `import {${members.map(item => item[1]).join(',')}} from '${name}';`
    )
    .join('\n');
}

async function buildVendorsDTSContent() {
  const autoImportDefs = await loadAutoImports();
  const declares = [] as string[];
  const imports = [] as string[];
  autoImportDefs.forEach(({name, members}) => {
    const imps = [] as string[];
    members.forEach(item => {
      const [type, member, generics = ''] = item;
      const importedMember = `${member}_`;
      imps.push(`${member} as ${importedMember}`);
      declares.push(
        type === 'type'
          ? `  type ${member}${generics} = ${importedMember}${generics};`
          : type === 'class'
          ? `  class ${member}${generics} extends ${importedMember}${generics} {};`
          : `  const ${member}: typeof ${importedMember};`
      );
    });
    imports.push(`import {${imps.join(', ')}} from '${name}';`);
  });
  return `
${imports.join('\n')}

declare global {
${declares.join('\n')}
}

export {};
`;
}

function extractCustomHTMLTags(content: string, componentPrefix = 'app') {
  const tags = new Set<string>();
  const tagsMatchingArr = content.match(
    new RegExp(`<${componentPrefix}-[a-zA-Z]+(>|.*?[^?]>)`, 'gi')
  );
  if (tagsMatchingArr) {
    for (let i = 0; i < tagsMatchingArr.length; i++) {
      let [tag] = tagsMatchingArr[i].replace(/\s\s+/g, ' ').split(' ');
      tag = tag.replace(/<|>/g, '');
      tags.add(tag);
    }
  }
  return Array.from(tags);
}

async function buildDependenciesDTSContent() {
  const typesDef = await loadTypesDef();
  const statesDef = await loadStatesDef();
  const dependencyDef = await loadDependencyDefs();
  const declares = [] as string[];
  const imports = [] as string[];
  // types
  if (typesDef.types?.length) {
    const imps = [] as string[];
    typesDef.types.forEach(item => {
      const [member, generics = ''] = item;
      const importedMember = `${member}_`;
      imps.push(`${member} as ${importedMember}`);
      declares.push(
        `  type ${member}${generics} = ${importedMember}${generics};`
      );
    });
    imports.push(`import {${imps.join(', ')}} from '../${typesDef.path}';`);
  }
  // states
  if (statesDef.types?.length) {
    const imps = [] as string[];
    statesDef.types.forEach(item => {
      const [member, generics = ''] = item;
      const importedMember = `${member}_`;
      imps.push(`${member} as ${importedMember}`);
      declares.push(
        `  type ${member}${generics} = ${importedMember}${generics};`
      );
    });
    imports.push(`import {${imps.join(', ')}} from '../${statesDef.path}';`);
  }
  // cosnt
  const constDefs = dependencyDef.constDefs;
  constDefs.forEach(({path, name: member}) => {
    const importedMember = `${member}_`;
    imports.push(`import {${member} as ${importedMember}} from '../${path}';`);
    declares.push(`  type ${member} = ${importedMember};`);
  });
  // helper
  const helperDefs = dependencyDef.helperDefs;
  helperDefs.forEach(({path, name: member}) => {
    const importedMember = `${member}_`;
    imports.push(`import {${member} as ${importedMember}} from '../${path}';`);
    declares.push(`  type ${member} = ${importedMember};`);
  });
  // service
  const serviceDefs = dependencyDef.serviceDefs;
  serviceDefs.forEach(({path, name: member}) => {
    const importedMember = `${member}_`;
    imports.push(`import {${member} as ${importedMember}} from '../${path}';`);
    declares.push(`  class ${member} extends ${importedMember} {};`);
  });
  // result
  return `
${imports.join('\n')}

declare global {
${declares.join('\n')}
}

export {};
`;
}

async function loadTypesDef() {
  const typesTSPath = resolve(APP_DIR, 'types.ts');
  const typesTSExportsSet = new Set<[string, string?]>();
  if (await exists(typesTSPath)) {
    const typesTSContent = (await readFile(typesTSPath)).toString('utf8');
    const typeMatchingArr = typesTSContent.match(
      /(export type )([\s\S]*?)( =)/g
    );
    if (typeMatchingArr) {
      typeMatchingArr.forEach(item => {
        item = item.replace(/((export type )|( =))/g, '');
        const [name, ...genericsArr] = item.split('<');
        typesTSExportsSet.add([
          name,
          !genericsArr.length ? undefined : '<' + genericsArr.join('<'),
        ]);
      });
    }
    const interfaceMatchingArr = typesTSContent.match(
      /(export interface )([\s\S]*?)(( {)|( extends))/g
    );
    if (interfaceMatchingArr) {
      interfaceMatchingArr.forEach(item => {
        item = item.replace(/((export interface )|( {)|( extends))/g, '');
        const [name, ...genericsArr] = item.split('<');
        typesTSExportsSet.add([
          name,
          !genericsArr.length ? undefined : '<' + genericsArr.join('<'),
        ]);
      });
    }
  }
  const path = `${APP_DIR}/types`;
  const types = Array.from(typesTSExportsSet);
  return {path, types};
}

async function loadStatesDef() {
  const path = `${APP_DIR}/states`;
  const types = [['States'], ['Store']];
  return {path, types};
}

async function loadDependencyDefs() {
  // helpers
  const processPaths = (paths: string[], dir: string, suffix = '') => {
    return paths
      .filter(item => item.indexOf('.ts') !== -1)
      .map(item => {
        const path = item
          .replace(/\\/g, '/')
          .split(`${dir}/`)
          .pop()
          ?.replace('.ts', '');
        const fileName = (path || '').split('/').pop();
        const clsName = fileName
          ?.split('-')
          .map(item => item[0].toUpperCase() + item.substring(1))
          .join('');
        const name = `${clsName}${suffix}`;
        return {name, path: `${dir}/${path}`};
      });
  };
  // const
  const constFiles = await recursiveReaddir(resolve(CONSTS_DIR));
  const constDefs = processPaths(constFiles, CONSTS_DIR);
  // helper
  const helperFiles = await recursiveReaddir(resolve(HELPERS_DIR));
  const helperDefs = processPaths(helperFiles, HELPERS_DIR);
  // services
  const serviceFiles = await recursiveReaddir(resolve(SERVICES_DIR));
  const serviceDefs = processPaths(serviceFiles, SERVICES_DIR, 'Service');
  // result
  return {constDefs, helperDefs, serviceDefs};
}
