import {
    DEFAULT_CONTEXT_FORMATTING,
    DEFAULT_FUSION_CONFIG,
    DEFAULT_STREAMING_DICTATION_CONFIG
} from "@shared/index"
import type {
    CHAT_PROVIDER_ID,
    Config,
    ProviderAvailability,
    ProviderConfig,
    ProvidersConfig,
    ProviderStatus,
    SettingsProfile,
    STT_PROVIDER_ID
} from "@shared/types"
import { app } from "electron"
import ElectronStore from "electron-store"
import path from "path"

export const dataFolder = path.join(app.getPath("appData"), process.env.APP_ID)

export const recordingsFolder = path.join(dataFolder, "recordings")

export const configPath = path.join(dataFolder, "config.json")

// **PROVIDER CONFIGURATION HELPERS**

/**
 * Create default provider status
 */
function createDefaultProviderStatus(): ProviderStatus {
  return {
    enabled: true,              // Default to enabled
    available: false,           // Will be determined by API key presence
    hasValidKey: false,         // Will be validated on first use
    lastValidated: undefined,
    lastError: undefined,
    usageCount: 0
  }
}

/**
 * Create default provider configuration
 */
function createDefaultProviderConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    status: createDefaultProviderStatus(),
    apiKey: "",
    baseUrl: "",
    priority: 1,
    timeout: 30000,
    ...overrides
  }
}

/**
 * Default provider configurations for all supported providers
 */
const defaultProvidersConfig: ProvidersConfig = {
  openai: createDefaultProviderConfig({
    baseUrl: "https://api.openai.com/v1",
    priority: 1,
    status: { ...createDefaultProviderStatus(), enabled: true }
  }),
  groq: createDefaultProviderConfig({
    baseUrl: "https://api.groq.com/openai/v1",
    priority: 2,
    status: { ...createDefaultProviderStatus(), enabled: true }
  }),
  gemini: createDefaultProviderConfig({
    baseUrl: "https://generativelanguage.googleapis.com",
    priority: 3,
    status: { ...createDefaultProviderStatus(), enabled: true }
  })
}

/**
 * Check if a provider is available (enabled and has API key)
 */
export function isProviderAvailable(config: Config, providerId: STT_PROVIDER_ID | CHAT_PROVIDER_ID): boolean {
  // Check new provider configuration first
  if (config.providers?.[providerId as keyof ProvidersConfig]) {
    const provider = config.providers[providerId as keyof ProvidersConfig]
    return provider.status.enabled && !!provider.apiKey && provider.apiKey.trim() !== ""
  }

  // Fallback to legacy configuration
  switch (providerId) {
    case "openai":
      return !!config.openaiApiKey && config.openaiApiKey.trim() !== ""
    case "groq":
      return !!config.groqApiKey && config.groqApiKey.trim() !== ""
    case "gemini":
      return !!config.geminiApiKey && config.geminiApiKey.trim() !== ""
    default:
      return false
  }
}

/**
 * Get available providers for STT and Chat
 */
export function getProviderAvailability(config: Config): ProviderAvailability {
  const sttProviders: STT_PROVIDER_ID[] = ["openai", "groq"]
  const chatProviders: CHAT_PROVIDER_ID[] = ["openai", "groq", "gemini"]

  const availableSTTProviders = sttProviders.filter(provider => isProviderAvailable(config, provider))
  const availableChatProviders = chatProviders.filter(provider => isProviderAvailable(config, provider))

  // Get primary providers (highest priority available)
  const primarySTTProvider = availableSTTProviders
    .sort((a, b) => {
      const priorityA = config.providers?.[a]?.priority || 999
      const priorityB = config.providers?.[b]?.priority || 999
      return priorityA - priorityB
    })[0]

  const primaryChatProvider = availableChatProviders
    .sort((a, b) => {
      const priorityA = config.providers?.[a]?.priority || 999
      const priorityB = config.providers?.[b]?.priority || 999
      return priorityA - priorityB
    })[0]

  return {
    availableSTTProviders,
    availableChatProviders,
    hasAnySTTProvider: availableSTTProviders.length > 0,
    hasAnyChatProvider: availableChatProviders.length > 0,
    primarySTTProvider,
    primaryChatProvider
  }
}

/**
 * Migrate legacy provider configuration to new format
 */
export function migrateProvidersConfig(config: Config): ProvidersConfig {
  const providers: ProvidersConfig = JSON.parse(JSON.stringify(defaultProvidersConfig))

  // Migrate OpenAI
  if (config.openaiApiKey || config.openaiBaseUrl) {
    providers.openai.apiKey = config.openaiApiKey || ""
    providers.openai.baseUrl = config.openaiBaseUrl || providers.openai.baseUrl
    providers.openai.status.available = !!config.openaiApiKey && config.openaiApiKey.trim() !== ""
  }

  // Migrate Groq
  if (config.groqApiKey || config.groqBaseUrl) {
    providers.groq.apiKey = config.groqApiKey || ""
    providers.groq.baseUrl = config.groqBaseUrl || providers.groq.baseUrl
    providers.groq.status.available = !!config.groqApiKey && config.groqApiKey.trim() !== ""
  }

  // Migrate Gemini
  if (config.geminiApiKey || config.geminiBaseUrl) {
    providers.gemini.apiKey = config.geminiApiKey || ""
    providers.gemini.baseUrl = config.geminiBaseUrl || providers.gemini.baseUrl
    providers.gemini.status.available = !!config.geminiApiKey && config.geminiApiKey.trim() !== ""
  }

  return providers
}

// Default configuration
const defaultConfig: Config = {
  // **NEW: Enhanced Provider Configuration**
  providers: defaultProvidersConfig,

  // **LEGACY: Individual Provider Settings (maintained for backward compatibility)**
  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  groqApiKey: "",
  geminiApiKey: "",

  // STT & Post-processing provider selection
  sttProviderId: "openai",
  transcriptPostProcessingEnabled: true,
  transcriptPostProcessingProviderId: "openai",
  transcriptPostProcessingPrompt: `Rewrite this for clarity and fix any transcription errors. Use the same language as the original input. Don't add extra explanations.

{transcript}`,

  // Shortcut configuration
  shortcut: "hold-key",
  holdKey: "AltLeft+Space", // Default Alt+Space combination for hold-key mode (prevents accidental activation)

  // UI preferences
  hideDockIcon: false,

  // Voice activation settings
  voiceActivation: {
    enabled: false,
    sensitivity: 30,
    silenceThreshold: 2000,
    noiseGate: 20,
    minRecordingDuration: 500,
    maxRecordingDuration: 30000,
  },

  // **NEW: Streaming Dictation settings**
  streamingDictation: DEFAULT_STREAMING_DICTATION_CONFIG,

  // App-specific rules
  enableAppRules: false,
  appRules: [],

  // Fusion transcription settings
  fusionTranscription: {
    ...DEFAULT_FUSION_CONFIG,
    providers: [...DEFAULT_FUSION_CONFIG.providers] as ("openai" | "groq")[],
  },

  // Context-aware formatting settings
  contextFormatting: {
    ...DEFAULT_CONTEXT_FORMATTING,
  },
}

// Simple config store wrapper for now (profiles can be added later)
class ConfigStoreWrapper {
  private store: ElectronStore<Config>

  constructor(options: any) {
    this.store = new ElectronStore<Config>(options)
  }

  get(): Config {
    return (this.store as any).store as Config
  }

  save(config: Config): void {
    (this.store as any).store = config
  }

  set(key: keyof Config, value: any): void {
    (this.store as any).set(key, value)
  }

  // Placeholder methods for profiles (to be implemented later)
  getProfiles(): SettingsProfile[] {
    return [{
      id: 'default',
      name: 'Default',
      description: 'Default configuration profile',
      config: this.get(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    }]
  }

  getActiveProfileId(): string | undefined {
    return 'default'
  }

  createProfile(_name: string, _description?: string, _baseConfig?: Config): SettingsProfile {
    // TODO: Implement profiles
    throw new Error("Profiles not implemented yet")
  }

  updateProfile(_profileId: string, _updates: Partial<SettingsProfile>): void {
    // TODO: Implement profiles
  }

  deleteProfile(_profileId: string): boolean {
    // TODO: Implement profiles
    return false
  }

  switchProfile(_profileId: string): boolean {
    // TODO: Implement profiles
    return false
  }
}

export const configStore = new ConfigStoreWrapper({
  defaults: defaultConfig,
  migrations: {
    ">=1.0.0": (store) => {
      // Migrate old "hold-ctrl" shortcut to new "hold-key" with default ControlLeft
      const currentShortcut = store.get("shortcut")
      if (currentShortcut === "hold-ctrl") {
        store.set("shortcut", "hold-key")
        if (!store.get("holdKey")) {
          store.set("holdKey", "ControlLeft")
        }
      }

      // Ensure holdKey has a default value if not set
      if (store.get("shortcut") === "hold-key" && !store.get("holdKey")) {
        store.set("holdKey", "ControlLeft")
      }

      // Add default context formatting if not present
      if (!store.get("contextFormatting")) {
        store.set("contextFormatting", DEFAULT_CONTEXT_FORMATTING)
      }

      // **NEW: Migrate to enhanced provider configuration**
      if (!store.get("providers")) {
        console.log("Migrating legacy provider configuration to enhanced format...")
        const currentConfig = store.store as Config
        const migratedProviders = migrateProvidersConfig(currentConfig)

        store.set("providers", migratedProviders)
        console.log("Provider configuration migration completed")

        // Log migration summary
        const availability = getProviderAvailability({ ...currentConfig, providers: migratedProviders })
        console.log("Provider availability after migration:", {
          availableSTT: availability.availableSTTProviders,
          availableChat: availability.availableChatProviders,
          primarySTT: availability.primarySTTProvider,
          primaryChat: availability.primaryChatProvider
        })
      }
    },
  },
})
