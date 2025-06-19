import { AppRule, StreamingDictationState } from "@shared/types"

export const state = {
  isRecording: false,

  // Voice Activation Mode state
  voiceActivation: {
    isEnabled: false,
    isListening: false,
    audioLevel: 0,
    silenceTimer: null as NodeJS.Timeout | null,
    recordingStartTime: 0,
  },

  // Streaming Dictation Mode state
  streamingDictation: {
    isEnabled: false,
    isActive: false,
    isListening: false,
    currentText: '',
    lastFinalText: '',
    confidence: 0,
    audioLevel: 0,
    language: 'en-US',
    startTime: 0,
    wordsSpoken: 0,
  } as StreamingDictationState & { isEnabled: boolean },

  // Active application tracking
  activeApp: {
    name: '',
    executable: '',
    title: '',
    lastUpdated: 0,
  },

  // Current active rule based on application
  activeRule: null as AppRule | null,
}
