/**
 * Streaming Dictation Module
 * Implements real-time speech-to-text that types as you speak
 * Uses WebSpeech API for continuous recognition with live text insertion
 */

import { DEFAULT_STREAMING_DICTATION_CONFIG } from "@shared/index"
import type { StreamingDictationConfig, StreamingDictationState } from "@shared/types"
import { BrowserWindow, ipcMain } from "electron"
import path from "path"
import { configStore } from "./config"
import { writeText } from "./keyboard"
import { state } from "./state"
import { isAccessibilityGranted } from "./utils"

/**
 * Streaming Dictation Manager
 * Manages real-time speech recognition and text insertion
 */
export class StreamingDictationManager {
  private isInitialized = false
  private recognitionWindow: BrowserWindow | null = null
  private currentState: StreamingDictationState = {
    isActive: false,
    isListening: false,
    currentText: '',
    lastFinalText: '',
    confidence: 0,
    audioLevel: 0,
    language: 'en-US',
    startTime: 0,
    wordsSpoken: 0,
  }

  /**
   * Initialize the streaming dictation system
   */
  async initialize(): Promise<boolean> {
    try {
      // Create a hidden window for speech recognition processing
      this.recognitionWindow = new BrowserWindow({
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

      // Set up IPC handlers for streaming dictation events
      this.setupIpcHandlers()

      // Load the streaming dictation HTML content
      await this.recognitionWindow.loadURL(`data:text/html,${this.getStreamingDictationHTML()}`)

      this.isInitialized = true
      console.log("Streaming dictation manager initialized")
      return true

    } catch (error) {
      console.error("Failed to initialize streaming dictation:", error)
      return false
    }
  }

  /**
   * Set up IPC handlers for communication with recognition window
   */
  private setupIpcHandlers(): void {
    ipcMain.on('streaming-dictation:text-update', (_, data: {
      text: string;
      isFinal: boolean;
      confidence: number
    }) => {
      this.onTextUpdate(data.text, data.isFinal, data.confidence)
    })

    ipcMain.on('streaming-dictation:voice-command', (_, command: string) => {
      this.onVoiceCommand(command)
    })

    ipcMain.on('streaming-dictation:error', (_, error: string) => {
      this.onRecognitionError(error)
    })

    ipcMain.on('streaming-dictation:audio-level', (_, level: number) => {
      this.currentState.audioLevel = level
    })

    ipcMain.on('streaming-dictation:recognition-started', () => {
      this.currentState.isListening = true
      console.log("Speech recognition started")
    })

    ipcMain.on('streaming-dictation:recognition-ended', () => {
      this.currentState.isListening = false
      console.log("Speech recognition ended")
    })
  }

  /**
   * Get the HTML content for streaming dictation window
   */
  private getStreamingDictationHTML(): string {
    const config = this.getConfig()

    return encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head><title>Streaming Dictation</title></head>
        <body>
          <script>
            const { ipcRenderer } = require('electron');

            // WebSpeech API integration for real-time recognition
            let recognition = null;
            let isActive = false;
            let currentText = '';
            let lastFinalText = '';

            // Audio level monitoring
            let audioContext = null;
            let analyser = null;
            let dataArray = null;
            let mediaStream = null;
            let animationId = null;

            // Voice command processing
            const voiceCommands = ${JSON.stringify(config.enableVoiceCommands ? [
              'new line', 'new paragraph', 'delete', 'delete line',
              'undo', 'stop dictation', 'pause dictation', 'resume dictation'
            ] : [])};

            async function initAudioLevelMonitoring() {
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
                source.connect(analyser);

                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);

                return true;
              } catch (error) {
                console.error('Failed to initialize audio monitoring:', error);
                return false;
              }
            }

            function monitorAudioLevel() {
              if (!analyser || !dataArray) return;

              analyser.getByteFrequencyData(dataArray);

              // Calculate RMS
              let rms = 0;
              for (let i = 0; i < dataArray.length; i++) {
                rms += dataArray[i] * dataArray[i];
              }
              rms = Math.sqrt(rms / dataArray.length);

              const audioLevel = Math.min(100, (rms / 255) * 100);
              ipcRenderer.send('streaming-dictation:audio-level', audioLevel);

              if (isActive) {
                animationId = requestAnimationFrame(monitorAudioLevel);
              }
            }

            function initSpeechRecognition() {
              if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                ipcRenderer.send('streaming-dictation:error', 'Speech recognition not supported in this browser');
                return false;
              }

              const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
              recognition = new SpeechRecognition();

              // Configure recognition
              recognition.continuous = ${config.continuous};
              recognition.interimResults = ${config.interimResults};
              recognition.maxAlternatives = ${config.maxAlternatives};
              recognition.lang = '${config.language}';

              // Event handlers
              recognition.onstart = () => {
                console.log('Speech recognition started');
                ipcRenderer.send('streaming-dictation:recognition-started');
              };

              recognition.onend = () => {
                console.log('Speech recognition ended');
                ipcRenderer.send('streaming-dictation:recognition-ended');

                // Restart if still active and continuous mode
                if (isActive && ${config.continuous}) {
                  setTimeout(() => {
                    if (isActive) recognition.start();
                  }, 100);
                }
              };

              recognition.onresult = (event) => {
                let interimText = '';
                let finalText = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                  const result = event.results[i];
                  const transcript = result[0].transcript;
                  const confidence = result[0].confidence || 0.8;

                  if (result.isFinal) {
                    finalText += transcript;

                    // Check for voice commands
                    const trimmedTranscript = transcript.trim().toLowerCase();
                    if (voiceCommands.includes(trimmedTranscript)) {
                      ipcRenderer.send('streaming-dictation:voice-command', trimmedTranscript);
                      return; // Don't process as regular text
                    }

                    ipcRenderer.send('streaming-dictation:text-update', {
                      text: finalText,
                      isFinal: true,
                      confidence: confidence
                    });
                  } else {
                    interimText += transcript;
                    ipcRenderer.send('streaming-dictation:text-update', {
                      text: interimText,
                      isFinal: false,
                      confidence: confidence
                    });
                  }
                }
              };

              recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                ipcRenderer.send('streaming-dictation:error', event.error);
              };

              return true;
            }

            // Listen for commands from main process
            ipcRenderer.on('streaming-dictation:start', async () => {
              console.log('Starting streaming dictation');
              isActive = true;

              // Initialize audio monitoring
              await initAudioLevelMonitoring();
              monitorAudioLevel();

              // Initialize and start speech recognition
              if (initSpeechRecognition()) {
                recognition.start();
              }
            });

            ipcRenderer.on('streaming-dictation:stop', () => {
              console.log('Stopping streaming dictation');
              isActive = false;

              if (recognition) {
                recognition.stop();
              }

              if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
              }
            });

            ipcRenderer.on('streaming-dictation:pause', () => {
              console.log('Pausing streaming dictation');
              if (recognition) {
                recognition.stop();
              }
            });

            ipcRenderer.on('streaming-dictation:resume', () => {
              console.log('Resuming streaming dictation');
              if (recognition && isActive) {
                recognition.start();
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

            console.log('Streaming dictation window loaded');
          </script>
        </body>
      </html>
    `)
  }

  /**
   * Handle text updates from speech recognition
   */
  private async onTextUpdate(text: string, isFinal: boolean, confidence: number): Promise<void> {
    this.currentState.confidence = confidence

    if (isFinal) {
      // Process final text and insert it
      this.currentState.lastFinalText = text
      this.currentState.currentText = ''

      // Count words
      const words = text.trim().split(/\s+/).filter(w => w.length > 0)
      this.currentState.wordsSpoken += words.length

      // Insert text into the focused application
      await this.insertText(text)
    } else {
      // Update interim text
      this.currentState.currentText = text
    }
  }

  /**
   * Handle voice commands
   */
  private async onVoiceCommand(command: string): Promise<void> {
    console.log(`Processing voice command: ${command}`)

    switch (command.toLowerCase()) {
      case 'new line':
        await this.insertText('\n')
        break
      case 'new paragraph':
        await this.insertText('\n\n')
        break
      case 'delete':
        // This would require more complex text management
        console.log('Delete command - implementation needed')
        break
      case 'delete line':
        // This would require more complex text management
        console.log('Delete line command - implementation needed')
        break
      case 'stop dictation':
        this.stop()
        break
      case 'pause dictation':
        this.pause()
        break
      case 'resume dictation':
        this.resume()
        break
    }
  }

  /**
   * Handle recognition errors
   */
  private onRecognitionError(error: string): void {
    console.error('Speech recognition error:', error)
    // Could show user notification or try to restart
  }

  /**
   * Insert text into the currently focused application
   */
  private async insertText(text: string): Promise<void> {
    if (!isAccessibilityGranted()) {
      console.warn('Accessibility not granted, cannot insert text')
      return
    }

    try {
      // Use the existing writeText function from keyboard.ts
      await writeText(text)
    } catch (error) {
      console.error('Failed to insert text:', error)
    }
  }

  /**
   * Get current streaming dictation configuration
   */
  private getConfig(): StreamingDictationConfig {
    const config = configStore.get()
    return {
      ...DEFAULT_STREAMING_DICTATION_CONFIG,
      ...config.streamingDictation
    }
  }

  /**
   * Start streaming dictation
   */
  start(): void {
    if (!this.isInitialized) {
      console.error("Streaming dictation not initialized")
      return
    }

    this.currentState.isActive = true
    this.currentState.startTime = Date.now()
    this.currentState.wordsSpoken = 0

    // Send command to renderer process to start recognition
    if (this.recognitionWindow) {
      this.recognitionWindow.webContents.send('streaming-dictation:start')
    }

    console.log("Streaming dictation started")
  }

  /**
   * Stop streaming dictation
   */
  stop(): void {
    this.currentState.isActive = false
    this.currentState.isListening = false

    // Send command to renderer process to stop recognition
    if (this.recognitionWindow) {
      this.recognitionWindow.webContents.send('streaming-dictation:stop')
    }

    console.log("Streaming dictation stopped")
  }

  /**
   * Pause streaming dictation
   */
  pause(): void {
    if (this.recognitionWindow) {
      this.recognitionWindow.webContents.send('streaming-dictation:pause')
    }
    console.log("Streaming dictation paused")
  }

  /**
   * Resume streaming dictation
   */
  resume(): void {
    if (this.recognitionWindow) {
      this.recognitionWindow.webContents.send('streaming-dictation:resume')
    }
    console.log("Streaming dictation resumed")
  }

  /**
   * Get current streaming dictation state
   */
  getState(): StreamingDictationState {
    return { ...this.currentState }
  }

  /**
   * Check if streaming dictation is active
   */
  isActive(): boolean {
    return this.currentState.isActive
  }

  /**
   * Check if currently listening
   */
  isListening(): boolean {
    return this.currentState.isListening
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stop()

    // Remove IPC handlers
    ipcMain.removeAllListeners('streaming-dictation:text-update')
    ipcMain.removeAllListeners('streaming-dictation:voice-command')
    ipcMain.removeAllListeners('streaming-dictation:error')
    ipcMain.removeAllListeners('streaming-dictation:audio-level')
    ipcMain.removeAllListeners('streaming-dictation:recognition-started')
    ipcMain.removeAllListeners('streaming-dictation:recognition-ended')

    if (this.recognitionWindow && !this.recognitionWindow.isDestroyed()) {
      this.recognitionWindow.close()
      this.recognitionWindow = null
    }

    this.isInitialized = false
    console.log("Streaming dictation manager cleaned up")
  }
}

// Global streaming dictation manager instance
let streamingManager: StreamingDictationManager | null = null

/**
 * Initialize streaming dictation system
 */
export async function initStreamingDictation(): Promise<boolean> {
  if (streamingManager) {
    streamingManager.cleanup()
  }

  streamingManager = new StreamingDictationManager()
  const success = await streamingManager.initialize()

  if (success) {
    state.streamingDictation = {
      isEnabled: true,
      ...streamingManager.getState()
    }
  }

  return success
}

/**
 * Start streaming dictation
 */
export function startStreamingDictation(): void {
  if (!streamingManager) {
    console.error("Streaming dictation not initialized")
    return
  }

  streamingManager.start()
}

/**
 * Stop streaming dictation
 */
export function stopStreamingDictation(): void {
  if (!streamingManager) return
  streamingManager.stop()
}

/**
 * Pause streaming dictation
 */
export function pauseStreamingDictation(): void {
  if (!streamingManager) return
  streamingManager.pause()
}

/**
 * Resume streaming dictation
 */
export function resumeStreamingDictation(): void {
  if (!streamingManager) return
  streamingManager.resume()
}

/**
 * Toggle streaming dictation on/off
 */
export function toggleStreamingDictation(): void {
  if (!streamingManager) return

  if (streamingManager.isActive()) {
    stopStreamingDictation()
  } else {
    startStreamingDictation()
  }
}

/**
 * Clean up streaming dictation resources
 */
export function cleanupStreamingDictation(): void {
  if (streamingManager) {
    streamingManager.cleanup()
    streamingManager = null
  }

  if (state.streamingDictation) {
    state.streamingDictation.isEnabled = false
  }
}

/**
 * Get current streaming dictation status
 */
export function getStreamingDictationStatus() {
  if (!streamingManager) {
    return {
      isEnabled: false,
      isActive: false,
      isListening: false,
      audioLevel: 0,
      confidence: 0,
      currentText: '',
      wordsSpoken: 0,
    }
  }

  const state = streamingManager.getState()
  return {
    isEnabled: true,
    isActive: state.isActive,
    isListening: state.isListening,
    audioLevel: state.audioLevel,
    confidence: state.confidence,
    currentText: state.currentText,
    wordsSpoken: state.wordsSpoken,
  }
}
