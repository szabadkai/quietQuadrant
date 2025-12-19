const { app, BrowserWindow, globalShortcut, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require("electron-squirrel-startup")) {
    app.quit();
}

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow;
let splashWindow;

function getRandomSplashPath() {
    const buildDir = path.join(__dirname, "../build-resources");
    const configPath = path.join(buildDir, "splash-config.json");

    // Check for multiple splash screens
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
            const randomIndex = Math.floor(Math.random() * config.count) + 1;
            const splashPath = path.join(buildDir, `splash${randomIndex}.png`);
            if (fs.existsSync(splashPath)) {
                return splashPath;
            }
        } catch (e) {
            console.log("Error reading splash config:", e);
        }
    }

    // Fallback to single splash.png
    const fallbackPath = path.join(buildDir, "splash.png");
    if (fs.existsSync(fallbackPath)) {
        return fallbackPath;
    }

    // Try splash1.png as last resort
    const splash1Path = path.join(buildDir, "splash1.png");
    if (fs.existsSync(splash1Path)) {
        return splash1Path;
    }

    return null;
}

function createSplashWindow() {
    const splashPath = getRandomSplashPath();

    if (!splashPath) {
        console.log("No splash image found, skipping splash screen");
        return null;
    }

    console.log("Using splash:", path.basename(splashPath));

    splashWindow = new BrowserWindow({
        width: 600,
        height: 400,
        frame: false,
        transparent: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        center: true,
        backgroundColor: "#000000",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load splash HTML with the image
    const splashHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: #000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    overflow: hidden;
                }
                img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
            </style>
        </head>
        <body>
            <img src="file://${splashPath.replace(
                /\\/g,
                "/"
            )}" alt="Loading..." />
        </body>
        </html>
    `;

    splashWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`
    );

    return splashWindow;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 800,
        minHeight: 600,
        title: "Quiet Quadrant",
        icon: path.join(__dirname, "../build-resources/icon.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            nodeIntegration: false,
            contextIsolation: true,
        },
        show: false, // Don't show until ready
        backgroundColor: "#0a0e14",
    });

    // Show window when ready and close splash
    mainWindow.once("ready-to-show", () => {
        // Small delay to ensure smooth transition
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
                splashWindow = null;
            }
            mainWindow.show();
        }, 500);
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }

    // Handle window closed
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: "Game",
            submenu: [
                {
                    label: "Toggle Fullscreen",
                    accelerator: "F11",
                    click: () => {
                        if (mainWindow) {
                            mainWindow.setFullScreen(
                                !mainWindow.isFullScreen()
                            );
                        }
                    },
                },
                { type: "separator" },
                {
                    label: "Quit",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+Q" : "Alt+F4",
                    click: () => {
                        app.quit();
                    },
                },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                ...(isDev ? [{ role: "toggleDevTools" }] : []),
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
            ],
        },
    ];

    // macOS specific menu adjustments
    if (process.platform === "darwin") {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
            ],
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Register global shortcuts
function registerShortcuts() {
    // F11 for fullscreen toggle
    globalShortcut.register("F11", () => {
        if (mainWindow) {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
    });

    // Escape to exit fullscreen
    globalShortcut.register("Escape", () => {
        if (mainWindow && mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
        }
    });
}

// App ready
app.whenReady().then(() => {
    // Show splash screen first
    createSplashWindow();

    // Create main window (will show after ready and close splash)
    createWindow();
    createMenu();
    registerShortcuts();

    app.on("activate", () => {
        // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// Cleanup on quit
app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});
