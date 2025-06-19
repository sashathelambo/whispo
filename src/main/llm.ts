import { GoogleGenerativeAI } from "@google/generative-ai"
import type { CHAT_PROVIDER_ID } from "@shared/types"
import { getActiveApplication } from "./app-detector"
import {
    configStore,
    getProviderAvailability, isProviderAvailable
} from "./config"
import {
    applyContextSpecificFormatting,
    buildContextFormattingPrompt,
    getEffectiveFormattingConfig
} from "./context-formatter"
import { state } from "./state"

export async function postProcessTranscript(transcript: string) {
  const config = configStore.get()

  // First, check if context-aware formatting is enabled
  const appInfo = await getActiveApplication()
  const activeRule = state.activeRule

  if (appInfo) {
    const formattingConfig = getEffectiveFormattingConfig(appInfo, activeRule)

    if (formattingConfig) {
      console.log(`Applying context-aware formatting for: ${formattingConfig.context}`)

      try {
        // Apply basic context-specific formatting first
        let processedTranscript = applyContextSpecificFormatting(transcript, formattingConfig.context)

        // Use AI-powered formatting if enabled
        if (config.contextFormatting?.enableSmartFormatting) {
          const contextPrompt = buildContextFormattingPrompt(processedTranscript, formattingConfig)

          // Get the provider for context formatting with fallback logic
          const requestedProviderId = activeRule?.transcriptPostProcessingProviderId ||
                                    config.transcriptPostProcessingProviderId

          const availableProviderId = getAvailableProvider(config, requestedProviderId as CHAT_PROVIDER_ID)

          if (availableProviderId) {
            console.log(`Using provider "${availableProviderId}" for context formatting`)
            processedTranscript = await processWithProvider(contextPrompt, availableProviderId, config)
          } else {
            console.warn("No available providers for context formatting")
          }
        }

        return processedTranscript
      } catch (error) {
        console.error("Context-aware formatting failed:", error)

        // If preserveOriginalOnError is enabled, return the original transcript
        if (config.contextFormatting?.preserveOriginalOnError) {
          console.log("Returning original transcript due to formatting error")
          return transcript
        }

        // Otherwise, fall through to standard post-processing
      }
    }
  }

  // Standard post-processing (existing logic)
  if (
    !config.transcriptPostProcessingEnabled ||
    !config.transcriptPostProcessingPrompt
  ) {
    return transcript
  }

  const prompt = config.transcriptPostProcessingPrompt.replace(
    "{transcript}",
    transcript,
  )

  const requestedProviderId = config.transcriptPostProcessingProviderId
  const availableProviderId = getAvailableProvider(config, requestedProviderId as CHAT_PROVIDER_ID)

  if (!availableProviderId) {
    throw new Error("No available providers for transcript post-processing. Please enable at least one provider and configure its API key.")
  }

  console.log(`Using provider "${availableProviderId}" for transcript post-processing`)
  return await processWithProvider(prompt, availableProviderId, config)
}

/**
 * Get an available provider with intelligent fallback logic
 * @param config - Application configuration
 * @param requestedProviderId - The originally requested provider
 * @returns Available provider ID or null if none available
 */
function getAvailableProvider(config: any, requestedProviderId?: CHAT_PROVIDER_ID): CHAT_PROVIDER_ID | null {
  // If a specific provider is requested, check if it's available
  if (requestedProviderId && isProviderAvailable(config, requestedProviderId)) {
    return requestedProviderId
  }

  // If requested provider not available, get fallback options
  const availability = getProviderAvailability(config)

  if (availability.primaryChatProvider) {
    console.log(`Falling back to primary provider: ${availability.primaryChatProvider}`)
    return availability.primaryChatProvider
  }

  // No providers available
  return null
}

/**
 * Process text with a specific provider using enhanced configuration
 */
async function processWithProvider(prompt: string, providerId: string, config: any): Promise<string> {
  // Get provider configuration (new format with fallback to legacy)
  const getProviderConfig = (id: string) => {
    if (config.providers?.[id]) {
      return config.providers[id]
    }

    // Fallback to legacy configuration
    switch (id) {
      case "openai":
        return {
          apiKey: config.openaiApiKey,
          baseUrl: config.openaiBaseUrl || "https://api.openai.com/v1"
        }
      case "groq":
        return {
          apiKey: config.groqApiKey,
          baseUrl: config.groqBaseUrl || "https://api.groq.com/openai/v1"
        }
      case "gemini":
        return {
          apiKey: config.geminiApiKey,
          baseUrl: config.geminiBaseUrl || "https://generativelanguage.googleapis.com"
        }
      default:
        throw new Error(`Unknown provider: ${id}`)
    }
  }

  const providerConfig = getProviderConfig(providerId)

  if (!providerConfig.apiKey) {
    throw new Error(`API key is required for provider: ${providerId}`)
  }

  // Handle Gemini separately due to different SDK
  if (providerId === "gemini") {
    const gai = new GoogleGenerativeAI(providerConfig.apiKey)
    const gModel = gai.getGenerativeModel({ model: "gemini-1.5-flash-002" })

    const result = await gModel.generateContent([prompt], {
      baseUrl: providerConfig.baseUrl,
    })
    return result.response.text().trim()
  }

  // Handle OpenAI-compatible providers (OpenAI, Groq)
  const chatResponse = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${providerConfig.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      temperature: 0,
      model: providerId === "groq" ? "llama-3.1-70b-versatile" : "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    }),
  })

  if (!chatResponse.ok) {
    const errorText = await chatResponse.text()
    const message = `${providerId} API error: ${chatResponse.statusText} - ${errorText.slice(0, 300)}`

    // Log the error for debugging
    console.error(`Provider ${providerId} failed:`, message)

    throw new Error(message)
  }

  const chatJson = await chatResponse.json()
  console.log(`Provider ${providerId} response:`, chatJson)
  return chatJson.choices[0].message.content.trim()
}
