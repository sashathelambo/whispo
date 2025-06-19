import type {
    CHAT_PROVIDER_ID,
    EnhancedShortcut,
    HOLD_KEY_OPTION,
    KeyCombination,
    SHORTCUT_OPTION,
    STT_PROVIDER_ID,
    VOICE_ACTIVATION_SHORTCUT
} from "."

export type { CHAT_PROVIDER_ID, STT_PROVIDER_ID }

// **PROVIDER STATUS AND CONFIGURATION TYPES**

/**
 * Individual provider status and configuration
 * Tracks both availability (has API key) and enabled state (user preference)
 */
export type ProviderStatus = {
  enabled: boolean              // User preference: is this provider enabled?
  available: boolean            // System state: is this provider configured with API key?
  hasValidKey: boolean         // Validation state: is the API key valid?
  lastValidated?: number       // Timestamp of last validation
  lastError?: string           // Last error message if any
  usageCount?: number          // Usage statistics
}

/**
 * Provider configuration combining status and settings
 */
export type ProviderConfig = {
  status: ProviderStatus
  apiKey?: string
  baseUrl?: string
  customName?: string          // User-defined name override
  priority?: number            // Provider priority for fallback logic
  timeout?: number             // Custom timeout in milliseconds
}

/**
 * Comprehensive provider configurations for all supported providers
 */
export type ProvidersConfig = {
  openai: ProviderConfig
  groq: ProviderConfig
  gemini: ProviderConfig
  // Future providers can be added here
}

/**
 * Provider availability summary for quick checks
 */
export type ProviderAvailability = {
  availableSTTProviders: STT_PROVIDER_ID[]     // STT providers that are enabled and available
  availableChatProviders: CHAT_PROVIDER_ID[]   // Chat providers that are enabled and available
  hasAnySTTProvider: boolean                   // Quick check: any STT provider available?
  hasAnyChatProvider: boolean                  // Quick check: any Chat provider available?
  primarySTTProvider?: STT_PROVIDER_ID         // Best available STT provider
  primaryChatProvider?: CHAT_PROVIDER_ID       // Best available Chat provider
}

/**
 * Provider health status for monitoring
 */
export type ProviderHealth = {
  providerId: STT_PROVIDER_ID | CHAT_PROVIDER_ID
  isHealthy: boolean
  responseTime?: number        // Average response time in ms
  successRate?: number         // Success rate percentage (0-100)
  lastCheck: number           // Timestamp of last health check
  errorCount: number          // Number of recent errors
}

// **EXISTING TYPES CONTINUE BELOW**

export type RecordingHistoryItem = {
  id: string
  createdAt: number
  duration: number
  transcript: string
  originalTranscript?: string  // Added: Original transcript before AI post-processing
  isOriginalShown?: boolean    // Added: Track if showing original or processed version
}

// Application context types for formatting
export type ApplicationContext =
  | "code-editor"          // VS Code, IntelliJ, etc.
  | "terminal"             // Command line interfaces
  | "email"                // Email clients
  | "chat"                 // Slack, Discord, Teams
  | "document"             // Word, Google Docs, etc.
  | "browser"              // Web browsers
  | "notes"                // Note-taking apps
  | "presentation"         // PowerPoint, etc.
  | "design"               // Figma, Adobe, etc.
  | "generic"              // Default/unknown

// Formatting configuration for different contexts
export type ContextFormatting = {
  enabled: boolean
  context: ApplicationContext
  prompt: string           // Custom formatting prompt
  enableCodeFormatting?: boolean     // For code contexts
  enableListFormatting?: boolean     // Convert to bullet points
  enableProfessionalTone?: boolean   // For email/business contexts
  enableTechnicalTerms?: boolean     // Preserve technical terminology
  customInstructions?: string        // Additional formatting instructions
}

// App-specific rule configuration
export type AppRule = {
  id: string
  appName: string          // Application name/title pattern
  executable?: string      // Executable name pattern (optional)
  enabled: boolean

  // Enhanced shortcut system (supports multiple shortcuts per rule)
  shortcuts?: EnhancedShortcut[]  // Multiple shortcuts for the same action

  // Legacy support (will be migrated to shortcuts array)
  shortcut?: SHORTCUT_OPTION
  holdKey?: HOLD_KEY_OPTION // Which key to hold for hold-key shortcut
  keyCombination?: KeyCombination // Multi-key combination

  sttProviderId?: STT_PROVIDER_ID
  transcriptPostProcessingEnabled?: boolean
  transcriptPostProcessingProviderId?: CHAT_PROVIDER_ID
  transcriptPostProcessingPrompt?: string
  autoInsert?: boolean     // Whether to auto-insert transcript
  priority: number         // Rule priority (higher number = higher priority)

  // Context-aware formatting
  contextFormatting?: ContextFormatting
}

// Voice activation configuration
export type VoiceActivationConfig = {
  enabled: boolean
  sensitivity: number      // Voice detection sensitivity (0-100)
  silenceThreshold: number // Silence duration in ms before stopping
  noiseGate: number       // Noise gate level (0-100)
  minRecordingDuration: number // Minimum recording duration in ms
  maxRecordingDuration: number // Maximum recording duration in ms
}

/**
 * Streaming Dictation Configuration
 * For real-time speech-to-text that types as you speak
 */
export type StreamingDictationConfig = {
  enabled: boolean
  language: string         // Speech recognition language (e.g., 'en-US')
  continuous: boolean      // Whether to keep listening continuously
  interimResults: boolean  // Show partial results while speaking
  maxAlternatives: number  // Number of alternative transcriptions
  sensitivity: number      // Voice detection sensitivity (0-100)
  punctuationMode: 'auto' | 'manual' | 'disabled' // How to handle punctuation
  capitalizationMode: 'auto' | 'manual' | 'disabled' // How to handle capitalization
  pauseOnSilence: number   // Milliseconds of silence before pausing (0 = never pause)
  insertMode: 'replace' | 'append' | 'insert' // How to insert text in fields
  enableVoiceCommands: boolean // Enable voice commands like "new line", "delete"
  contextFormatting: boolean // Apply context-aware formatting
}

/**
 * Streaming Dictation State
 * Runtime state for streaming dictation system
 */
export type StreamingDictationState = {
  isActive: boolean        // Is streaming dictation currently active
  isListening: boolean     // Is actively listening for speech
  currentText: string      // Current text being built
  lastFinalText: string    // Last finalized text segment
  confidence: number       // Confidence of current recognition (0-1)
  audioLevel: number       // Current audio input level (0-100)
  language: string         // Current recognition language
  startTime: number        // When current session started
  wordsSpoken: number      // Count of words in current session
}

// Fusion Transcription Types
export type FusionStrategy =
  | "best-confidence"     // Select result with highest confidence
  | "majority-vote"       // Use most common words/phrases
  | "weighted-average"    // Weight by provider reliability
  | "consensus"          // Require agreement between providers
  | "primary-fallback"   // Use primary, fallback to others on failure

export type FusionResult = {
  finalTranscript: string
  confidence: number
  strategy: FusionStrategy
  results: TranscriptionResult[]
  processingTime: number
  providersUsed: STT_PROVIDER_ID[]
}

export type TranscriptionResult = {
  provider: STT_PROVIDER_ID
  transcript: string
  confidence: number
  processingTime: number
  success: boolean
  error?: string
}

export type FusionConfig = {
  enabled: boolean
  strategy: FusionStrategy
  providers: STT_PROVIDER_ID[]        // Which providers to use in fusion
  primaryProvider?: STT_PROVIDER_ID   // Primary provider for fallback strategy
  timeoutMs: number                   // Timeout for each provider
  minProvidersRequired: number        // Minimum successful providers needed
  confidenceThreshold: number         // Minimum confidence to accept result
  enableParallel: boolean            // Process providers in parallel vs sequential
  providerWeights: Partial<Record<STT_PROVIDER_ID, number>> // Weights for weighted-average
}

// Global context-aware formatting configuration
export type GlobalContextFormatting = {
  enabled: boolean
  autoDetectContext: boolean           // Automatically detect application context
  fallbackContext: ApplicationContext // Default context when detection fails
  enableSmartFormatting: boolean       // Use AI for intelligent formatting
  preserveOriginalOnError: boolean     // Keep original text if formatting fails
}

export type Config = {
  // Enhanced shortcut system
  shortcuts?: EnhancedShortcut[]     // Multiple global shortcuts
  handsFreeModeShortcut?: KeyCombination  // Assignable shortcut for hands-free mode toggle

  // Legacy support (will be migrated to shortcuts array)
  shortcut?: SHORTCUT_OPTION
  holdKey?: HOLD_KEY_OPTION // Which key to hold for hold-key shortcut
  keyCombination?: KeyCombination // Multi-key combination

  hideDockIcon?: boolean

  sttProviderId?: STT_PROVIDER_ID

  // **NEW: Comprehensive Provider Configuration**
  providers?: ProvidersConfig      // Enhanced provider management with enable/disable

  // **LEGACY: Individual Provider Settings (for migration)**
  openaiApiKey?: string
  openaiBaseUrl?: string
  groqApiKey?: string
  groqBaseUrl?: string
  geminiApiKey?: string
  geminiBaseUrl?: string

  transcriptPostProcessingEnabled?: boolean
  transcriptPostProcessingProviderId?: CHAT_PROVIDER_ID
  transcriptPostProcessingPrompt?: string

  // Voice Activation Mode Configuration
  voiceActivation?: VoiceActivationConfig
  voiceActivationShortcut?: VOICE_ACTIVATION_SHORTCUT // Type of voice activation

  // **NEW: Streaming Dictation Configuration**
  streamingDictation?: StreamingDictationConfig // Real-time speech-to-text typing

  // App-Specific Rules Configuration
  appRules?: AppRule[]
  enableAppRules?: boolean

  // Fusion Transcription Configuration
  fusionTranscription?: FusionConfig

  // Global Context-Aware Formatting
  contextFormatting?: GlobalContextFormatting
}

// Settings Profile Types
export type SettingsProfile = {
  id: string
  name: string
  description?: string
  config: Config
  createdAt: number
  updatedAt: number
  isDefault?: boolean
}

export type ProfilesConfig = {
  profiles: SettingsProfile[]
  activeProfileId?: string
}
