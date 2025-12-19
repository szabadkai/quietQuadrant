# Build Resources

Place your app icons here:

-   `icon.png` - 512x512 PNG (used for Linux and as source for others)
-   `icon.ico` - Windows icon (256x256, can include multiple sizes)
-   `icon.icns` - macOS icon (512x512 or 1024x1024)

## Generating Icons

You can use tools like:

-   [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
-   [png2icons](https://www.npmjs.com/package/png2icons)
-   Online converters

Or create a 512x512 PNG and use:

```bash
npx electron-icon-builder --input=icon.png --output=./
```
