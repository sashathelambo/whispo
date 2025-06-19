import { registerIpcMain } from "@egoist/tipc/main"
import { electronApp, optimizer } from "@electron-toolkit/utils"
import { app, Menu } from "electron"
import { startAppDetection } from "./app-detector"
import { configStore } from "./config"
import { listenToKeyboardEvents } from "./keyboard"
import { createAppMenu } from "./menu"
import { registerServeProtocol, registerServeSchema } from "./serve"
import { router } from "./tipc"
import { initTray } from "./tray"
import { isAccessibilityGranted } from "./utils"
import { initVoiceActivation } from "./voice-activation"
import {
    createMainWindow,
    createPanelWindow,
    createSetupWindow,
    createStatusBarWindow,
    makePanelWindowClosable,
    makeStatusBarWindowClosable,
    WINDOWS,
} from "./window"

registerServeSchema()

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId(process.env.APP_ID)

  const accessibilityGranted = isAccessibilityGranted()

  Menu.setApplicationMenu(createAppMenu())

  registerIpcMain(router)

  registerServeProtocol()

  if (accessibilityGranted) {
    createMainWindow()
  } else {
    createSetupWindow()
  }

  createPanelWindow()

  // Create the persistent status bar
  createStatusBarWindow()

  console.log("[DEBUG] Starting keyboard event listener...")
  listenToKeyboardEvents()
  console.log("[DEBUG] Keyboard event listener started")

  initTray()

  // Initialize new features
  startAppDetection()

  // Initialize voice activation if enabled in config
  const config = configStore.get()
  if (config.voiceActivation?.enabled) {
    initVoiceActivation().catch(console.error)
  }

  import("./updater").then((res) => res.init()).catch(console.error)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on("activate", function () {
    if (accessibilityGranted) {
      if (!WINDOWS.get("main")) {
        createMainWindow()
      }
    } else {
      if (!WINDOWS.get("setup")) {
        createSetupWindow()
      }
    }
  })

  app.on("before-quit", () => {
    makePanelWindowClosable()
    makeStatusBarWindowClosable()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
