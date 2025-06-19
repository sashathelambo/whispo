import {
    makeKeyWindow,
    makePanel,
    makeWindow,
} from "@egoist/electron-panel-window"
import { getRendererHandlers } from "@egoist/tipc/main"
import {
    app,
    BrowserWindow,
    BrowserWindowConstructorOptions,
    screen,
    shell,
} from "electron"
import path from "path"
import { STATUS_BAR_DIMENSIONS } from "../shared"
import { configStore } from "./config"
import { RendererHandlers } from "./renderer-handlers"

type WINDOW_ID = "main" | "panel" | "setup" | "statusbar"

export const WINDOWS = new Map<WINDOW_ID, BrowserWindow>()

function createBaseWindow({
  id,
  url,
  showWhenReady = true,
  windowOptions,
}: {
  id: WINDOW_ID
  url?: string
  showWhenReady?: boolean
  windowOptions?: BrowserWindowConstructorOptions
}) {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...windowOptions,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      ...windowOptions?.webPreferences,
    },
  })

  WINDOWS.set(id, win)

  if (showWhenReady) {
    win.on("ready-to-show", () => {
      win.show()
    })
  }

  win.on("close", () => {
    console.log("close", id)
    WINDOWS.delete(id)
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })

  const baseUrl = import.meta.env.PROD
    ? "assets://app"
    : process.env["ELECTRON_RENDERER_URL"]

  win.loadURL(`${baseUrl}${url || ""}`)

  return win
}

export function createMainWindow({ url }: { url?: string } = {}) {
  const win = createBaseWindow({
    id: "main",
    url,
    windowOptions: {
      titleBarStyle: "hiddenInset",
    },
  })

  if (process.env.IS_MAC) {
    win.on("close", () => {
      if (configStore.get().hideDockIcon) {
        app.setActivationPolicy("accessory")
        app.dock.hide()
      }
    })

    win.on("show", () => {
      if (configStore.get().hideDockIcon && !app.dock.isVisible()) {
        app.dock.show()
      }
    })
  }

  return win
}

export function createSetupWindow() {
  const win = createBaseWindow({
    id: "setup",
    url: "/setup",
    windowOptions: {
      titleBarStyle: "hiddenInset",
      width: 800,
      height: 600,
      resizable: false,
    },
  })

  return win
}

export function showMainWindow(url?: string) {
  const win = WINDOWS.get("main")

  if (win) {
    win.show()
    if (url) {
      getRendererHandlers<RendererHandlers>(win.webContents).navigate.send(url)
    }
  } else {
    createMainWindow({ url })
  }
}

const panelWindowSize = {
  width: 400,
  height: 90,
}

// Status bar dimensions - ultra compact (using shared baseline dimensions)
const statusBarSize = STATUS_BAR_DIMENSIONS

const getPanelWindowPosition = () => {
  // position the window near the bottom of the screen, above the taskbar
  const currentScreen = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint(),
  )
  const screenSize = currentScreen.workArea
  const position = {
    x: Math.floor(
      screenSize.x + (screenSize.width - panelWindowSize.width) / 2,
    ),
    y: Math.floor(
      screenSize.y + screenSize.height - panelWindowSize.height - 60,
    ),
  }

  return position
}

const getStatusBarPosition = () => {
  const currentScreen = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint(),
  )
  const screenSize = currentScreen.workArea
  const position = {
    x: Math.floor(
      screenSize.x + (screenSize.width - statusBarSize.width) / 2,
    ),
    y: Math.floor(
      screenSize.y + screenSize.height - statusBarSize.height - 4, // 4px margin from very bottom
    ),
  }

  return position
}

export function createPanelWindow() {
  const position = getPanelWindowPosition()

  const win = createBaseWindow({
    id: "panel",
    url: "/panel",
    showWhenReady: false,
    windowOptions: {
      width: panelWindowSize.width,
      height: panelWindowSize.height,
      titleBarStyle: "customButtonsOnHover",
      transparent: true,
      frame: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      ...(process.platform === "darwin" ? { vibrancy: "under-window" } : {}),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      x: position.x,
      y: position.y,
    },
  })

  win.on("hide", () => {
    getRendererHandlers<RendererHandlers>(win.webContents).stopRecording.send()
  })

  makePanel(win)

  return win
}

export function createStatusBarWindow() {
  const position = getStatusBarPosition()

  const statusBarWindowSize = STATUS_BAR_DIMENSIONS

  const statusBarWindow = createBaseWindow({
    id: "statusbar",
    url: "/statusbar",
    showWhenReady: true,
    windowOptions: {
      width: statusBarWindowSize.width,
      height: statusBarWindowSize.height,
      titleBarStyle: "customButtonsOnHover",
      transparent: true,
      frame: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      resizable: true, // Allow dynamic resizing for expanded interface
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: true, // Allow focus when expanded
      ...(process.platform === "darwin" ? { vibrancy: "under-window" } : {}),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      x: position.x,
      y: position.y,
    },
  })

  makePanel(statusBarWindow)

  return statusBarWindow
}

export function showPanelWindow() {
  const win = WINDOWS.get("panel")
  if (win) {
    const position = getPanelWindowPosition()
    win.setPosition(position.x, position.y)
    win.showInactive()
    makeKeyWindow(win)
  }
}

export function showPanelWindowAndStartRecording() {
  showPanelWindow()
  getWindowRendererHandlers("panel")?.startRecording.send()
}

export function makePanelWindowClosable() {
  const panel = WINDOWS.get("panel")
  if (panel && !panel.isClosable()) {
    makeWindow(panel)
    panel.setClosable(true)
  }
}

export function makeStatusBarWindowClosable() {
  const statusBar = WINDOWS.get("statusbar")
  if (statusBar && !statusBar.isClosable()) {
    makeWindow(statusBar)
    statusBar.setClosable(true)
  }
}

export const getWindowRendererHandlers = (id: WINDOW_ID) => {
  const win = WINDOWS.get(id)
  if (!win) return
  return getRendererHandlers<RendererHandlers>(win.webContents)
}

export const stopRecordingAndHidePanelWindow = () => {
  const win = WINDOWS.get("panel")
  if (win) {
    getRendererHandlers<RendererHandlers>(win.webContents).stopRecording.send()

    if (win.isVisible()) {
      win.hide()
    }
  }
}
