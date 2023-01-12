import {resolve} from 'path';
import {exists, readdir, readFile} from 'fs-extra';

interface SoulData {
  native: Record<string, string>;
  custom: Record<string, string>;
}

export async function loadSoul() {
  const projectNativePath = resolve('styles', 'native');
  const projectCustomPath = resolve('styles', 'custom');
  // get data
  let result = (global as any).___unistylusSoul;
  if (!result) {
    if (
      (await exists(projectNativePath)) ||
      (await exists(projectCustomPath))
    ) {
      result = await loadProjectSoul(projectNativePath, projectCustomPath);
    } else {
      result = await load3rdPartySoul();
    }
  }
  // result
  return ((global as any).___unistylusSoul = result) as SoulData;
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

async function load3rdPartySoul(): Promise<SoulData> {
  // TODO: soul from Unistylus official or elsewhere
  return {
    native: {},
    custom: {},
  };
}

async function extractStyles(folderPath: string) {
  const result: Record<string, string> = {};
  if (await exists(folderPath)) {
    const filePaths = await readdir(folderPath);
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = resolve(folderPath, filePaths[i]);
      const fileName = (filePath.replace(/\\/, '/').split('/').pop() as string)
        .split('.')
        .shift() as string;
      const fileContent = await readFile(filePath);
      result[fileName] = fileContent.toString('utf8');
    }
  }
  return result;
}
