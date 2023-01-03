import {Transformer} from '@parcel/plugin';
import {loadTSConfig} from '@parcel/ts-utils';

import {transpile} from './lib/transpile';
import {processSourceMap} from './lib/sourcemap';

export default new Transformer({
  loadConfig({config, options}) {
    return loadTSConfig(config, options);
  },
  async transform({asset, config, options}) {
    asset.type = 'js';
    const code = await asset.getCode();

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
