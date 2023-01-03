import {MutableAsset} from '@parcel/types';
import {transpileModule, ModuleKind} from 'typescript';

export function transpile(code: string, asset: MutableAsset, config: any = {}) {
  return transpileModule(code, {
    compilerOptions: {
      ...config,
      noEmit: false,
      module: ModuleKind.ESNext,
      sourceMap: !!asset.env.sourceMap,
    },
    fileName: asset.filePath,
  });
}
