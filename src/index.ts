import {Transformer} from '@parcel/plugin';
import {loadTSConfig} from '@parcel/ts-utils';

import {transpile} from './lib/transpile';
import {processSourceMap} from './lib/sourcemap';
import {changeConfigs} from './lib/config';
import {processCode} from './lib/builder';
import {injectPWA} from './lib/pwa';

function isDevEnv(nodeEnv?: string) {
  return nodeEnv !== 'development';
}

function isAppTS(filePath: string) {
  return filePath.indexOf('app/app.ts') !== -1;
}

export default new Transformer({
  loadConfig({config, options}) {
    return loadTSConfig(config, options);
  },
  async transform({asset, config, options}) {
    const isDev = isDevEnv(process.env.NODE_ENV);
    const isMain = isAppTS(asset.filePath);

    asset.type = 'js';
    let code = await asset.getCode();

    // configs
    if (isDev && isMain) {
      code = changeConfigs(code);
    }

    // html, css, assets
    code = await processCode(code);

    // pwa
    if (isMain) {
      code = await injectPWA(code);
    }

    // transpile and finalize
    const transpiled = transpile(code, asset, config);
    const {outputText, map} = processSourceMap(transpiled, options);

    // result
    return [
      {
        type: 'js',
        content: outputText,
        map,
      },
    ];
  },
});
