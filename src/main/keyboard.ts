import { isAltCombination, parseAltKeyCombination } from "@shared/index"
import { spawn } from "child_process"
import { systemPreferences } from "electron"
import path from "path"
import { getEffectiveConfig } from "./app-detector"
import { state } from "./state"
import {
    startStreamingDictation,
    stopStreamingDictation,
    toggleStreamingDictation
} from "./streaming-dictation"
import {
    getWindowRendererHandlers,
    stopRecordingAndHidePanelWindow,
    WINDOWS
} from "./window"

const rdevPath = path
  .join(
    __dirname,
    `../../resources/bin/whispo-rs${process.env.IS_MAC ? "" : ".exe"}`,
  )
  .replace("app.asar", "app.asar.unpacked")

type RdevEvent = {
  event_type: "KeyPress" | "KeyRelease"
  data: {
    key: "ControlLeft" | "ControlRight" | "AltLeft" | "AltRight" | "ShiftLeft" | "ShiftRight" | "Space" | "F1" | "F2" | "BackSlash" | "Slash" | "Escape" | string
  }
  time: {
    secs_since_epoch: number
  }
}

export const writeText = (text: string) => {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(rdevPath, ["write", text])

    child.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`)
    })

    child.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`)
    })

    child.on("close", (code) => {
      // writeText will trigger KeyPress event of the key A
      // I don't know why
      keysPressed.clear()

      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`child process exited with code ${code}`))
      }
    })
  })
}

const parseEvent = (event: any) => {
  try {
    const e = JSON.parse(String(event))
    // Check if data is already an object or if it needs to be parsed
    if (typeof e.data === 'string') {
      e.data = JSON.parse(e.data)
    }
    return e as RdevEvent
  } catch (error) {
    console.error('Failed to parse keyboard event:', error, 'Raw event:', String(event))
    return null
  }
}

// keys that are currently pressed down without releasing
// excluding the configured hold key
// when other keys are pressed, pressing the hold key will not start recording
const keysPressed = new Map<string, number>()

const hasRecentKeyPress = () => {
  if (keysPressed.size === 0) return false

  const now = Date.now() / 1000
  return [...keysPressed.values()].some((time) => {
    // 10 seconds
    // for some weird reasons sometime KeyRelease event is missing for some keys
    // so they stay in the map
    // therefore we have to check if the key was pressed in the last 10 seconds
    return now - time < 10
  })
}

export function listenToKeyboardEvents() {
  let isHoldingTargetKey = false
  let startRecordingTimer: NodeJS.Timeout | undefined
  let isPressedCtrlKey = false
  let isPressedAltLeft = false
  let isPressedAltRight = false

  console.log("[DEBUG] Setting up keyboard event listener")
  console.log("[DEBUG] Platform:", process.platform)
  console.log("[DEBUG] IS_MAC:", process.env.IS_MAC)

  if (process.env.IS_MAC) {
    const hasAccess = systemPreferences.isTrustedAccessibilityClient(false)
    console.log("[DEBUG] macOS accessibility access:", hasAccess)
    if (!hasAccess) {
      console.log("[DEBUG] No accessibility access, keyboard listener will not start")
      return
    }
  }

  const cancelRecordingTimer = () => {
    if (startRecordingTimer) {
      clearTimeout(startRecordingTimer)
      startRecordingTimer = undefined
    }
  }

  /**
   * Check if an Alt + key combination is currently being held
   * @param holdKey - The configured hold key (e.g., "AltLeft+Space")
   * @param pressedKey - The key that was just pressed
   * @returns True if the combination is active
   */
  const isAltCombinationActive = (holdKey: string, pressedKey: string): boolean => {
    if (!isAltCombination(holdKey)) {
      return false
    }

    const parsed = parseAltKeyCombination(holdKey)
    if (!parsed) {
      return false
    }

    // Check if the correct Alt key is pressed
    const isAltPressed = (parsed.modifier === 'AltLeft' && isPressedAltLeft) ||
                        (parsed.modifier === 'AltRight' && isPressedAltRight)

    // Check if the target key matches
    const isTargetKeyPressed = pressedKey === parsed.key

    return isAltPressed && isTargetKeyPressed
  }

  const handleEvent = (e: RdevEvent) => {
    // Get effective config (global + app-specific overrides)
    const currentConfig = getEffectiveConfig()
    const holdKey = currentConfig.holdKey || "AltLeft+Space" // Default to Alt+Space for new Alt-only system

    // Debug logging to see what configuration we're working with
    if (import.meta.env.DEV) {
      console.log(`[DEBUG] Current config:`, {
        shortcut: currentConfig.shortcut,
        holdKey: holdKey,
        voiceActivation: currentConfig.voiceActivation?.enabled,
        streamingDictation: currentConfig.streamingDictation?.enabled
      })
      console.log(`[DEBUG] Key event:`, e.event_type, e.data.key)
    }

    if (e.event_type === "KeyPress") {
      // Track modifier key states
      if (e.data.key === "ControlLeft") {
        isPressedCtrlKey = true
      }
      if (e.data.key === "AltLeft") {
        isPressedAltLeft = true
      }
      if (e.data.key === "AltRight") {
        isPressedAltRight = true
      }

      if (e.data.key === "Escape" && state.isRecording) {
        const win = WINDOWS.get("panel")
        if (win) {
          stopRecordingAndHidePanelWindow()
        }

        return
      }

      // Handle different shortcut modes
      if (currentConfig.shortcut === "voice-activation") {
        // Skip keyboard shortcuts for voice activation mode
        return
      } else if (currentConfig.shortcut === "streaming-dictation") {
        // Handle streaming dictation shortcuts
        if (e.data.key === "Slash" && isPressedCtrlKey) {
          toggleStreamingDictation()
        } else if (isAltCombination(holdKey)) {
          // Handle Alt + key combinations for streaming dictation
          if (isAltCombinationActive(holdKey, e.data.key)) {
            console.log(`Starting streaming dictation with Alt combination: ${holdKey}`)
            startStreamingDictation()
          }
        }
        return
      } else if (currentConfig.shortcut === "disabled") {
        // Skip all shortcuts if disabled
        return
      }

      // Original recording mode shortcuts (hold-key, ctrl-slash)
      if (currentConfig.shortcut === "ctrl-slash") {
        if (e.data.key === "Slash" && isPressedCtrlKey) {
          getWindowRendererHandlers("statusbar")?.startOrFinishRecording.send()
        }
      } else if (currentConfig.shortcut === "hold-key") {
        // Handle Alt + key combinations for recording
        if (isAltCombination(holdKey)) {
          if (isAltCombinationActive(holdKey, e.data.key)) {
            if (hasRecentKeyPress()) {
              console.log("ignore Alt combination because other keys are pressed", [
                ...keysPressed.keys(),
              ])
              return
            }

            if (startRecordingTimer) {
              return
            }

            startRecordingTimer = setTimeout(() => {
              isHoldingTargetKey = true

              console.log(`start recording with Alt combination: ${holdKey}`)

              // Don't show panel window anymore - status bar handles it
              getWindowRendererHandlers("statusbar")?.startRecording.send()
            }, 800)
          } else {
            // Track non-Alt keys being pressed
            if (e.data.key !== "AltLeft" && e.data.key !== "AltRight") {
              keysPressed.set(e.data.key, e.time.secs_since_epoch)
              cancelRecordingTimer()

              // when holding the target combination, pressing any other key will stop recording
              if (isHoldingTargetKey) {
                stopRecordingAndHidePanelWindow()
              }

              isHoldingTargetKey = false
            }
          }
        } else {
          // Legacy single key handling (fallback for old configs)
          if (e.data.key === holdKey) {
            if (hasRecentKeyPress()) {
              console.log("ignore hold key because other keys are pressed", [
                ...keysPressed.keys(),
              ])
              return
            }

            if (startRecordingTimer) {
              return
            }

            startRecordingTimer = setTimeout(() => {
              isHoldingTargetKey = true

              console.log(`start recording with hold key: ${holdKey}`)

              // Don't show panel window anymore - status bar handles it
              getWindowRendererHandlers("statusbar")?.startRecording.send()
            }, 800)
          } else {
            keysPressed.set(e.data.key, e.time.secs_since_epoch)
            cancelRecordingTimer()

            // when holding the target key, pressing any other key will stop recording
            if (isHoldingTargetKey) {
              stopRecordingAndHidePanelWindow()
            }

            isHoldingTargetKey = false
          }
        }
      }
    } else if (e.event_type === "KeyRelease") {
      keysPressed.delete(e.data.key)

      // Track modifier key releases
      if (e.data.key === "ControlLeft") {
        isPressedCtrlKey = false
      }
      if (e.data.key === "AltLeft") {
        isPressedAltLeft = false
      }
      if (e.data.key === "AltRight") {
        isPressedAltRight = false
      }

      // Get effective config for key release events too
      const currentConfig = getEffectiveConfig()
      const holdKey = currentConfig.holdKey || "AltLeft+Space"

      // Handle streaming dictation key release
      if (currentConfig.shortcut === "streaming-dictation") {
        if (isAltCombination(holdKey)) {
          const parsed = parseAltKeyCombination(holdKey)
          if (parsed) {
            // Stop streaming dictation when either the Alt key or the target key is released
            if (e.data.key === parsed.modifier || e.data.key === parsed.key) {
              console.log(`Stopping streaming dictation - Alt combination released: ${holdKey}`)
              stopStreamingDictation()
            }
          }
        }
        return
      }

      if (currentConfig.shortcut === "ctrl-slash" ||
          currentConfig.shortcut === "voice-activation" ||
          currentConfig.shortcut === "disabled") return

      cancelRecordingTimer()

      // Handle Alt combination releases for recording mode
      if (isAltCombination(holdKey)) {
        const parsed = parseAltKeyCombination(holdKey)
        if (parsed) {
          // Stop recording when either the Alt key or the target key is released
          if (e.data.key === parsed.modifier || e.data.key === parsed.key) {
            console.log(`release Alt combination: ${holdKey}`)
            if (isHoldingTargetKey) {
              getWindowRendererHandlers("statusbar")?.finishRecording.send()
            } else {
              stopRecordingAndHidePanelWindow()
            }

            isHoldingTargetKey = false
          }
        }
      } else {
        // Legacy single key handling
        if (e.data.key === holdKey) {
          console.log(`release hold key: ${holdKey}`)
          if (isHoldingTargetKey) {
            getWindowRendererHandlers("statusbar")?.finishRecording.send()
          } else {
            stopRecordingAndHidePanelWindow()
          }

          isHoldingTargetKey = false
        }
      }
    }
  }

  console.log("[DEBUG] Starting keyboard subprocess at:", rdevPath)
  const child = spawn(rdevPath, ["listen"], {})

  child.on('spawn', () => {
    console.log("[DEBUG] Keyboard subprocess spawned successfully")
  })

  child.on('error', (error) => {
    console.error("[DEBUG] Keyboard subprocess error:", error)
  })

  child.stdout.on("data", (data) => {
    if (import.meta.env.DEV) {
      console.log("[DEBUG] Raw keyboard event:", String(data))
    }

    const event = parseEvent(data)
    if (!event) return

    handleEvent(event)
  })

  child.stderr.on("data", (data) => {
    console.error("[DEBUG] Keyboard subprocess stderr:", String(data))
  })
}
