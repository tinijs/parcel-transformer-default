import {Transformer} from '@parcel/plugin';
import {loadTSConfig} from '@parcel/ts-utils';

import {transpile} from './lib/transpile';
import {processSourceMap} from './lib/sourcemap';
import {processCode} from './lib/builder';

export default new Transformer({
  loadConfig({config, options}) {
    return loadTSConfig(config, options);
  },
  async transform({asset, config, options}) {
    asset.type = 'js';
    let code = await asset.getCode();

    // processing
    code = await processCode(code);

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
