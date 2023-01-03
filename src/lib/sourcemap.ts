import SourceMap from '@parcel/source-map';
import {PluginOptions} from '@parcel/types';
import {TranspileOutput} from 'typescript';

export function processSourceMap(
  transpiled: TranspileOutput,
  options: PluginOptions
) {
  let {outputText} = transpiled;
  const {sourceMapText} = transpiled;
  // processing
  let map;
  if (sourceMapText !== null) {
    map = new SourceMap(options.projectRoot);
    map.addVLQMap(JSON.parse(sourceMapText as string));
    outputText = outputText.substring(
      0,
      outputText.lastIndexOf('//# sourceMappingURL')
    );
  }
  // result
  return {outputText, map};
}
