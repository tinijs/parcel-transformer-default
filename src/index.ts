/* eslint-disable @typescript-eslint/no-explicit-any */
import {Transformer} from '@parcel/plugin';
import {loadTSConfig} from '@parcel/ts-utils';

import {TiniConfig} from './lib/types';
import {transpile} from './lib/transpile';
import {processSourceMap} from './lib/sourcemap';
import {changeConfigs} from './lib/config';
import {processCode} from './lib/builder';
import {injectPWA} from './lib/pwa';

const CONFIG_PATH = 'tini.config.json';

function isDevEnv(nodeEnv?: string) {
  return nodeEnv === 'development';
}

function isAppEntry(filePath: string) {
  return filePath.indexOf('app/app.ts') !== -1;
}

export default new Transformer({
  async loadConfig({config, options}) {
    const tsConfig = await loadTSConfig(config, options);
    const configs = await config.getConfig([CONFIG_PATH]);
    const tiniConfig = {
      out: 'www',
      componentPrefix: 'app',
      pwa: {},
      ...((configs as any)?.contents || {}),
    };
    return {tsConfig, tiniConfig};
  },
  async transform({asset, config, options}) {
    const {tsConfig, tiniConfig} = config as {
      tsConfig: any;
      tiniConfig: TiniConfig;
    };
    const isDev = isDevEnv(process.env.NODE_ENV);
    const isMain = isAppEntry(asset.filePath);

    // the asset
    asset.type = 'js';
    let code = await asset.getCode();

    // configs
    if (!isDev) {
      code = changeConfigs(code);
    }

    // assets, html, css
    code = await processCode(code, isDev);

    // pwa
    if (Object.keys(tiniConfig.pwa).length && isMain) {
      code = injectPWA(code);
    }

    // transpile and finalize
    const transpiled = transpile(code, asset, tsConfig);
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
