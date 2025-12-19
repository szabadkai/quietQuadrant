#!/usr/bin/env node

/**
 * Generate splash screens for iOS, Android, and Electron from source images
 * Usage: node scripts/generate-splash-screens.cjs
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// Source images - multiple splash screens for variety
const SOURCE_IMAGES = [
    path.join(__dirname, "../public/splash1.png"),
    path.join(__dirname, "../public/splash2.png"),
    path.join(__dirname, "../public/splash3.png"),
    path.join(__dirname, "../public/splash4.png"),
];

// Fallback to original if splash*.png don't exist
const FALLBACK_IMAGE = path.join(
    __dirname,
    "../public/quietQuadrant_splash.jpg"
);

// iOS splash screen sizes (universal 2732x2732 for all devices)
const IOS_SPLASH = {
    outputDir: path.join(
        __dirname,
        "../ios/App/App/Assets.xcassets/Splash.imageset"
    ),
    sizes: [
        { name: "splash-2732x2732.png", width: 2732, height: 2732 },
        { name: "splash-2732x2732-1.png", width: 2732, height: 2732 },
        { name: "splash-2732x2732-2.png", width: 2732, height: 2732 },
    ],
};

// Android splash screen sizes for different densities
const ANDROID_SPLASH = {
    portrait: [
        { dir: "drawable-port-mdpi", width: 320, height: 480 },
        { dir: "drawable-port-hdpi", width: 480, height: 800 },
        { dir: "drawable-port-xhdpi", width: 720, height: 1280 },
        { dir: "drawable-port-xxhdpi", width: 960, height: 1600 },
        { dir: "drawable-port-xxxhdpi", width: 1280, height: 1920 },
    ],
    landscape: [
        { dir: "drawable-land-mdpi", width: 480, height: 320 },
        { dir: "drawable-land-hdpi", width: 800, height: 480 },
        { dir: "drawable-land-xhdpi", width: 1280, height: 720 },
        { dir: "drawable-land-xxhdpi", width: 1600, height: 960 },
        { dir: "drawable-land-xxxhdpi", width: 1920, height: 1280 },
    ],
    base: { dir: "drawable", width: 480, height: 800 },
};

const ANDROID_RES_DIR = path.join(__dirname, "../android/app/src/main/res");
const ELECTRON_BUILD_DIR = path.join(__dirname, "../build-resources");

function getAvailableSourceImages() {
    const available = SOURCE_IMAGES.filter((img) => fs.existsSync(img));
    if (available.length === 0 && fs.existsSync(FALLBACK_IMAGE)) {
        return [FALLBACK_IMAGE];
    }
    return available;
}

function getRandomImage(images) {
    return images[Math.floor(Math.random() * images.length)];
}

async function generateSplashScreens() {
    const sourceImages = getAvailableSourceImages();

    if (sourceImages.length === 0) {
        console.error("❌ No source images found!");
        process.exit(1);
    }

    console.log(`🎨 Found ${sourceImages.length} splash screen image(s)`);
    sourceImages.forEach((img) => console.log(`   - ${path.basename(img)}`));

    // Use first image for mobile (consistent experience)
    const mobileImage = sourceImages[0];
    const metadata = await sharp(mobileImage).metadata();
    console.log(
        `\n📐 Primary image: ${path.basename(mobileImage)} (${metadata.width}x${
            metadata.height
        })`
    );

    // Generate iOS splash screens
    console.log("\n📱 Generating iOS splash screens...");
    if (fs.existsSync(IOS_SPLASH.outputDir)) {
        for (const size of IOS_SPLASH.sizes) {
            const outputPath = path.join(IOS_SPLASH.outputDir, size.name);
            await sharp(mobileImage)
                .resize(size.width, size.height, {
                    fit: "cover",
                    position: "center",
                })
                .png()
                .toFile(outputPath);
            console.log(`  ✅ ${size.name} (${size.width}x${size.height})`);
        }
    } else {
        console.log("  ⚠️  iOS directory not found, skipping...");
    }

    // Generate Android splash screens
    console.log("\n🤖 Generating Android splash screens...");
    if (fs.existsSync(ANDROID_RES_DIR)) {
        // Base drawable
        const baseDir = path.join(ANDROID_RES_DIR, ANDROID_SPLASH.base.dir);
        if (fs.existsSync(baseDir)) {
            await sharp(mobileImage)
                .resize(ANDROID_SPLASH.base.width, ANDROID_SPLASH.base.height, {
                    fit: "cover",
                    position: "center",
                })
                .png()
                .toFile(path.join(baseDir, "splash.png"));
            console.log(`  ✅ drawable/splash.png`);
        }

        // Portrait splash screens
        for (const size of ANDROID_SPLASH.portrait) {
            const dirPath = path.join(ANDROID_RES_DIR, size.dir);
            if (fs.existsSync(dirPath)) {
                await sharp(mobileImage)
                    .resize(size.width, size.height, {
                        fit: "cover",
                        position: "center",
                    })
                    .png()
                    .toFile(path.join(dirPath, "splash.png"));
                console.log(
                    `  ✅ ${size.dir}/splash.png (${size.width}x${size.height})`
                );
            }
        }

        // Landscape splash screens
        for (const size of ANDROID_SPLASH.landscape) {
            const dirPath = path.join(ANDROID_RES_DIR, size.dir);
            if (fs.existsSync(dirPath)) {
                await sharp(mobileImage)
                    .resize(size.width, size.height, {
                        fit: "cover",
                        position: "center",
                    })
                    .png()
                    .toFile(path.join(dirPath, "splash.png"));
                console.log(
                    `  ✅ ${size.dir}/splash.png (${size.width}x${size.height})`
                );
            }
        }
    } else {
        console.log("  ⚠️  Android directory not found, skipping...");
    }

    // Generate ALL Electron splash screens (for random selection at runtime)
    console.log("\n💻 Generating Electron splash screens...");
    if (!fs.existsSync(ELECTRON_BUILD_DIR)) {
        fs.mkdirSync(ELECTRON_BUILD_DIR, { recursive: true });
    }

    for (let i = 0; i < sourceImages.length; i++) {
        const outputPath = path.join(ELECTRON_BUILD_DIR, `splash${i + 1}.png`);
        await sharp(sourceImages[i])
            .resize(600, 400, {
                fit: "cover",
                position: "center",
            })
            .png()
            .toFile(outputPath);
        console.log(`  ✅ splash${i + 1}.png (600x400)`);
    }

    // Write splash count for Electron to know how many are available
    const splashConfig = { count: sourceImages.length };
    fs.writeFileSync(
        path.join(ELECTRON_BUILD_DIR, "splash-config.json"),
        JSON.stringify(splashConfig, null, 2)
    );
    console.log(`  ✅ splash-config.json (${sourceImages.length} images)`);

    console.log("\n✨ Splash screen generation complete!");
}

generateSplashScreens().catch((err) => {
    console.error("❌ Error generating splash screens:", err);
    process.exit(1);
});
