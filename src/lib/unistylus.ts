import {promisify} from 'util';
import {resolve} from 'path';
import {stat, readdir, readFile} from 'fs';

const statAsync = promisify(stat);
const readdirAsync = promisify(readdir);
const readFileAsync = promisify(readFile);

interface SoulData {
  native: Record<string, string>;
  custom: Record<string, string>;
}

export async function loadSoul() {
  const projectSoulPath = resolve('styles', 'unistylus');
  // get data
  let result = (global as any).___unistylusSoul;
  if (!result) {
    if (await statAsync(projectSoulPath)) {
      result = await loadProjectSoul(projectSoulPath);
    } else {
      result = await load3rdPartySoul();
    }
  }
  // result
  return ((global as any).___unistylusSoul = result) as SoulData;
}

async function loadProjectSoul(soulPath: string): Promise<SoulData> {
  const nativePath = resolve(soulPath, 'native');
  const customPath = resolve(soulPath, 'custom');
  return {
    native: await extractStyles(nativePath),
    custom: await extractStyles(customPath),
  };
}

async function load3rdPartySoul(): Promise<SoulData> {
  // TODO: soul from Unistylus official or elsewhere
  return {
    native: {},
    custom: {},
  };
}

async function extractStyles(folderPath: string) {
  const result: Record<string, string> = {};
  if (await statAsync(folderPath)) {
    const filePaths = await readdirAsync(folderPath);
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = resolve(folderPath, filePaths[i]);
      const fileName = (filePath.replace(/\\/, '/').split('/').pop() as string)
        .split('.')
        .shift() as string;
      const fileContent = await readFileAsync(filePath);
      result[fileName] = fileContent.toString('utf8');
    }
  }
  return result;
}
