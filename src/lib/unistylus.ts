import {resolve} from 'path';
import {exists, readFile} from 'fs-extra';
import * as recursiveReaddir from 'recursive-readdir';

import {TiniConfig} from './types';

interface SoulData {
  native: Record<string, string>;
  custom: Record<string, string>;
}

export async function loadSoul(tiniConfig: TiniConfig) {
  const projectNativePath = resolve('styles', 'native');
  const projectCustomPath = resolve('styles', 'custom');
  const localNativeExists = await exists(projectNativePath);
  const localCustomExists = await exists(projectCustomPath);
  // get data
  if (!tiniConfig.unistylus && (localNativeExists || localCustomExists)) {
    return await loadProjectSoul(projectNativePath, projectCustomPath);
  } else if (tiniConfig.unistylus) {
    return await load3rdPartySoul(tiniConfig.unistylus);
  } else {
    return {
      native: {},
      custom: {},
    };
  }
}

async function loadProjectSoul(
  nativePath: string,
  customPath: string
): Promise<SoulData> {
  return {
    native: await extractStyles(nativePath),
    custom: await extractStyles(customPath),
  };
}

async function load3rdPartySoul(path: string): Promise<SoulData> {
  path = path.replace('~', 'node_modules');
  const nativePath = resolve(path, 'native');
  const customPath = resolve(path, 'custom');
  return {
    native: await extractStyles(nativePath),
    custom: await extractStyles(customPath),
  };
}

async function extractStyles(folderPath: string) {
  const result: Record<string, string> = {};
  if (await exists(folderPath)) {
    const filePaths = await recursiveReaddir(folderPath);
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = resolve(filePaths[i]);
      const fileName = (filePath.replace(/\\/, '/').split('/').pop() as string)
        .split('.')
        .shift() as string;
      const fileContent = await readFile(filePath);
      result[fileName] = fileContent.toString('utf8');
    }
  }
  return result;
}
