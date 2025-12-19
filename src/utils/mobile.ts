import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { ScreenOrientation } from "@capacitor/screen-orientation";

/**
 * Check if running on a native mobile platform (iOS/Android)
 */
export const isNativeMobile = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
    return Capacitor.getPlatform() === "ios";
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
    return Capacitor.getPlatform() === "android";
};

/**
 * Initialize mobile-specific features
 * Call this early in app startup
 */
export const initMobile = async (): Promise<void> => {
    if (!isNativeMobile()) {
        return;
    }

    try {
        // Hide status bar for immersive game experience
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#000000" });

        // Lock to landscape orientation for the game
        await ScreenOrientation.lock({ orientation: "landscape" });

        // Hide splash screen after initialization
        await SplashScreen.hide();
    } catch (error) {
        console.warn("Mobile initialization error:", error);
    }
};

/**
 * Show the splash screen (useful for loading states)
 */
export const showSplash = async (): Promise<void> => {
    if (!isNativeMobile()) return;
    try {
        await SplashScreen.show({ autoHide: false });
    } catch (error) {
        console.warn("Failed to show splash:", error);
    }
};

/**
 * Hide the splash screen
 */
export const hideSplash = async (): Promise<void> => {
    if (!isNativeMobile()) return;
    try {
        await SplashScreen.hide();
    } catch (error) {
        console.warn("Failed to hide splash:", error);
    }
};
