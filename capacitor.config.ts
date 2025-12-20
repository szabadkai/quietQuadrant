import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "com.quietquadrant.game",
    appName: "Quiet Quadrant",
    webDir: "dist",
    ios: {
        contentInset: "automatic",
        preferredContentMode: "mobile",
        backgroundColor: "#000000",
    },
    android: {
        backgroundColor: "#000000",
        allowMixedContent: true,
        // Enable edge-to-edge display for tall aspect ratio devices
        webContentsDebuggingEnabled: false,
    },
    server: {
        androidScheme: "https",
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: "#000000",
            showSpinner: false,
            splashFullScreen: true,
            splashImmersive: true,
        },
        StatusBar: {
            style: "dark",
            backgroundColor: "#00000000",
            overlaysWebView: true,
        },
    },
};

export default config;
