export const STT_PROVIDERS = [
  {
    label: "OpenAI",
    value: "openai",
  },
  {
    label: "Groq",
    value: "groq",
  },
] as const

export type STT_PROVIDER_ID = (typeof STT_PROVIDERS)[number]["value"]

export const CHAT_PROVIDERS = [
  {
    label: "OpenAI",
    value: "openai",
  },
  {
    label: "Groq",
    value: "groq",
  },
  {
    label: "Gemini",
    value: "gemini",
  },
] as const

export type CHAT_PROVIDER_ID = (typeof CHAT_PROVIDERS)[number]["value"]

// **PROVIDER FILTERING HELPERS**

/**
 * Filter STT providers to only show enabled and available ones
 * @param config - Application configuration
 * @returns Array of available STT provider options
 */
export function getAvailableSTTProviders(config?: any) {
  if (!config?.providers) {
    // Fallback to legacy configuration check
    return STT_PROVIDERS.filter(provider => {
      switch (provider.value) {
        case "openai":
          return !!config?.openaiApiKey && config.openaiApiKey.trim() !== ""
        case "groq":
          return !!config?.groqApiKey && config.groqApiKey.trim() !== ""
        default:
          return false
      }
    })
  }

  // Use new provider configuration
  return STT_PROVIDERS.filter(provider => {
    const providerConfig = config.providers[provider.value]
    return providerConfig?.status?.enabled &&
           providerConfig?.status?.available &&
           !!providerConfig?.apiKey &&
           providerConfig.apiKey.trim() !== ""
  })
}

/**
 * Filter Chat providers to only show enabled and available ones
 * @param config - Application configuration
 * @returns Array of available Chat provider options
 */
export function getAvailableChatProviders(config?: any) {
  if (!config?.providers) {
    // Fallback to legacy configuration check
    return CHAT_PROVIDERS.filter(provider => {
      switch (provider.value) {
        case "openai":
          return !!config?.openaiApiKey && config.openaiApiKey.trim() !== ""
        case "groq":
          return !!config?.groqApiKey && config.groqApiKey.trim() !== ""
        case "gemini":
          return !!config?.geminiApiKey && config.geminiApiKey.trim() !== ""
        default:
          return false
      }
    })
  }

  // Use new provider configuration
  return CHAT_PROVIDERS.filter(provider => {
    const providerConfig = config.providers[provider.value]
    return providerConfig?.status?.enabled &&
           providerConfig?.status?.available &&
           !!providerConfig?.apiKey &&
           providerConfig.apiKey.trim() !== ""
  })
}

/**
 * Get the best available STT provider based on priority
 * @param config - Application configuration
 * @returns Primary STT provider ID or undefined if none available
 */
export function getPrimarySTTProvider(config?: any): STT_PROVIDER_ID | undefined {
  const availableProviders = getAvailableSTTProviders(config)

  if (availableProviders.length === 0) return undefined

  // Sort by priority if using new configuration
  if (config?.providers) {
    return availableProviders
      .sort((a, b) => {
        const priorityA = config.providers[a.value]?.priority || 999
        const priorityB = config.providers[b.value]?.priority || 999
        return priorityA - priorityB
      })[0]?.value
  }

  // Default to first available for legacy configuration
  return availableProviders[0]?.value
}

/**
 * Get the best available Chat provider based on priority
 * @param config - Application configuration
 * @returns Primary Chat provider ID or undefined if none available
 */
export function getPrimaryChatProvider(config?: any): CHAT_PROVIDER_ID | undefined {
  const availableProviders = getAvailableChatProviders(config)

  if (availableProviders.length === 0) return undefined

  // Sort by priority if using new configuration
  if (config?.providers) {
    return availableProviders
      .sort((a, b) => {
        const priorityA = config.providers[a.value]?.priority || 999
        const priorityB = config.providers[b.value]?.priority || 999
        return priorityA - priorityB
      })[0]?.value
  }

  // Default to first available for legacy configuration
  return availableProviders[0]?.value
}

/**
 * Check if a specific provider is available
 * @param config - Application configuration
 * @param providerId - Provider ID to check
 * @returns True if provider is enabled and available
 */
export function isProviderAvailableInUI(config: any, providerId: STT_PROVIDER_ID | CHAT_PROVIDER_ID): boolean {
  if (!config?.providers) {
    // Fallback to legacy configuration check
    switch (providerId) {
      case "openai":
        return !!config?.openaiApiKey && config.openaiApiKey.trim() !== ""
      case "groq":
        return !!config?.groqApiKey && config.groqApiKey.trim() !== ""
      case "gemini":
        return !!config?.geminiApiKey && config.geminiApiKey.trim() !== ""
      default:
        return false
    }
  }

  // Use new provider configuration
  const providerConfig = config.providers[providerId]
  return providerConfig?.status?.enabled &&
         providerConfig?.status?.available &&
         !!providerConfig?.apiKey &&
         providerConfig.apiKey.trim() !== ""
}

// Hold key options for recording activation - RESTRICTED TO ALT + KEY COMBINATIONS ONLY
// This prevents accidental activation during normal typing by requiring Alt modifier
export const HOLD_KEY_OPTIONS = [
  // Alt + Special keys
  {
    label: "Alt + Space",
    value: "AltLeft+Space",
    description: "Hold Alt + Space to record"
  },
  {
    label: "Alt + Tab",
    value: "AltLeft+Tab",
    description: "Hold Alt + Tab to record"
  },
  {
    label: "Alt + Enter",
    value: "AltLeft+Enter",
    description: "Hold Alt + Enter to record"
  },
  {
    label: "Alt + Backspace",
    value: "AltLeft+Backspace",
    description: "Hold Alt + Backspace to record"
  },

  // Alt + Function keys
  {
    label: "Alt + F1",
    value: "AltLeft+F1",
    description: "Hold Alt + F1 to record"
  },
  {
    label: "Alt + F2",
    value: "AltLeft+F2",
    description: "Hold Alt + F2 to record"
  },
  {
    label: "Alt + F3",
    value: "AltLeft+F3",
    description: "Hold Alt + F3 to record"
  },
  {
    label: "Alt + F4",
    value: "AltLeft+F4",
    description: "Hold Alt + F4 to record"
  },
  {
    label: "Alt + F5",
    value: "AltLeft+F5",
    description: "Hold Alt + F5 to record"
  },
  {
    label: "Alt + F6",
    value: "AltLeft+F6",
    description: "Hold Alt + F6 to record"
  },
  {
    label: "Alt + F7",
    value: "AltLeft+F7",
    description: "Hold Alt + F7 to record"
  },
  {
    label: "Alt + F8",
    value: "AltLeft+F8",
    description: "Hold Alt + F8 to record"
  },
  {
    label: "Alt + F9",
    value: "AltLeft+F9",
    description: "Hold Alt + F9 to record"
  },
  {
    label: "Alt + F10",
    value: "AltLeft+F10",
    description: "Hold Alt + F10 to record"
  },
  {
    label: "Alt + F11",
    value: "AltLeft+F11",
    description: "Hold Alt + F11 to record"
  },
  {
    label: "Alt + F12",
    value: "AltLeft+F12",
    description: "Hold Alt + F12 to record"
  },

  // Alt + Number keys
  {
    label: "Alt + 1",
    value: "AltLeft+Digit1",
    description: "Hold Alt + 1 to record"
  },
  {
    label: "Alt + 2",
    value: "AltLeft+Digit2",
    description: "Hold Alt + 2 to record"
  },
  {
    label: "Alt + 3",
    value: "AltLeft+Digit3",
    description: "Hold Alt + 3 to record"
  },
  {
    label: "Alt + 4",
    value: "AltLeft+Digit4",
    description: "Hold Alt + 4 to record"
  },
  {
    label: "Alt + 5",
    value: "AltLeft+Digit5",
    description: "Hold Alt + 5 to record"
  },
  {
    label: "Alt + 6",
    value: "AltLeft+Digit6",
    description: "Hold Alt + 6 to record"
  },
  {
    label: "Alt + 7",
    value: "AltLeft+Digit7",
    description: "Hold Alt + 7 to record"
  },
  {
    label: "Alt + 8",
    value: "AltLeft+Digit8",
    description: "Hold Alt + 8 to record"
  },
  {
    label: "Alt + 9",
    value: "AltLeft+Digit9",
    description: "Hold Alt + 9 to record"
  },
  {
    label: "Alt + 0",
    value: "AltLeft+Digit0",
    description: "Hold Alt + 0 to record"
  },

  // Alt + Letter keys (most commonly used for shortcuts)
  {
    label: "Alt + A",
    value: "AltLeft+KeyA",
    description: "Hold Alt + A to record"
  },
  {
    label: "Alt + B",
    value: "AltLeft+KeyB",
    description: "Hold Alt + B to record"
  },
  {
    label: "Alt + C",
    value: "AltLeft+KeyC",
    description: "Hold Alt + C to record"
  },
  {
    label: "Alt + D",
    value: "AltLeft+KeyD",
    description: "Hold Alt + D to record"
  },
  {
    label: "Alt + E",
    value: "AltLeft+KeyE",
    description: "Hold Alt + E to record"
  },
  {
    label: "Alt + F",
    value: "AltLeft+KeyF",
    description: "Hold Alt + F to record"
  },
  {
    label: "Alt + G",
    value: "AltLeft+KeyG",
    description: "Hold Alt + G to record"
  },
  {
    label: "Alt + H",
    value: "AltLeft+KeyH",
    description: "Hold Alt + H to record"
  },
  {
    label: "Alt + I",
    value: "AltLeft+KeyI",
    description: "Hold Alt + I to record"
  },
  {
    label: "Alt + J",
    value: "AltLeft+KeyJ",
    description: "Hold Alt + J to record"
  },
  {
    label: "Alt + K",
    value: "AltLeft+KeyK",
    description: "Hold Alt + K to record"
  },
  {
    label: "Alt + L",
    value: "AltLeft+KeyL",
    description: "Hold Alt + L to record"
  },
  {
    label: "Alt + M",
    value: "AltLeft+KeyM",
    description: "Hold Alt + M to record"
  },
  {
    label: "Alt + N",
    value: "AltLeft+KeyN",
    description: "Hold Alt + N to record"
  },
  {
    label: "Alt + O",
    value: "AltLeft+KeyO",
    description: "Hold Alt + O to record"
  },
  {
    label: "Alt + P",
    value: "AltLeft+KeyP",
    description: "Hold Alt + P to record"
  },
  {
    label: "Alt + Q",
    value: "AltLeft+KeyQ",
    description: "Hold Alt + Q to record"
  },
  {
    label: "Alt + R",
    value: "AltLeft+KeyR",
    description: "Hold Alt + R to record"
  },
  {
    label: "Alt + S",
    value: "AltLeft+KeyS",
    description: "Hold Alt + S to record"
  },
  {
    label: "Alt + T",
    value: "AltLeft+KeyT",
    description: "Hold Alt + T to record"
  },
  {
    label: "Alt + U",
    value: "AltLeft+KeyU",
    description: "Hold Alt + U to record"
  },
  {
    label: "Alt + V",
    value: "AltLeft+KeyV",
    description: "Hold Alt + V to record"
  },
  {
    label: "Alt + W",
    value: "AltLeft+KeyW",
    description: "Hold Alt + W to record"
  },
  {
    label: "Alt + X",
    value: "AltLeft+KeyX",
    description: "Hold Alt + X to record"
  },
  {
    label: "Alt + Y",
    value: "AltLeft+KeyY",
    description: "Hold Alt + Y to record"
  },
  {
    label: "Alt + Z",
    value: "AltLeft+KeyZ",
    description: "Hold Alt + Z to record"
  },

  // Alt + Arrow keys
  {
    label: "Alt + ↑",
    value: "AltLeft+ArrowUp",
    description: "Hold Alt + Up Arrow to record"
  },
  {
    label: "Alt + ↓",
    value: "AltLeft+ArrowDown",
    description: "Hold Alt + Down Arrow to record"
  },
  {
    label: "Alt + ←",
    value: "AltLeft+ArrowLeft",
    description: "Hold Alt + Left Arrow to record"
  },
  {
    label: "Alt + →",
    value: "AltLeft+ArrowRight",
    description: "Hold Alt + Right Arrow to record"
  },
] as const

export type HOLD_KEY_OPTION = (typeof HOLD_KEY_OPTIONS)[number]["value"]

/**
 * Parse an Alt + key combination string into its component parts
 * @param combo - Combination string like "AltLeft+Space"
 * @returns Object with modifier and key, or null if invalid
 */
export function parseAltKeyCombination(combo: string): { modifier: string; key: string } | null {
  if (!combo.includes('+')) {
    return null
  }

  const [modifier, key] = combo.split('+', 2)
  if (modifier !== 'AltLeft' && modifier !== 'AltRight') {
    return null
  }

  return { modifier, key }
}

/**
 * Check if a hold key option is an Alt + key combination
 * @param holdKey - The hold key option to check
 * @returns True if it's an Alt combination
 */
export function isAltCombination(holdKey: string): boolean {
  return holdKey.startsWith('AltLeft+') || holdKey.startsWith('AltRight+')
}

/**
 * Get the display name for a hold key option
 * @param holdKey - The hold key option
 * @returns Human readable display name
 */
export function getHoldKeyDisplayName(holdKey: string): string {
  const option = HOLD_KEY_OPTIONS.find(opt => opt.value === holdKey)
  if (option) {
    return option.label
  }

  // Fallback for legacy keys or custom combinations
  if (isAltCombination(holdKey)) {
    const parsed = parseAltKeyCombination(holdKey)
    if (parsed) {
      return `Alt + ${parsed.key}`
    }
  }

  return holdKey
}

// Multi-key combination support (up to 5 keys)
export type KeyCombination = {
  keys: HOLD_KEY_OPTION[]          // Array of up to 5 keys
  requireExactMatch?: boolean      // Whether all keys must be pressed together
  description?: string             // Human-readable description
}

// Extended shortcut types for enhanced flexibility
export type EnhancedShortcut =
  | { type: "hold-key"; keyCombination: KeyCombination }
  | { type: "key-combination"; keyCombination: KeyCombination }
  | { type: "ctrl-slash" }
  | { type: "voice-activation" }
  | { type: "custom"; combination: string; description: string }
  | { type: "disabled" }

// Legacy shortcut options for backward compatibility
export const SHORTCUT_OPTIONS = [
  {
    label: "Hold Key",
    value: "hold-key",
    description: "Hold Alt + key combination to record, release to stop (prevents accidental activation)"
  },
  {
    label: "Key Combination",
    value: "key-combination",
    description: "Press a combination of keys to start/stop recording"
  },
  {
    label: "Ctrl+/",
    value: "ctrl-slash",
    description: "Press Ctrl+/ to start/stop recording"
  },
  {
    label: "Voice Activation",
    value: "voice-activation",
    description: "Automatically start recording when voice is detected"
  },
  {
    label: "Streaming Dictation",
    value: "streaming-dictation",
    description: "Real-time speech-to-text that types as you speak (no recording workflow)"
  },
  {
    label: "Custom Shortcut",
    value: "custom",
    description: "Define a custom keyboard shortcut"
  },
  {
    label: "Disabled",
    value: "disabled",
    description: "Disable recording shortcuts for this application"
  },
] as const

export type SHORTCUT_OPTION = (typeof SHORTCUT_OPTIONS)[number]["value"]

// Pre-defined popular key combinations - ALL REQUIRE ALT MODIFIER FOR CONSISTENCY
export const POPULAR_KEY_COMBINATIONS = [
  {
    label: "Alt + Space",
    keys: ["AltLeft+Space"] as HOLD_KEY_OPTION[],
    description: "Press Alt+Space to record"
  },
  {
    label: "Alt + R",
    keys: ["AltLeft+KeyR"] as HOLD_KEY_OPTION[],
    description: "Press Alt+R to record"
  },
  {
    label: "Alt + V",
    keys: ["AltLeft+KeyV"] as HOLD_KEY_OPTION[],
    description: "Press Alt+V to record"
  },
  {
    label: "Alt + F1",
    keys: ["AltLeft+F1"] as HOLD_KEY_OPTION[],
    description: "Press Alt+F1 to record"
  },
  {
    label: "Alt + F2",
    keys: ["AltLeft+F2"] as HOLD_KEY_OPTION[],
    description: "Press Alt+F2 to record"
  },
] as const

// Voice activation shortcut configuration
export const VOICE_ACTIVATION_SHORTCUTS = [
  {
    label: "Default Voice Activation",
    value: "default-voice",
    description: "Standard voice activation mode"
  },
  {
    label: "Push-to-Talk Voice",
    value: "push-to-talk-voice",
    description: "Hold key + voice activation for precision"
  },
  {
    label: "Hands-Free Voice",
    value: "hands-free-voice",
    description: "Always-on voice activation (assignable hotkey to enable/disable)"
  },
] as const

export type VOICE_ACTIVATION_SHORTCUT = (typeof VOICE_ACTIVATION_SHORTCUTS)[number]["value"]

// Status Bar Dimensions - Compact baseline dimensions for renderer & main sync
export const STATUS_BAR_DIMENSIONS = {
  width: 160,   // Fixed compact width from COMPACT_STATUS_BAR_SPEC
  height: 16,   // Fixed compact height from COMPACT_STATUS_BAR_SPEC
} as const

// Application Context Options for Formatting
export const APPLICATION_CONTEXTS = [
  {
    value: "code-editor" as const,
    label: "Code Editor",
    description: "VS Code, IntelliJ, Sublime Text, etc.",
    icon: "i-mingcute-code-line"
  },
  {
    value: "terminal" as const,
    label: "Terminal",
    description: "Command line interfaces and shells",
    icon: "i-mingcute-terminal-line"
  },
  {
    value: "email" as const,
    label: "Email",
    description: "Email clients and webmail",
    icon: "i-mingcute-mail-line"
  },
  {
    value: "chat" as const,
    label: "Chat",
    description: "Slack, Discord, Teams, etc.",
    icon: "i-mingcute-chat-1-line"
  },
  {
    value: "document" as const,
    label: "Document",
    description: "Word processors, Google Docs, etc.",
    icon: "i-mingcute-file-text-line"
  },
  {
    value: "browser" as const,
    label: "Browser",
    description: "Web browsers and web applications",
    icon: "i-mingcute-world-line"
  },
  {
    value: "notes" as const,
    label: "Notes",
    description: "Note-taking applications",
    icon: "i-mingcute-edit-line"
  },
  {
    value: "presentation" as const,
    label: "Presentation",
    description: "PowerPoint, Keynote, etc.",
    icon: "i-mingcute-presentation-line"
  },
  {
    value: "design" as const,
    label: "Design",
    description: "Figma, Adobe Creative Suite, etc.",
    icon: "i-mingcute-palette-line"
  },
  {
    value: "generic" as const,
    label: "Generic",
    description: "Default formatting for unknown applications",
    icon: "i-mingcute-computer-line"
  }
] as const

export type APPLICATION_CONTEXT = (typeof APPLICATION_CONTEXTS)[number]["value"]

// Default formatting prompts for different contexts
export const DEFAULT_CONTEXT_PROMPTS = {
  "code-editor": `Format this text for a code editor context. Follow these guidelines:
- Convert spoken code into proper syntax
- Add appropriate indentation and formatting
- Preserve technical terminology exactly
- Format as code comments when describing functionality
- Use camelCase/snake_case as appropriate for the context
- Add proper punctuation for code readability

Input: {transcript}`,

  "terminal": `Format this text for terminal/command line usage. Follow these guidelines:
- Convert to proper command syntax
- Remove filler words (um, uh, etc.)
- Format as valid shell commands when appropriate
- Preserve flags and options exactly
- Use proper spacing and argument formatting
- Convert "and" to "&& " for command chaining when appropriate

Input: {transcript}`,

  "email": `Format this text for professional email communication. Follow these guidelines:
- Use professional, clear language
- Add proper punctuation and capitalization
- Structure with proper paragraphs
- Remove filler words and hesitations
- Maintain a polite, business-appropriate tone
- Add proper greetings/closings if needed

Input: {transcript}`,

  "chat": `Format this text for casual chat/messaging. Follow these guidelines:
- Keep it conversational but clear
- Remove excessive filler words
- Add appropriate punctuation
- Maintain the casual tone
- Break into multiple messages if too long
- Use common abbreviations appropriately

Input: {transcript}`,

  "document": `Format this text for document writing. Follow these guidelines:
- Use proper grammar and punctuation
- Structure in clear paragraphs
- Remove filler words and hesitations
- Maintain formal writing style
- Add appropriate formatting cues
- Ensure proper sentence structure

Input: {transcript}`,

  "browser": `Format this text for web browser usage. Follow these guidelines:
- Clean up for search queries or form input
- Remove filler words
- Add proper punctuation
- Format appropriately for the web context
- Keep it concise and searchable

Input: {transcript}`,

  "notes": `Format this text for note-taking. Follow these guidelines:
- Use bullet points for lists
- Add proper headings when appropriate
- Remove filler words
- Keep it concise but complete
- Use markdown formatting when helpful
- Structure for easy scanning

Input: {transcript}`,

  "presentation": `Format this text for presentation content. Follow these guidelines:
- Use bullet points and clear structure
- Keep phrases concise and impactful
- Remove filler words completely
- Add emphasis where appropriate
- Structure as presentation slides when applicable
- Use action-oriented language

Input: {transcript}`,

  "design": `Format this text for design application usage. Follow these guidelines:
- Keep technical design terms precise
- Format for design specifications
- Remove unnecessary words
- Maintain creative terminology
- Structure for design documentation
- Add appropriate design context

Input: {transcript}`,

  "generic": `Clean up and format this text for general use. Follow these guidelines:
- Fix grammar and punctuation
- Remove filler words (um, uh, like, etc.)
- Maintain the original meaning and tone
- Add proper capitalization
- Structure with appropriate paragraphs
- Keep it natural and readable

Input: {transcript}`
} as const

// Application detection patterns for context-aware formatting
export const APP_CONTEXT_PATTERNS = {
  "code-editor": [
    { name: /code|vscode|visual studio/i, executable: /code\.exe|devenv\.exe/i },
    { name: /intellij|idea|webstorm|pycharm|phpstorm/i, executable: /idea\d*\.exe|webstorm\d*\.exe/i },
    { name: /sublime|atom|notepad\+\+|vim|emacs/i, executable: /sublime_text\.exe|atom\.exe|notepad\+\+\.exe/i },
    { name: /xcode/i, executable: /xcode/i }
  ],
  "terminal": [
    { name: /terminal|command prompt|powershell|cmd|bash|zsh/i, executable: /cmd\.exe|powershell\.exe|terminal|bash|zsh/i },
    { name: /iterm|hyper|windows terminal/i, executable: /iterm|windowsterminal\.exe/i }
  ],
  "email": [
    { name: /outlook|mail|thunderbird|apple mail/i, executable: /outlook\.exe|thunderbird\.exe|mail/i },
    { name: /gmail|yahoo mail|protonmail/i, executable: /chrome\.exe|firefox\.exe|safari/i }
  ],
  "chat": [
    { name: /slack|discord|teams|telegram|whatsapp/i, executable: /slack\.exe|discord\.exe|teams\.exe/i },
    { name: /zoom|skype|messenger/i, executable: /zoom\.exe|skype\.exe/i }
  ],
  "document": [
    { name: /word|google docs|pages|libreoffice|openoffice/i, executable: /winword\.exe|libreoffice\.exe/i },
    { name: /notion|obsidian|roam/i, executable: /notion\.exe|obsidian\.exe/i }
  ],
  "browser": [
    { name: /chrome|firefox|safari|edge|opera|brave/i, executable: /chrome\.exe|firefox\.exe|msedge\.exe|opera\.exe/i }
  ],
  "notes": [
    { name: /onenote|evernote|bear|simplenote|joplin/i, executable: /onenote\.exe|evernote\.exe/i },
    { name: /typora|mark text|notable/i, executable: /typora\.exe/i }
  ],
  "presentation": [
    { name: /powerpoint|keynote|google slides|impress/i, executable: /powerpnt\.exe|keynote/i }
  ],
  "design": [
    { name: /figma|sketch|adobe|photoshop|illustrator|indesign/i, executable: /figma\.exe|sketch\.exe|photoshop\.exe/i },
    { name: /blender|maya|3ds max/i, executable: /blender\.exe|maya\.exe/i }
  ]
} as const

// Fusion Transcription Strategy Options
export const FUSION_STRATEGIES = [
  {
    value: "best-confidence" as const,
    label: "Best Confidence",
    description: "Use the result with the highest confidence score"
  },
  {
    value: "majority-vote" as const,
    label: "Majority Vote",
    description: "Combine results using word-level majority voting"
  },
  {
    value: "weighted-average" as const,
    label: "Weighted Average",
    description: "Weight results by provider reliability and confidence"
  },
  {
    value: "consensus" as const,
    label: "Consensus",
    description: "Require agreement between multiple providers"
  },
  {
    value: "primary-fallback" as const,
    label: "Primary + Fallback",
    description: "Use primary provider, fallback to others on failure"
  }
] as const

export type FUSION_STRATEGY = (typeof FUSION_STRATEGIES)[number]["value"]

// Default Fusion Configuration
export const DEFAULT_FUSION_CONFIG = {
  enabled: false,
  strategy: "best-confidence" as const,
  providers: ["openai", "groq"] as const,
  primaryProvider: "openai" as const,
  timeoutMs: 30000,
  minProvidersRequired: 1,
  confidenceThreshold: 0.7,
  enableParallel: true,
  providerWeights: {
    openai: 1.0,
    groq: 0.9,
    gemini: 0.8
  }
} as const

// Default Context-Aware Formatting Configuration
export const DEFAULT_CONTEXT_FORMATTING = {
  enabled: false,
  autoDetectContext: true,
  fallbackContext: "generic" as const,
  enableSmartFormatting: true,
  preserveOriginalOnError: true
} as const

// Utility functions for key combination handling

/**
 * Format a key combination into a human-readable string
 * @param combination - The key combination to format
 * @returns Human-readable string like "Ctrl+Shift+R"
 */
export function formatKeyCombination(combination: KeyCombination): string {
  const keyLabels = combination.keys.map(key => {
    const option = HOLD_KEY_OPTIONS.find(opt => opt.value === key)
    return option?.label || key
  })

  return keyLabels.join(' + ')
}

/**
 * Create a key combination from an array of keys
 * @param keys - Array of key codes
 * @param description - Optional description
 * @returns KeyCombination object
 */
export function createKeyCombination(
  keys: HOLD_KEY_OPTION[],
  description?: string
): KeyCombination {
  return {
    keys: keys.slice(0, 5), // Limit to 5 keys maximum
    requireExactMatch: true,
    description: description || formatKeyCombination({ keys, requireExactMatch: true })
  }
}

/**
 * Validate that a key combination is valid (1-5 keys, no duplicates)
 * @param combination - The key combination to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateKeyCombination(combination: KeyCombination): {
  isValid: boolean;
  error?: string
} {
  if (!combination.keys || combination.keys.length === 0) {
    return { isValid: false, error: "At least one key is required" }
  }

  if (combination.keys.length > 5) {
    return { isValid: false, error: "Maximum 5 keys allowed in a combination" }
  }

  // Check for duplicate keys
  const uniqueKeys = new Set(combination.keys)
  if (uniqueKeys.size !== combination.keys.length) {
    return { isValid: false, error: "Duplicate keys are not allowed" }
  }

  // Validate that all keys exist in HOLD_KEY_OPTIONS
  const validKeys = HOLD_KEY_OPTIONS.map(opt => opt.value)
  const invalidKeys = combination.keys.filter(key => !validKeys.includes(key))
  if (invalidKeys.length > 0) {
    return { isValid: false, error: `Invalid keys: ${invalidKeys.join(', ')}` }
  }

  return { isValid: true }
}

/**
 * Check if two key combinations are equivalent
 * @param combo1 - First key combination
 * @param combo2 - Second key combination
 * @returns True if combinations are equivalent
 */
export function areKeyCombinationsEqual(combo1: KeyCombination, combo2: KeyCombination): boolean {
  if (combo1.keys.length !== combo2.keys.length) {
    return false
  }

  // Sort keys for comparison to handle different order
  const sorted1 = [...combo1.keys].sort()
  const sorted2 = [...combo2.keys].sort()

  return sorted1.every((key, index) => key === sorted2[index])
}

/**
 * Convert legacy shortcut configuration to enhanced shortcut array
 * @param config - Legacy config object
 * @returns Array of enhanced shortcuts
 */
export function migrateToEnhancedShortcuts(config: {
  shortcut?: string;
  holdKey?: HOLD_KEY_OPTION;
  keyCombination?: KeyCombination;
}): EnhancedShortcut[] {
  const shortcuts: EnhancedShortcut[] = []

  if (config.shortcut === "hold-key" && config.holdKey) {
    shortcuts.push({
      type: "hold-key",
      keyCombination: createKeyCombination([config.holdKey])
    })
  } else if (config.shortcut === "key-combination" && config.keyCombination) {
    shortcuts.push({
      type: "key-combination",
      keyCombination: config.keyCombination
    })
  } else if (config.shortcut === "ctrl-slash") {
    shortcuts.push({ type: "ctrl-slash" })
  } else if (config.shortcut === "voice-activation") {
    shortcuts.push({ type: "voice-activation" })
  } else if (config.shortcut === "disabled") {
    shortcuts.push({ type: "disabled" })
  }

  return shortcuts
}

/**
 * Get the display name for an enhanced shortcut
 * @param shortcut - The enhanced shortcut
 * @returns Human-readable string for the shortcut
 */
export function getShortcutDisplayName(shortcut: EnhancedShortcut): string {
  switch (shortcut.type) {
    case "hold-key":
      return `Hold ${formatKeyCombination(shortcut.keyCombination)}`
    case "key-combination":
      return `Press ${formatKeyCombination(shortcut.keyCombination)}`
    case "ctrl-slash":
      return "Ctrl+/"
    case "voice-activation":
      return "Voice Activation"
    case "custom":
      return shortcut.description || shortcut.combination
    case "disabled":
      return "Disabled"
    default:
      return "Unknown"
  }
}

// **STREAMING DICTATION CONSTANTS**

/**
 * Supported languages for streaming dictation
 */
export const STREAMING_DICTATION_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'en-CA', label: 'English (Canada)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'es-MX', label: 'Spanish (Mexico)' },
  { code: 'fr-FR', label: 'French (France)' },
  { code: 'fr-CA', label: 'French (Canada)' },
  { code: 'de-DE', label: 'German' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'pt-PT', label: 'Portuguese (Portugal)' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'hi-IN', label: 'Hindi' },
] as const

/**
 * Voice commands for streaming dictation
 */
export const STREAMING_DICTATION_COMMANDS = [
  { command: 'new line', action: 'newline', description: 'Insert a new line' },
  { command: 'new paragraph', action: 'paragraph', description: 'Insert two new lines' },
  { command: 'delete', action: 'delete', description: 'Delete the last word' },
  { command: 'delete line', action: 'deleteline', description: 'Delete the current line' },
  { command: 'undo', action: 'undo', description: 'Undo last action' },
  { command: 'stop dictation', action: 'stop', description: 'Stop streaming dictation' },
  { command: 'pause dictation', action: 'pause', description: 'Pause streaming dictation' },
  { command: 'resume dictation', action: 'resume', description: 'Resume streaming dictation' },
] as const

/**
 * Default streaming dictation configuration
 */
export const DEFAULT_STREAMING_DICTATION_CONFIG = {
  enabled: false,
  language: 'en-US',
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
  sensitivity: 50,
  punctuationMode: 'auto' as const,
  capitalizationMode: 'auto' as const,
  pauseOnSilence: 3000,
  insertMode: 'insert' as const,
  enableVoiceCommands: true,
  contextFormatting: true,
}
