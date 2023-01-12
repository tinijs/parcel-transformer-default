# TiniJS Default Transformer

A ParcelJS transformer for default TiniJS apps.

## Install & usage

This package will be installed automatically by the `@tinijs/cli`.

Use in the `.parcelrc`

```js
{
  "extends": "@parcel/config-default",
  "transformers": {
    "*.{ts,tsx}": ["@tinijs/parcel-transformer-default"]
  }
}
```

For more, please visit: <https://tinijs.dev>

## Development

- Create a home for TiniJS: `mkdir TiniJS && cd TiniJS`
- Fork the repo: `git clone https://github.com/tinijs/parcel-transformer-default.git`
- Install dependencies: `cd parcel-transformer-default && npm i`
- Make changes & build locally: `npm run build && npm pack`
- Push changes & create a PR 👌

## License

**@tinijs/parcel-transformer-default** is released under the [MIT](https://github.com/tinijs/parcel-transformer-default/blob/master/LICENSE) license.
