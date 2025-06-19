import { getRendererHandlers, tipc } from "@egoist/tipc/main"
import {
    app,
    clipboard,
    dialog,
    Menu,
    shell,
    systemPreferences,
} from "electron"
import fs from "fs"
import path from "path"
import { AppRule, Config, RecordingHistoryItem, SettingsProfile } from "../shared/types"
import {
    findMatchingRule,
    getActiveApplication,
    getEffectiveConfig,
    updateActiveApplication
} from "./app-detector"
import { configStore, recordingsFolder } from "./config"
import {
    applyContextSpecificFormatting,
    buildContextFormattingPrompt,
    detectApplicationContext,
    getEffectiveFormattingConfig,
    testContextDetection
} from "./context-formatter"
import { fusionTranscribe, testFusionConfiguration } from "./fusion-transcription"
import { writeText } from "./keyboard"
import { postProcessTranscript } from "./llm"
import { RendererHandlers } from "./renderer-handlers"
import { state } from "./state"
import {
    cleanupStreamingDictation,
    getStreamingDictationStatus,
    initStreamingDictation,
    pauseStreamingDictation,
    resumeStreamingDictation,
    startStreamingDictation,
    stopStreamingDictation,
    toggleStreamingDictation
} from "./streaming-dictation"
import { updateTrayIcon } from "./tray"
import { isAccessibilityGranted } from "./utils"
import {
    cleanupVoiceActivation,
    getVoiceActivationStatus,
    initVoiceActivation,
    startVoiceActivation,
    stopVoiceActivation
} from "./voice-activation"
import { showPanelWindow, WINDOWS } from "./window"

const t = tipc.create()

const getRecordingHistory = () => {
  try {
    const history = JSON.parse(
      fs.readFileSync(path.join(recordingsFolder, "history.json"), "utf8"),
    ) as RecordingHistoryItem[]

    // sort desc by createdAt
    return history.sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

const saveRecordingsHitory = (history: RecordingHistoryItem[]) => {
  fs.writeFileSync(
    path.join(recordingsFolder, "history.json"),
    JSON.stringify(history),
  )
}

// Modified createRecording to support fusion transcription
const createRecording = async ({
  recording,
  duration,
  useFusion = false,
}: {
  recording: ArrayBuffer
  duration: number
  useFusion?: boolean
}) => {
  fs.mkdirSync(recordingsFolder, { recursive: true })

  const config = configStore.get()
  const blob = new Blob([recording], { type: "audio/webm" })

  let originalTranscript: string
  let fusionResult: any = null

  // Check if fusion is enabled and requested
  if (useFusion && config.fusionTranscription?.enabled) {
    try {
      console.log("Using fusion transcription...")
      fusionResult = await fusionTranscribe(blob, config.fusionTranscription)
      originalTranscript = fusionResult.finalTranscript

      console.log("Fusion transcription completed:", {
        strategy: fusionResult.strategy,
        confidence: fusionResult.confidence,
        providersUsed: fusionResult.providersUsed,
        processingTime: fusionResult.processingTime
      })
    } catch (error) {
      console.error("Fusion transcription failed, falling back to single provider:", error)
      // Fallback to single provider transcription
      originalTranscript = await singleProviderTranscription(blob, config)
    }
  } else {
    // Use single provider transcription
    originalTranscript = await singleProviderTranscription(blob, config)
  }

  // Apply post-processing if enabled
  const finalTranscript = await postProcessTranscript(originalTranscript)

  // Save recording and history
  const history = getRecordingHistory()
  const item: RecordingHistoryItem = {
    id: Date.now().toString(),
    createdAt: Date.now(),
    duration: duration,
    transcript: finalTranscript,
    originalTranscript: originalTranscript !== finalTranscript ? originalTranscript : undefined,
    isOriginalShown: false,
  }
  history.push(item)
  saveRecordingsHitory(history)

  fs.writeFileSync(
    path.join(recordingsFolder, `${item.id}.webm`),
    Buffer.from(recording),
  )

  const main = WINDOWS.get("main")
  if (main) {
    getRendererHandlers<RendererHandlers>(
      main.webContents,
    ).refreshRecordingHistory.send()
  }

  const panel = WINDOWS.get("panel")
  if (panel) {
    panel.hide()
  }

  // paste
  clipboard.writeText(finalTranscript)
  if (isAccessibilityGranted()) {
    await writeText(finalTranscript)
  }

  // Return fusion information for debugging/UI display
  return {
    transcript: finalTranscript,
    fusionResult,
  }
}

// Single provider transcription (existing logic)
async function singleProviderTranscription(blob: Blob, config: Config): Promise<string> {
  const form = new FormData()
  form.append(
    "file",
    new File([blob], "recording.webm", { type: "audio/webm" }),
  )
  form.append(
    "model",
    config.sttProviderId === "groq" ? "whisper-large-v3" : "whisper-1",
  )
  form.append("response_format", "json")

  const groqBaseUrl = config.groqBaseUrl || "https://api.groq.com/openai/v1"
  const openaiBaseUrl = config.openaiBaseUrl || "https://api.openai.com/v1"

  const transcriptResponse = await fetch(
    config.sttProviderId === "groq"
      ? `${groqBaseUrl}/audio/transcriptions`
      : `${openaiBaseUrl}/audio/transcriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.sttProviderId === "groq" ? config.groqApiKey : config.openaiApiKey}`,
      },
      body: form,
    },
  )

  if (!transcriptResponse.ok) {
    const message = `${transcriptResponse.statusText} ${(await transcriptResponse.text()).slice(0, 300)}`
    throw new Error(message)
  }

  const json: { text: string } = await transcriptResponse.json()
  return json.text
}

export const router = {
  restartApp: t.procedure.action(async () => {
    app.relaunch()
    app.quit()
  }),

  getUpdateInfo: t.procedure.action(async () => {
    const { getUpdateInfo } = await import("./updater")
    return getUpdateInfo()
  }),

  quitAndInstall: t.procedure.action(async () => {
    const { quitAndInstall } = await import("./updater")

    quitAndInstall()
  }),

  checkForUpdatesAndDownload: t.procedure.action(async () => {
    const { checkForUpdatesAndDownload } = await import("./updater")

    return checkForUpdatesAndDownload()
  }),

  openMicrophoneInSystemPreferences: t.procedure.action(async () => {
    await shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
    )
  }),

  hidePanelWindow: t.procedure.action(async () => {
    const panel = WINDOWS.get("panel")

    panel?.hide()
  }),

  showContextMenu: t.procedure
    .input<{ x: number; y: number; selectedText?: string }>()
    .action(async ({ input, context }) => {
      const items: Electron.MenuItemConstructorOptions[] = []

      if (input.selectedText) {
        items.push({
          label: "Copy",
          click() {
            clipboard.writeText(input.selectedText || "")
          },
        })
      }

      if (import.meta.env.DEV) {
        items.push({
          label: "Inspect Element",
          click() {
            context.sender.inspectElement(input.x, input.y)
          },
        })
      }

      const panelWindow = WINDOWS.get("panel")
      const isPanelWindow = panelWindow?.webContents.id === context.sender.id

      if (isPanelWindow) {
        items.push({
          label: "Close",
          click() {
            panelWindow?.hide()
          },
        })
      }

      const menu = Menu.buildFromTemplate(items)
      menu.popup({
        x: input.x,
        y: input.y,
      })
    }),

  getMicrophoneStatus: t.procedure.action(async () => {
    return systemPreferences.getMediaAccessStatus("microphone")
  }),

  isAccessibilityGranted: t.procedure.action(async () => {
    return isAccessibilityGranted()
  }),

  requestAccesssbilityAccess: t.procedure.action(async () => {
    if (process.platform === "win32") return true

    return systemPreferences.isTrustedAccessibilityClient(true)
  }),

  requestMicrophoneAccess: t.procedure.action(async () => {
    return systemPreferences.askForMediaAccess("microphone")
  }),

  showPanelWindow: t.procedure.action(async () => {
    showPanelWindow()
  }),

  displayError: t.procedure
    .input<{ title?: string; message: string }>()
    .action(async ({ input }) => {
      dialog.showErrorBox(input.title || "Error", input.message)
    }),

  createRecording: t.procedure
    .input<{
      recording: ArrayBuffer
      duration: number
      useFusion?: boolean
    }>()
    .action(async ({ input }) => {
      return createRecording(input)
    }),

  getRecordingHistory: t.procedure.action(async () => getRecordingHistory()),

  deleteRecordingItem: t.procedure
    .input<{ id: string }>()
    .action(async ({ input }) => {
      const recordings = getRecordingHistory().filter(
        (item) => item.id !== input.id,
      )
      saveRecordingsHitory(recordings)
      fs.unlinkSync(path.join(recordingsFolder, `${input.id}.webm`))
    }),

  deleteRecordingHistory: t.procedure.action(async () => {
    fs.rmSync(recordingsFolder, { force: true, recursive: true })
  }),

  // Status bar window resizing
  resizeStatusBarWindow: t.procedure
    .input<{ width: number; height: number; expanded?: boolean }>()
    .action(async ({ input }) => {
      const statusBarWindow = WINDOWS.get("statusbar")
      if (statusBarWindow) {
        const currentBounds = statusBarWindow.getBounds()
        const screenWorkArea = require("electron").screen.getDisplayNearestPoint(
          require("electron").screen.getCursorScreenPoint()
        ).workArea

        // Calculate new position (center horizontally, adjust vertically if expanded)
        const newX = Math.floor(screenWorkArea.x + (screenWorkArea.width - input.width) / 2)
        const newY = input.expanded
          ? Math.floor(screenWorkArea.y + screenWorkArea.height - input.height - 80) // Expanded - higher position
          : Math.floor(screenWorkArea.y + screenWorkArea.height - input.height - 4)  // Compact - bottom position

        statusBarWindow.setBounds({
          x: newX,
          y: newY,
          width: input.width,
          height: input.height
        })
      }
    }),

  // Toggle between original and processed transcript
  toggleRecordingTranscript: t.procedure
    .input<{ id: string }>()
    .action(async ({ input }) => {
      const history = getRecordingHistory()
      const itemIndex = history.findIndex(item => item.id === input.id)

      if (itemIndex === -1) {
        throw new Error("Recording not found")
      }

      const item = history[itemIndex]

      // Only toggle if originalTranscript exists
      if (!item.originalTranscript) {
        throw new Error("No original transcript available")
      }

      // Toggle the display state and swap transcripts
      const isCurrentlyShowingOriginal = item.isOriginalShown || false

      if (isCurrentlyShowingOriginal) {
        // Currently showing original, switch back to processed
        item.isOriginalShown = false
      } else {
        // Currently showing processed, switch to original
        item.isOriginalShown = true
      }

      // Update the history
      history[itemIndex] = item
      saveRecordingsHitory(history)

      // Refresh the UI
      const main = WINDOWS.get("main")
      if (main) {
        getRendererHandlers<RendererHandlers>(
          main.webContents,
        ).refreshRecordingHistory.send()
      }

      return {
        success: true,
        isShowingOriginal: item.isOriginalShown,
      }
    }),

  getConfig: t.procedure.action(async () => {
    return configStore.get()
  }),

  saveConfig: t.procedure
    .input<{ config: Config }>()
    .action(async ({ input }) => {
      configStore.save(input.config)
    }),

  recordEvent: t.procedure
    .input<{ type: "start" | "end" }>()
    .action(async ({ input }) => {
      if (input.type === "start") {
        state.isRecording = true
      } else {
        state.isRecording = false
      }
      updateTrayIcon()
    }),

  // Voice Activation endpoints
  initVoiceActivation: t.procedure.action(async () => {
    return initVoiceActivation()
  }),

  startVoiceActivation: t.procedure.action(async () => {
    startVoiceActivation()
  }),

  stopVoiceActivation: t.procedure.action(async () => {
    stopVoiceActivation()
  }),

  getVoiceActivationStatus: t.procedure.action(async () => {
    return getVoiceActivationStatus()
  }),

  cleanupVoiceActivation: t.procedure.action(async () => {
    cleanupVoiceActivation()
  }),

  // **NEW: Streaming Dictation endpoints**
  initStreamingDictation: t.procedure.action(async () => {
    return initStreamingDictation()
  }),

  startStreamingDictation: t.procedure.action(async () => {
    startStreamingDictation()
  }),

  stopStreamingDictation: t.procedure.action(async () => {
    stopStreamingDictation()
  }),

  pauseStreamingDictation: t.procedure.action(async () => {
    pauseStreamingDictation()
  }),

  resumeStreamingDictation: t.procedure.action(async () => {
    resumeStreamingDictation()
  }),

  toggleStreamingDictation: t.procedure.action(async () => {
    toggleStreamingDictation()
  }),

  getStreamingDictationStatus: t.procedure.action(async () => {
    return getStreamingDictationStatus()
  }),

  cleanupStreamingDictation: t.procedure.action(async () => {
    cleanupStreamingDictation()
  }),

  // App-Specific Rules endpoints
  getActiveApplication: t.procedure.action(async () => {
    return getActiveApplication()
  }),

  updateActiveApplication: t.procedure.action(async () => {
    await updateActiveApplication()
  }),

  getEffectiveConfig: t.procedure.action(async () => {
    return getEffectiveConfig()
  }),

  // App Rules management
  createAppRule: t.procedure
    .input<{ rule: Omit<AppRule, 'id'> }>()
    .action(async ({ input }) => {
      const config = configStore.get()
      const appRules = config.appRules || []

      const newRule: AppRule = {
        ...input.rule,
        id: Date.now().toString(),
      }

      appRules.push(newRule)

      configStore.save({
        ...config,
        appRules,
      })

      return newRule
    }),

  updateAppRule: t.procedure
    .input<{ rule: AppRule }>()
    .action(async ({ input }) => {
      const config = configStore.get()
      const appRules = config.appRules || []

      const index = appRules.findIndex(rule => rule.id === input.rule.id)
      if (index >= 0) {
        appRules[index] = input.rule

        configStore.save({
          ...config,
          appRules,
        })
      }

      return input.rule
    }),

  deleteAppRule: t.procedure
    .input<{ id: string }>()
    .action(async ({ input }) => {
      const config = configStore.get()
      const appRules = (config.appRules || []).filter(rule => rule.id !== input.id)

      configStore.save({
        ...config,
        appRules,
      })
    }),

  getAppRules: t.procedure.action(async () => {
    const config = configStore.get()
    return config.appRules || []
  }),

  // Test app rule matching
  testAppRule: t.procedure
    .input<{ rule: AppRule }>()
    .action(async ({ input }) => {
      const activeApp = await getActiveApplication()
      if (!activeApp) return false

      return findMatchingRule(activeApp, [input.rule]) !== null
    }),

  getRecordingState: t.procedure.action(async () => {
    return {
      isRecording: state.isRecording,
      startTime: state.voiceActivation.recordingStartTime,
      duration: state.isRecording ? Date.now() - state.voiceActivation.recordingStartTime : 0,
    }
  }),

  // Profile management endpoints
  getProfiles: t.procedure.action(async () => {
    return configStore.getProfiles()
  }),

  getActiveProfileId: t.procedure.action(async () => {
    return configStore.getActiveProfileId()
  }),

  createProfile: t.procedure
    .input<{ name: string, description?: string, baseConfig?: Config }>()
    .action(async ({ input }) => {
      return configStore.createProfile(input.name, input.description, input.baseConfig)
    }),

  updateProfile: t.procedure
    .input<{ profileId: string, updates: Partial<SettingsProfile> }>()
    .action(async ({ input }) => {
      configStore.updateProfile(input.profileId, input.updates)
    }),

  deleteProfile: t.procedure
    .input<{ profileId: string }>()
    .action(async ({ input }) => {
      return configStore.deleteProfile(input.profileId)
    }),

  switchProfile: t.procedure
    .input<{ profileId: string }>()
    .action(async ({ input }) => {
      const success = configStore.switchProfile(input.profileId)
      if (success) {
        // Update tray icon in case shortcut changed
        updateTrayIcon()
      }
      return success
    }),

  duplicateProfile: t.procedure
    .input<{ profileId: string, newName: string }>()
    .action(async ({ input }) => {
      const profiles = configStore.getProfiles()
      const profileToDuplicate = profiles.find(p => p.id === input.profileId)

      if (profileToDuplicate) {
        return configStore.createProfile(
          input.newName,
          `Copy of ${profileToDuplicate.description || profileToDuplicate.name}`,
          profileToDuplicate.config
        )
      }

      return null
    }),

  // Fusion Transcription endpoints
  testFusionConfiguration: t.procedure.action(async () => {
    const config = configStore.get()
    if (!config.fusionTranscription) {
      throw new Error("Fusion transcription not configured")
    }
    return testFusionConfiguration(config.fusionTranscription)
  }),

  getFusionConfig: t.procedure.action(async () => {
    const config = configStore.get()
    return config.fusionTranscription
  }),

  updateFusionConfig: t.procedure
    .input<{ fusionConfig: any }>()
    .action(async ({ input }) => {
      const config = configStore.get()
      configStore.save({
        ...config,
        fusionTranscription: input.fusionConfig,
      })
    }),

  // Context-aware formatting endpoints
  testContextDetection: t.procedure.action(async () => {
    try {
      return await testContextDetection()
    } catch (error) {
      console.error("Failed to test context detection:", error)
      return {
        appInfo: null,
        detectedContext: null,
        availableContexts: [],
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }),

  getCurrentAppInfo: t.procedure.action(async () => {
    try {
      return await getActiveApplication()
    } catch (error) {
      console.error("Failed to get current app info:", error)
      return null
    }
  }),

  detectContextForApp: t.procedure
    .input<{ appInfo: any }>()
    .action(async ({ input }) => {
      try {
        return detectApplicationContext(input.appInfo)
      } catch (error) {
        console.error("Failed to detect context for app:", error)
        return "generic"
      }
    }),

  getEffectiveFormattingConfig: t.procedure.action(async () => {
    try {
      const appInfo = await getActiveApplication()
      if (!appInfo) return null

      return getEffectiveFormattingConfig(appInfo, state.activeRule)
    } catch (error) {
      console.error("Failed to get effective formatting config:", error)
      return null
    }
  }),

  previewContextFormatting: t.procedure
    .input<{ transcript: string, formattingConfig: any }>()
    .action(async ({ input }) => {
      try {
        // Apply basic formatting
        const basicFormatted = applyContextSpecificFormatting(
          input.transcript,
          input.formattingConfig.context
        )

        // Build the full AI prompt
        const aiPrompt = buildContextFormattingPrompt(input.transcript, input.formattingConfig)

        return {
          basicFormatted,
          aiPrompt,
          originalTranscript: input.transcript
        }
      } catch (error) {
        console.error("Failed to preview context formatting:", error)
        return {
          basicFormatted: input.transcript,
          aiPrompt: "",
          originalTranscript: input.transcript,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }),
}

export type Router = typeof router
