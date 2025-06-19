/**
 * Voice Activation Module
 * Implements automatic voice detection and recording activation
 * Coordinates between main and renderer processes for audio analysis
 */

import { getRendererHandlers } from "@egoist/tipc/main"
import { BrowserWindow, ipcMain } from "electron"
import path from "path"
import { configStore } from "./config"
import { RendererHandlers } from "./renderer-handlers"
import { state } from "./state"
import {
  showPanelWindowAndStartRecording,
  stopRecordingAndHidePanelWindow,
  WINDOWS
} from "./window"

/**
 * Voice Activation Manager
 * Manages voice activation state and coordinates with renderer process
 * The actual audio processing happens in the renderer process
 */
export class VoiceActivationManager {
  private isInitialized = false
  private voiceActivationWindow: BrowserWindow | null = null

  /**
   * Initialize the voice activation system
   * Creates a hidden window for audio processing
   */
  async initialize(): Promise<boolean> {
    try {
      // Create a hidden window for voice activation processing
      this.voiceActivationWindow = new BrowserWindow({
        width: 1,
        height: 1,
        show: false,
        skipTaskbar: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          preload: path.join(__dirname, "../preload/index.mjs"),
        },
      })

      // Set up IPC handlers for voice activation events
      this.setupIpcHandlers()

      // Load the voice activation HTML content
      await this.voiceActivationWindow.loadURL(`data:text/html,${this.getVoiceActivationHTML()}`)

      this.isInitialized = true
      console.log("Voice activation manager initialized")
      return true

    } catch (error) {
      console.error("Failed to initialize voice activation:", error)
      return false
    }
  }

  /**
   * Set up IPC handlers for communication with voice activation window
   */
  private setupIpcHandlers(): void {
    ipcMain.on('voice-activation:voice-detected', () => {
      this.onVoiceDetected()
    })

    ipcMain.on('voice-activation:silence-detected', () => {
      this.onSilenceDetected()
    })

    ipcMain.on('voice-activation:audio-level', (_, level: number) => {
      this.onAudioLevelUpdate(level)
    })
  }

  /**
   * Get the HTML content for voice activation window
   */
  private getVoiceActivationHTML(): string {
    const config = configStore.get()
    const sensitivity = config.voiceActivation?.sensitivity || 30

    return encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head><title>Voice Activation</title></head>
        <body>
          <script>
            const { ipcRenderer } = require('electron');

            // Voice activation audio processing in renderer process
            let audioContext = null;
            let analyser = null;
            let dataArray = null;
            let mediaStream = null;
            let isMonitoring = false;
            let animationId = null;

            async function initAudio() {
              try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                  audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                  }
                });

                audioContext = new AudioContext();
                const source = audioContext.createMediaStreamSource(mediaStream);

                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.8;

                source.connect(analyser);

                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);

                console.log('Voice activation audio initialized');
                return true;
              } catch (error) {
                console.error('Failed to initialize audio:', error);
                return false;
              }
            }

            let lastVoiceState = false;

            function processAudio() {
              if (!analyser || !dataArray || !isMonitoring) return;

              analyser.getByteFrequencyData(dataArray);

              // Calculate RMS
              let rms = 0;
              for (let i = 0; i < dataArray.length; i++) {
                rms += dataArray[i] * dataArray[i];
              }
              rms = Math.sqrt(rms / dataArray.length);

              const audioLevel = Math.min(100, (rms / 255) * 100);

              // Send audio level to main process
              ipcRenderer.send('voice-activation:audio-level', audioLevel);

              // Check for voice/silence with hysteresis to prevent rapid switching
              const sensitivity = ${sensitivity}; // Use actual sensitivity from config
              const voiceDetected = audioLevel > sensitivity;
              const silenceDetected = audioLevel <= sensitivity * 0.3;

              if (voiceDetected && !lastVoiceState) {
                ipcRenderer.send('voice-activation:voice-detected');
                lastVoiceState = true;
              } else if (silenceDetected && lastVoiceState) {
                ipcRenderer.send('voice-activation:silence-detected');
                lastVoiceState = false;
              }

              if (isMonitoring) {
                animationId = requestAnimationFrame(processAudio);
              }
            }

            // Listen for commands from main process
            ipcRenderer.on('voice-activation:start', async () => {
              console.log('Starting voice activation monitoring');
              if (!audioContext) {
                await initAudio();
              }
              isMonitoring = true;
              lastVoiceState = false;
              processAudio();
            });

            ipcRenderer.on('voice-activation:stop', () => {
              console.log('Stopping voice activation monitoring');
              isMonitoring = false;
              if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
              }
            });

            // Cleanup on window close
            window.addEventListener('beforeunload', () => {
              if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
              }
              if (audioContext) {
                audioContext.close();
              }
            });

            console.log('Voice activation window loaded');
          </script>
        </body>
      </html>
    `)
  }

  /**
   * Handle voice detection from renderer process
   */
  private onVoiceDetected(): void {
    const config = configStore.get()
    const voiceConfig = config.voiceActivation

    if (!voiceConfig?.enabled || !state.voiceActivation.isListening) return

    // Clear silence timer
    if (state.voiceActivation.silenceTimer) {
      clearTimeout(state.voiceActivation.silenceTimer)
      state.voiceActivation.silenceTimer = null
    }

    // Start recording if not already recording
    if (!state.isRecording) {
      console.log("Voice detected, starting recording...")
      state.voiceActivation.recordingStartTime = Date.now()
      showPanelWindowAndStartRecording()
    }
  }

  /**
   * Handle silence detection from renderer process
   */
  private onSilenceDetected(): void {
    const config = configStore.get()
    const voiceConfig = config.voiceActivation

    if (!voiceConfig?.enabled || !state.voiceActivation.isListening) return

    const silenceThreshold = voiceConfig.silenceThreshold || 2000
    const minDuration = voiceConfig.minRecordingDuration || 500

    // Start silence timer if recording and not already started
    if (state.isRecording && !state.voiceActivation.silenceTimer) {
      state.voiceActivation.silenceTimer = setTimeout(() => {
        const recordingDuration = Date.now() - state.voiceActivation.recordingStartTime

        // Only stop if minimum duration has been met
        if (recordingDuration >= minDuration) {
          console.log("Silence detected, stopping recording...")
          this.stopRecording()
        }
      }, silenceThreshold)
    }
  }

  /**
   * Handle audio level updates from renderer process
   */
  private onAudioLevelUpdate(level: number): void {
    state.voiceActivation.audioLevel = level

    // Check maximum duration
    if (state.isRecording) {
      const config = configStore.get()
      const voiceConfig = config.voiceActivation
      const maxDuration = voiceConfig?.maxRecordingDuration || 30000

      const recordingDuration = Date.now() - state.voiceActivation.recordingStartTime
      if (recordingDuration >= maxDuration) {
        console.log("Maximum recording duration reached, stopping...")
        this.stopRecording()
      }
    }
  }

  /**
   * Stop recording and clean up timers
   */
  private stopRecording(): void {
    if (state.voiceActivation.silenceTimer) {
      clearTimeout(state.voiceActivation.silenceTimer)
      state.voiceActivation.silenceTimer = null
    }

    const panel = WINDOWS.get("panel")
    if (panel) {
      getRendererHandlers<RendererHandlers>(panel.webContents)?.finishRecording.send()
    }
  }

  /**
   * Start voice activation listening
   */
  start(): void {
    if (!this.isInitialized) {
      console.error("Voice activation not initialized")
      return
    }

    state.voiceActivation.isListening = true

    // Send command to renderer process to start audio monitoring
    if (this.voiceActivationWindow) {
      this.voiceActivationWindow.webContents.send('voice-activation:start')
    }

    console.log("Voice activation started")
  }

  /**
   * Stop voice activation listening
   */
  stop(): void {
    state.voiceActivation.isListening = false

    // Clean up any active timers
    if (state.voiceActivation.silenceTimer) {
      clearTimeout(state.voiceActivation.silenceTimer)
      state.voiceActivation.silenceTimer = null
    }

    // Stop any active recording
    if (state.isRecording) {
      stopRecordingAndHidePanelWindow()
    }

    // Send command to renderer process to stop audio monitoring
    if (this.voiceActivationWindow) {
      this.voiceActivationWindow.webContents.send('voice-activation:stop')
    }

    console.log("Voice activation stopped")
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stop()

    // Remove IPC handlers
    ipcMain.removeAllListeners('voice-activation:voice-detected')
    ipcMain.removeAllListeners('voice-activation:silence-detected')
    ipcMain.removeAllListeners('voice-activation:audio-level')

    if (this.voiceActivationWindow && !this.voiceActivationWindow.isDestroyed()) {
      this.voiceActivationWindow.close()
      this.voiceActivationWindow = null
    }

    this.isInitialized = false
    console.log("Voice activation manager cleaned up")
  }

  /**
   * Get current audio level (0-100)
   */
  getAudioLevel(): number {
    return state.voiceActivation.audioLevel
  }

  /**
   * Check if voice activation is listening
   */
  isListening(): boolean {
    return state.voiceActivation.isListening
  }
}

// Global voice activation manager instance
let voiceManager: VoiceActivationManager | null = null

/**
 * Initialize voice activation system
 */
export async function initVoiceActivation(): Promise<boolean> {
  if (voiceManager) {
    voiceManager.cleanup()
  }

  voiceManager = new VoiceActivationManager()
  const success = await voiceManager.initialize()

  if (success) {
    state.voiceActivation.isEnabled = true
  }

  return success
}

/**
 * Start voice activation
 */
export function startVoiceActivation(): void {
  if (!voiceManager) {
    console.error("Voice activation not initialized")
    return
  }

  voiceManager.start()
}

/**
 * Stop voice activation
 */
export function stopVoiceActivation(): void {
  if (!voiceManager) return

  voiceManager.stop()
}

/**
 * Toggle voice activation on/off
 */
export function toggleVoiceActivation(): void {
  if (!voiceManager) return

  if (voiceManager.isListening()) {
    stopVoiceActivation()
  } else {
    startVoiceActivation()
  }
}

/**
 * Clean up voice activation resources
 */
export function cleanupVoiceActivation(): void {
  if (voiceManager) {
    voiceManager.cleanup()
    voiceManager = null
  }

  state.voiceActivation.isEnabled = false
}

/**
 * Get current voice activation status
 */
export function getVoiceActivationStatus() {
  return {
    isEnabled: state.voiceActivation.isEnabled,
    isListening: state.voiceActivation.isListening,
    audioLevel: state.voiceActivation.audioLevel,
  }
}
