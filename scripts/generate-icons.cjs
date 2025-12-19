#!/usr/bin/env node

/**
 * Generate all app icons from source logo
 * - Electron: icon.png, icon.ico, icon.icns
 * - iOS: AppIcon
 * - Android: mipmap icons
 * - Web: favicon
 *
 * Usage: node scripts/generate-icons.cjs
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const pngToIcoModule = require("png-to-ico");
const pngToIco = pngToIcoModule.default || pngToIcoModule;

const SOURCE_LOGO = path.join(__dirname, "../public/logo.jpg");
const BUILD_DIR = path.join(__dirname, "../build-resources");
const PUBLIC_DIR = path.join(__dirname, "../public");

// Electron icon sizes
const ELECTRON_SIZES = [16, 32, 64, 128, 256, 512, 1024];

// Android icon sizes
const ANDROID_ICONS = [
    { size: 48, folder: "mipmap-mdpi" },
    { size: 72, folder: "mipmap-hdpi" },
    { size: 96, folder: "mipmap-xhdpi" },
    { size: 144, folder: "mipmap-xxhdpi" },
    { size: 192, folder: "mipmap-xxxhdpi" },
];

const ANDROID_RES_DIR = path.join(__dirname, "../android/app/src/main/res");
const IOS_ICON_DIR = path.join(
    __dirname,
    "../ios/App/App/Assets.xcassets/AppIcon.appiconset"
);

async function generateElectronIcons() {
    console.log("\n💻 Generating Electron icons...");

    if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR, { recursive: true });
    }

    // Generate PNG icons at various sizes
    for (const size of ELECTRON_SIZES) {
        const outputPath = path.join(BUILD_DIR, `icon-${size}.png`);
        await sharp(SOURCE_LOGO)
            .resize(size, size, { fit: "cover", position: "center" })
            .png()
            .toFile(outputPath);
        console.log(`  ✅ icon-${size}.png`);
    }

    // Copy 256 as main icon.png
    await sharp(SOURCE_LOGO)
        .resize(256, 256, { fit: "cover", position: "center" })
        .png()
        .toFile(path.join(BUILD_DIR, "icon.png"));
    console.log("  ✅ icon.png (256x256)");

    // Generate ICO for Windows
    const icoSizes = [16, 32, 48, 64, 128, 256];
    const icoBuffers = await Promise.all(
        icoSizes.map((size) =>
            sharp(SOURCE_LOGO)
                .resize(size, size, { fit: "cover", position: "center" })
                .png()
                .toBuffer()
        )
    );

    const icoBuffer = await pngToIco(icoBuffers);
    fs.writeFileSync(path.join(BUILD_DIR, "icon.ico"), icoBuffer);
    console.log("  ✅ icon.ico");

    // Generate ICNS for macOS (using iconset folder)
    const iconsetDir = path.join(BUILD_DIR, "icon.iconset");
    if (!fs.existsSync(iconsetDir)) {
        fs.mkdirSync(iconsetDir, { recursive: true });
    }

    const icnsSizes = [
        { size: 16, name: "icon_16x16.png" },
        { size: 32, name: "icon_16x16@2x.png" },
        { size: 32, name: "icon_32x32.png" },
        { size: 64, name: "icon_32x32@2x.png" },
        { size: 128, name: "icon_128x128.png" },
        { size: 256, name: "icon_128x128@2x.png" },
        { size: 256, name: "icon_256x256.png" },
        { size: 512, name: "icon_256x256@2x.png" },
        { size: 512, name: "icon_512x512.png" },
        { size: 1024, name: "icon_512x512@2x.png" },
    ];

    for (const { size, name } of icnsSizes) {
        await sharp(SOURCE_LOGO)
            .resize(size, size, { fit: "cover", position: "center" })
            .png()
            .toFile(path.join(iconsetDir, name));
    }
    console.log("  ✅ icon.iconset/ (for iconutil)");
}

async function generateAndroidIcons() {
    console.log("\n🤖 Generating Android icons...");

    if (!fs.existsSync(ANDROID_RES_DIR)) {
        console.log("  ⚠️  Android directory not found, skipping...");
        return;
    }

    for (const icon of ANDROID_ICONS) {
        const outputDir = path.join(ANDROID_RES_DIR, icon.folder);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate launcher icon
        await sharp(SOURCE_LOGO)
            .resize(icon.size, icon.size, { fit: "cover", position: "center" })
            .png()
            .toFile(path.join(outputDir, "ic_launcher.png"));

        // Generate round icon
        await sharp(SOURCE_LOGO)
            .resize(icon.size, icon.size, { fit: "cover", position: "center" })
            .png()
            .toFile(path.join(outputDir, "ic_launcher_round.png"));

        // Generate foreground for adaptive icon
        const foregroundSize = Math.round(icon.size * 1.5);
        const innerSize = Math.round(icon.size * 0.66);
        const padding = Math.round((foregroundSize - innerSize) / 2);

        await sharp(SOURCE_LOGO)
            .resize(innerSize, innerSize, { fit: "cover", position: "center" })
            .extend({
                top: padding,
                bottom: padding,
                left: padding,
                right: padding,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .resize(foregroundSize, foregroundSize)
            .png()
            .toFile(path.join(outputDir, "ic_launcher_foreground.png"));

        console.log(`  ✅ ${icon.folder}/`);
    }
}

async function generateIOSIcon() {
    console.log("\n📱 Generating iOS icon...");

    if (!fs.existsSync(path.dirname(IOS_ICON_DIR))) {
        console.log("  ⚠️  iOS directory not found, skipping...");
        return;
    }

    if (!fs.existsSync(IOS_ICON_DIR)) {
        fs.mkdirSync(IOS_ICON_DIR, { recursive: true });
    }

    // Modern iOS only needs 1024x1024
    const filename = "AppIcon-1024.png";
    await sharp(SOURCE_LOGO)
        .resize(1024, 1024, { fit: "cover", position: "center" })
        .png()
        .toFile(path.join(IOS_ICON_DIR, filename));
    console.log(`  ✅ ${filename}`);

    // Write Contents.json
    const contents = {
        images: [
            {
                filename,
                idiom: "universal",
                platform: "ios",
                size: "1024x1024",
            },
        ],
        info: { author: "xcode", version: 1 },
    };

    fs.writeFileSync(
        path.join(IOS_ICON_DIR, "Contents.json"),
        JSON.stringify(contents, null, 2)
    );
    console.log("  ✅ Contents.json");
}

async function generateFavicon() {
    console.log("\n🌐 Generating web favicon...");

    // Generate favicon.ico (multi-size)
    const faviconSizes = [16, 32, 48];
    const faviconBuffers = await Promise.all(
        faviconSizes.map((size) =>
            sharp(SOURCE_LOGO)
                .resize(size, size, { fit: "cover", position: "center" })
                .png()
                .toBuffer()
        )
    );

    const faviconBuffer = await pngToIco(faviconBuffers);
    fs.writeFileSync(path.join(PUBLIC_DIR, "favicon.ico"), faviconBuffer);
    console.log("  ✅ public/favicon.ico");

    // Generate favicon.png (32x32)
    await sharp(SOURCE_LOGO)
        .resize(32, 32, { fit: "cover", position: "center" })
        .png()
        .toFile(path.join(PUBLIC_DIR, "favicon.png"));
    console.log("  ✅ public/favicon.png");

    // Generate apple-touch-icon (180x180)
    await sharp(SOURCE_LOGO)
        .resize(180, 180, { fit: "cover", position: "center" })
        .png()
        .toFile(path.join(PUBLIC_DIR, "apple-touch-icon.png"));
    console.log("  ✅ public/apple-touch-icon.png");
}

async function main() {
    console.log("🎨 Generating icons from:", SOURCE_LOGO);

    if (!fs.existsSync(SOURCE_LOGO)) {
        console.error("❌ Source logo not found:", SOURCE_LOGO);
        process.exit(1);
    }

    const metadata = await sharp(SOURCE_LOGO).metadata();
    console.log(`📐 Source: ${metadata.width}x${metadata.height}`);

    await generateElectronIcons();
    await generateAndroidIcons();
    await generateIOSIcon();
    await generateFavicon();

    console.log("\n✨ Icon generation complete!");
    console.log(
        "\n📝 Note: Run `iconutil -c icns build-resources/icon.iconset` to create icon.icns on macOS"
    );
}

main().catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
});
