# Default transformer

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

## License

**@tinijs/parcel-transformer-default** is released under the [MIT](https://github.com/tinijs/parcel-transformer-default/blob/master/LICENSE) license.
