import { Button } from "@renderer/components/ui/button"
import { Control, ControlGroup } from "@renderer/components/ui/control"
import { Input } from "@renderer/components/ui/input"
import { Switch } from "@renderer/components/ui/switch"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@renderer/components/ui/tooltip"
import {
    useConfigQuery,
    useSaveConfigMutation,
} from "@renderer/lib/query-client"
import { Config, ProviderConfig, ProvidersConfig } from "@shared/types"

// Default API base URLs - pre-configured for easy use
const DEFAULT_API_URLS = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  gemini: "https://generativelanguage.googleapis.com"
} as const

// Provider information and capabilities
const PROVIDER_INFO = {
  openai: {
    name: "OpenAI",
    description: "Industry-leading speech-to-text and chat models including GPT-4o and Whisper",
    icon: "i-mingcute-openai-line",
    capabilities: ["STT", "Chat"],
    keyPlaceholder: "sk-...",
    keyPrefix: "sk-",
    priority: 1
  },
  groq: {
    name: "Groq",
    description: "Lightning-fast inference with Llama models, ideal for real-time transcription processing",
    icon: "i-mingcute-lightning-line",
    capabilities: ["STT", "Chat"],
    keyPlaceholder: "gsk_...",
    keyPrefix: "gsk_",
    priority: 2
  },
  gemini: {
    name: "Gemini",
    description: "Google's powerful multimodal AI with excellent reasoning capabilities for text processing",
    icon: "i-mingcute-google-line",
    capabilities: ["Chat"],
    keyPlaceholder: "AIza...",
    keyPrefix: "AIza",
    priority: 3
  }
} as const

export function Component() {
  const configQuery = useConfigQuery()
  const saveConfigMutation = useSaveConfigMutation()

  const saveConfig = (config: Partial<Config>) => {
    saveConfigMutation.mutate({
      config: {
        ...configQuery.data,
        ...config,
      },
    })
  }

  if (!configQuery.data) return null

  const config = configQuery.data

  // Get provider configuration (new format with fallback to legacy)
  const getProviderConfig = (providerId: keyof typeof PROVIDER_INFO): ProviderConfig => {
    if (config.providers?.[providerId]) {
      return config.providers[providerId]
    }

    // Fallback to legacy configuration
    const legacyKeys = {
      openai: { apiKey: config.openaiApiKey, baseUrl: config.openaiBaseUrl },
      groq: { apiKey: config.groqApiKey, baseUrl: config.groqBaseUrl },
      gemini: { apiKey: config.geminiApiKey, baseUrl: config.geminiBaseUrl }
    }

    const legacy = legacyKeys[providerId]
    const hasApiKey = !!legacy.apiKey && legacy.apiKey.trim() !== ""

    return {
      status: {
        enabled: true, // Legacy configurations are considered enabled by default
        available: hasApiKey,
        hasValidKey: hasApiKey,
        usageCount: 0
      },
      apiKey: legacy.apiKey || "",
      baseUrl: legacy.baseUrl || DEFAULT_API_URLS[providerId],
      priority: PROVIDER_INFO[providerId].priority
    }
  }

  // Update provider configuration
  const updateProviderConfig = (providerId: keyof typeof PROVIDER_INFO, updates: Partial<ProviderConfig>) => {
    const currentProviders = config.providers || {} as ProvidersConfig
    const currentProvider = getProviderConfig(providerId)

    const updatedProvider = {
      ...currentProvider,
      ...updates,
      status: {
        ...currentProvider.status,
        ...updates.status
      }
    }

    // Update availability when API key changes
    if (updates.apiKey !== undefined) {
      updatedProvider.status.available = !!updates.apiKey && updates.apiKey.trim() !== ""
      updatedProvider.status.hasValidKey = false // Reset validation on key change
      updatedProvider.status.lastValidated = undefined
    }

    const defaultProviders: ProvidersConfig = {
      openai: getProviderConfig('openai'),
      groq: getProviderConfig('groq'),
      gemini: getProviderConfig('gemini')
    }

    const updatedProviders: ProvidersConfig = {
      ...defaultProviders,
      ...currentProviders,
      [providerId]: updatedProvider
    }

    // Also update legacy fields for backward compatibility
    const legacyUpdates: Partial<Config> = {
      providers: updatedProviders
    }

    if (updates.apiKey !== undefined) {
      switch (providerId) {
        case "openai":
          legacyUpdates.openaiApiKey = updates.apiKey
          break
        case "groq":
          legacyUpdates.groqApiKey = updates.apiKey
          break
        case "gemini":
          legacyUpdates.geminiApiKey = updates.apiKey
          break
      }
    }

    if (updates.baseUrl !== undefined) {
      switch (providerId) {
        case "openai":
          legacyUpdates.openaiBaseUrl = updates.baseUrl
          break
        case "groq":
          legacyUpdates.groqBaseUrl = updates.baseUrl
          break
        case "gemini":
          legacyUpdates.geminiBaseUrl = updates.baseUrl
          break
      }
    }

    saveConfig(legacyUpdates)
  }

  // Helper to get provider status indicators
  const getProviderStatus = (providerId: keyof typeof PROVIDER_INFO) => {
    const provider = getProviderConfig(providerId)

    if (!provider.status.enabled) {
      return { status: "disabled", color: "text-gray-400", icon: "i-mingcute-close-circle-line", label: "Disabled" }
    } else if (!provider.status.available) {
      return { status: "unconfigured", color: "text-yellow-500", icon: "i-mingcute-alert-circle-line", label: "No API Key" }
    } else if (provider.status.hasValidKey === false && provider.status.lastError) {
      return { status: "error", color: "text-red-500", icon: "i-mingcute-close-circle-line", label: "Invalid Key" }
    } else {
      return { status: "enabled", color: "text-green-500", icon: "i-mingcute-check-circle-line", label: "Ready" }
    }
  }

  // Helper component for API URL inputs with default indicators
  const ApiUrlInput = ({
    provider,
    value,
    onChange,
    disabled = false
  }: {
    provider: keyof typeof DEFAULT_API_URLS
    value?: string
    onChange: (value: string) => void
    disabled?: boolean
  }) => {
    const defaultUrl = DEFAULT_API_URLS[provider]
    const currentValue = value || defaultUrl
    const isUsingDefault = !value || value === defaultUrl

    return (
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="url"
            placeholder={defaultUrl}
            value={currentValue}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            wrapperClassName={isUsingDefault ? "border-green-200 dark:border-green-800" : ""}
          />
          {isUsingDefault && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500">
                    <span className="i-mingcute-check-circle-fill text-sm"></span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Using pre-configured default URL
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {!isUsingDefault && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onChange("")}
                  disabled={disabled}
                >
                  <span className="i-mingcute-refresh-1-line text-sm"></span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Reset to default URL
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    )
  }

  // Provider card component
  const ProviderCard = ({ providerId }: { providerId: keyof typeof PROVIDER_INFO }) => {
    const providerInfo = PROVIDER_INFO[providerId]
    const providerConfig = getProviderConfig(providerId)
    const providerStatus = getProviderStatus(providerId)
    const isEnabled = providerConfig.status.enabled

    return (
      <ControlGroup
        title={
          <div className="flex items-center gap-3">
            <span className={`${providerInfo.icon} text-lg`}></span>
            <span>{providerInfo.name}</span>
            <div className="flex items-center gap-2">
              {/* Provider capabilities badges */}
              {providerInfo.capabilities.map((capability) => (
                <span
                  key={capability}
                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full"
                >
                  {capability}
                </span>
              ))}
              {/* Status indicator */}
              <div className="flex items-center gap-1">
                <span className={`${providerStatus.icon} ${providerStatus.color} text-sm`}></span>
                <span className={`text-xs ${providerStatus.color}`}>{providerStatus.label}</span>
              </div>
            </div>
          </div>
        }
        endDescription={providerInfo.description}
      >
        {/* Enable/Disable Toggle */}
        <Control label="Enable Provider" className="px-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={isEnabled}
              onCheckedChange={(enabled) => {
                updateProviderConfig(providerId, {
                  status: { ...providerConfig.status, enabled }
                })
              }}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isEnabled ? "Provider is enabled" : "Provider is disabled"}
            </span>
          </div>
        </Control>

        {/* API Key Input - Only show if enabled */}
        {isEnabled && (
          <>
            <Control label="API Key" className="px-3">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder={providerInfo.keyPlaceholder}
                  value={providerConfig.apiKey || ""}
                  onChange={(e) => {
                    updateProviderConfig(providerId, {
                      apiKey: e.currentTarget.value
                    })
                  }}
                />
                {providerConfig.status.lastError && (
                  <div className="text-xs text-red-500 flex items-center gap-1">
                    <span className="i-mingcute-alert-circle-line"></span>
                    {providerConfig.status.lastError}
                  </div>
                )}
              </div>
            </Control>

            <Control label="API Base URL" className="px-3">
              <ApiUrlInput
                provider={providerId}
                value={providerConfig.baseUrl}
                onChange={(value) => {
                  updateProviderConfig(providerId, {
                    baseUrl: value || DEFAULT_API_URLS[providerId]
                  })
                }}
              />
            </Control>

            {/* Usage Statistics - if available */}
            {providerConfig.status.usageCount !== undefined && providerConfig.status.usageCount > 0 && (
              <Control label="Usage Statistics" className="px-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="i-mingcute-chart-line"></span>
                    <span>{providerConfig.status.usageCount} requests processed</span>
                  </div>
                  {providerConfig.status.lastValidated && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="i-mingcute-time-line"></span>
                      <span>Last validated: {new Date(providerConfig.status.lastValidated).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </Control>
            )}
          </>
        )}
      </ControlGroup>
    )
  }

  // Calculate provider summary
  const enabledProviders = Object.keys(PROVIDER_INFO).filter(
    providerId => getProviderConfig(providerId as keyof typeof PROVIDER_INFO).status.enabled
  ).length

  const configuredProviders = Object.keys(PROVIDER_INFO).filter(
    providerId => getProviderConfig(providerId as keyof typeof PROVIDER_INFO).status.available
  ).length

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-6">
        {/* Provider Summary */}
        <ControlGroup title="Provider Overview">
          <div className="px-3 py-2">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{enabledProviders}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Enabled</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{configuredProviders}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Configured</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{Object.keys(PROVIDER_INFO).length}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
              </div>
            </div>
          </div>
        </ControlGroup>

        {/* Provider Configuration Cards */}
        <div className="grid gap-4">
          {(Object.keys(PROVIDER_INFO) as Array<keyof typeof PROVIDER_INFO>).map((providerId) => (
            <ProviderCard key={providerId} providerId={providerId} />
          ))}
        </div>

        {/* Quick Actions */}
        <ControlGroup title="Quick Actions">
          <div className="px-3 space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Enable all providers
                  Object.keys(PROVIDER_INFO).forEach((providerId) => {
                    updateProviderConfig(providerId as keyof typeof PROVIDER_INFO, {
                      status: {
                        ...getProviderConfig(providerId as keyof typeof PROVIDER_INFO).status,
                        enabled: true
                      }
                    })
                  })
                }}
              >
                <span className="i-mingcute-check-circle-line mr-2"></span>
                Enable All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Disable all providers
                  Object.keys(PROVIDER_INFO).forEach((providerId) => {
                    updateProviderConfig(providerId as keyof typeof PROVIDER_INFO, {
                      status: {
                        ...getProviderConfig(providerId as keyof typeof PROVIDER_INFO).status,
                        enabled: false
                      }
                    })
                  })
                }}
              >
                <span className="i-mingcute-close-circle-line mr-2"></span>
                Disable All
              </Button>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              💡 <strong>Tip:</strong> You can enable multiple providers for redundancy. The system will automatically fallback to other providers if your primary choice is unavailable.
            </div>
          </div>
        </ControlGroup>
      </div>
    </TooltipProvider>
  )
}
