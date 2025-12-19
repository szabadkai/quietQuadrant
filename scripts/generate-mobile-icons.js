import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const sourceIcon = join(rootDir, "build-resources/icon-1024.png");

// Android icon sizes (adaptive icons use 108dp with 72dp safe zone)
const androidIcons = [
    { size: 48, folder: "mipmap-mdpi" },
    { size: 72, folder: "mipmap-hdpi" },
    { size: 96, folder: "mipmap-xhdpi" },
    { size: 144, folder: "mipmap-xxhdpi" },
    { size: 192, folder: "mipmap-xxxhdpi" },
];

// iOS uses a single 1024x1024 icon (Xcode generates the rest automatically)

async function generateAndroidIcons() {
    console.log("Generating Android icons...");
    const androidResDir = join(rootDir, "android/app/src/main/res");

    for (const icon of androidIcons) {
        const outputDir = join(androidResDir, icon.folder);
        await mkdir(outputDir, { recursive: true });

        // Generate foreground icon
        await sharp(sourceIcon)
            .resize(icon.size, icon.size)
            .toFile(join(outputDir, "ic_launcher.png"));

        // Generate round icon
        await sharp(sourceIcon)
            .resize(icon.size, icon.size)
            .toFile(join(outputDir, "ic_launcher_round.png"));

        // Generate foreground for adaptive icon (108dp with padding)
        const foregroundSize = Math.round(icon.size * 1.5);
        await sharp(sourceIcon)
            .resize(Math.round(icon.size * 0.66), Math.round(icon.size * 0.66))
            .extend({
                top: Math.round((foregroundSize - icon.size * 0.66) / 2),
                bottom: Math.round((foregroundSize - icon.size * 0.66) / 2),
                left: Math.round((foregroundSize - icon.size * 0.66) / 2),
                right: Math.round((foregroundSize - icon.size * 0.66) / 2),
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .resize(foregroundSize, foregroundSize)
            .toFile(join(outputDir, "ic_launcher_foreground.png"));

        console.log(`  ✓ ${icon.folder}`);
    }
}

async function generateIOSIcons() {
    console.log("Generating iOS icon...");
    const iosIconDir = join(
        rootDir,
        "ios/App/App/Assets.xcassets/AppIcon.appiconset"
    );
    await mkdir(iosIconDir, { recursive: true });

    // Modern iOS only needs a single 1024x1024 icon
    const filename = "AppIcon-1024.png";
    await sharp(sourceIcon)
        .resize(1024, 1024)
        .toFile(join(iosIconDir, filename));
    console.log(`  ✓ ${filename}`);

    // Write Contents.json for single universal icon
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

    const { writeFile } = await import("fs/promises");
    await writeFile(
        join(iosIconDir, "Contents.json"),
        JSON.stringify(contents, null, 2)
    );
    console.log("  ✓ Contents.json");
}

async function main() {
    try {
        await generateAndroidIcons();
        await generateIOSIcons();
        console.log("\n✅ Mobile icons generated successfully!");
    } catch (error) {
        console.error("Error generating icons:", error);
        process.exit(1);
    }
}

main();
