/**
 * Application Detection Module
 * Tracks the currently active/focused application for App-Specific Rules feature
 * Supports both Windows and macOS platforms
 */

import { AppRule } from "@shared/types"
import { exec } from "child_process"
import { promisify } from "util"
import { configStore } from "./config"
import { state } from "./state"

const execAsync = promisify(exec)

export interface ActiveAppInfo {
  name: string      // Application name
  executable: string // Executable file name
  title: string     // Window title
  lastUpdated: number
}

/**
 * Get the currently active application information
 * Platform-specific implementation for Windows and macOS
 */
export async function getActiveApplication(): Promise<ActiveAppInfo | null> {
  try {
    if (process.platform === "win32") {
      return await getActiveAppWindows()
    } else if (process.platform === "darwin") {
      return await getActiveAppMacOS()
    } else {
      console.warn("Active application detection not supported on this platform")
      return null
    }
  } catch (error) {
    console.error("Failed to get active application:", error)
    return null
  }
}

/**
 * Windows implementation using PowerShell
 */
async function getActiveAppWindows(): Promise<ActiveAppInfo | null> {
  try {
    // PowerShell script to get active window information
    const script = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class Win32 {
          [DllImport("user32.dll")]
          public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")]
          public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")]
          public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        }
"@
      $hwnd = [Win32]::GetForegroundWindow()
      $title = New-Object System.Text.StringBuilder 256
      [Win32]::GetWindowText($hwnd, $title, $title.Capacity) | Out-Null
      $processId = 0
      [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if ($process) {
        $result = @{
          name = $process.ProcessName
          executable = $process.ProcessName + ".exe"
          title = $title.ToString()
        }
        $result | ConvertTo-Json -Compress
      } else {
        # Output empty JSON object when no process is found
        @{
          name = ""
          executable = ""
          title = ""
        } | ConvertTo-Json -Compress
      }
    `

    const { stdout } = await execAsync(`powershell -Command "${script.replace(/"/g, '\\"')}"`)
    const output = stdout.trim()

    // Check if we have valid output before parsing
    if (!output) {
      return null
    }

    const result = JSON.parse(output)

    return {
      name: result.name || '',
      executable: result.executable || '',
      title: result.title || '',
      lastUpdated: Date.now()
    }
  } catch (error) {
    console.error("Windows app detection failed:", error)
    return null
  }
}

/**
 * macOS implementation using AppleScript
 */
async function getActiveAppMacOS(): Promise<ActiveAppInfo | null> {
  try {
    const script = `
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set appName to name of frontApp
        set appPath to POSIX path of (file of frontApp)
      end tell

      tell application "System Events"
        try
          set windowTitle to name of first window of first application process whose frontmost is true
        on error
          set windowTitle to ""
        end try
      end tell

      return appName & "|" & appPath & "|" & windowTitle
    `

    const { stdout } = await execAsync(`osascript -e '${script}'`)
    const [name, path, title] = stdout.trim().split('|')

    // Extract executable name from path
    const executable = path.split('/').pop() || name

    return {
      name: name || '',
      executable: executable || '',
      title: title || '',
      lastUpdated: Date.now()
    }
  } catch (error) {
    console.error("macOS app detection failed:", error)
    return null
  }
}

/**
 * Find matching app rule for the current application
 * Rules are matched by priority (higher number = higher priority)
 */
export function findMatchingRule(appInfo: ActiveAppInfo, rules: AppRule[]): AppRule | null {
  if (!rules || rules.length === 0) return null

  const enabledRules = rules.filter(rule => rule.enabled)
  const matchingRules: AppRule[] = []

  for (const rule of enabledRules) {
    let matches = false

    // Check app name pattern match (case insensitive)
    if (rule.appName) {
      const pattern = new RegExp(rule.appName.replace(/\*/g, '.*'), 'i')
      if (pattern.test(appInfo.name)) {
        matches = true
      }
    }

    // Check executable pattern match (case insensitive)
    if (rule.executable && !matches) {
      const pattern = new RegExp(rule.executable.replace(/\*/g, '.*'), 'i')
      if (pattern.test(appInfo.executable)) {
        matches = true
      }
    }

    if (matches) {
      matchingRules.push(rule)
    }
  }

  // Sort by priority (descending) and return the highest priority rule
  if (matchingRules.length > 0) {
    return matchingRules.sort((a, b) => b.priority - a.priority)[0]
  }

  return null
}

/**
 * Update the active application state and apply matching rules
 */
export async function updateActiveApplication(): Promise<void> {
  try {
    const appInfo = await getActiveApplication()
    if (!appInfo) return

    // Update state
    state.activeApp = appInfo

    // Check if app rules are enabled
    const config = configStore.get()
    if (!config.enableAppRules || !config.appRules) {
      state.activeRule = null
      return
    }

    // Find and apply matching rule
    const matchingRule = findMatchingRule(appInfo, config.appRules)
    if (matchingRule !== state.activeRule) {
      state.activeRule = matchingRule
      console.log(`Active rule changed:`, matchingRule ?
        `${matchingRule.appName} (${matchingRule.shortcut})` : 'none')
    }
  } catch (error) {
    console.error("Failed to update active application:", error)
  }
}

/**
 * Start monitoring active application changes
 */
export function startAppDetection(): void {
  // Update immediately
  updateActiveApplication()

  // Poll for changes every 2 seconds
  setInterval(updateActiveApplication, 2000)
}

/**
 * Get the effective configuration for the current context
 * Merges global config with active rule overrides
 */
export function getEffectiveConfig() {
  const globalConfig = configStore.get()
  const activeRule = state.activeRule

  // Debug logging to see what config we're getting
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] Global config:`, {
      shortcut: globalConfig.shortcut,
      holdKey: globalConfig.holdKey,
      voiceActivation: globalConfig.voiceActivation?.enabled,
      enableAppRules: globalConfig.enableAppRules
    })
    console.log(`[DEBUG] Active rule:`, activeRule?.appName || 'none')
  }

  if (!activeRule) {
    return globalConfig
  }

  // Merge global config with rule-specific overrides
  return {
    ...globalConfig,
    ...(activeRule.shortcut && { shortcut: activeRule.shortcut }),
    ...(activeRule.sttProviderId && { sttProviderId: activeRule.sttProviderId }),
    ...(activeRule.transcriptPostProcessingEnabled !== undefined && {
      transcriptPostProcessingEnabled: activeRule.transcriptPostProcessingEnabled
    }),
    ...(activeRule.transcriptPostProcessingProviderId && {
      transcriptPostProcessingProviderId: activeRule.transcriptPostProcessingProviderId
    }),
    ...(activeRule.transcriptPostProcessingPrompt && {
      transcriptPostProcessingPrompt: activeRule.transcriptPostProcessingPrompt
    }),
  }
}
