/**
 * Fusion Transcription Module
 * Handles parallel processing of multiple STT providers and intelligent result combination
 * Supports multiple fusion strategies for optimal accuracy and reliability
 */

import type { STT_PROVIDER_ID } from "@shared/index"
import { FusionConfig, FusionResult, FusionStrategy, TranscriptionResult } from "@shared/types"
import { configStore } from "./config"

/**
 * Main fusion transcription function
 * Processes audio with multiple providers and combines results
 */
export async function fusionTranscribe(
  audioBlob: Blob,
  config: FusionConfig
): Promise<FusionResult> {
  const startTime = Date.now()
  const globalConfig = configStore.get()

  console.log(`Starting fusion transcription with strategy: ${config.strategy}`)
  console.log(`Providers: ${config.providers.join(", ")}`)

  // Process providers in parallel or sequential based on config
  const results = config.enableParallel
    ? await processProvidersParallel(audioBlob, config.providers, globalConfig, config.timeoutMs)
    : await processProvidersSequential(audioBlob, config.providers, globalConfig, config.timeoutMs)

  const successfulResults = results.filter(r => r.success)

  // Check if we have enough successful results
  if (successfulResults.length < config.minProvidersRequired) {
    throw new Error(
      `Fusion failed: Only ${successfulResults.length} providers succeeded, ` +
      `but ${config.minProvidersRequired} required`
    )
  }

  // Apply fusion strategy to combine results
  const finalTranscript = await applyFusionStrategy(
    successfulResults,
    config.strategy,
    config
  )

  // Calculate overall confidence
  const confidence = calculateOverallConfidence(successfulResults, config.strategy)

  // Check confidence threshold
  if (confidence < config.confidenceThreshold) {
    console.warn(`Low confidence result: ${confidence} < ${config.confidenceThreshold}`)
  }

  const processingTime = Date.now() - startTime

  return {
    finalTranscript,
    confidence,
    strategy: config.strategy,
    results,
    processingTime,
    providersUsed: successfulResults.map(r => r.provider)
  }
}

/**
 * Process multiple providers in parallel
 */
async function processProvidersParallel(
  audioBlob: Blob,
  providers: STT_PROVIDER_ID[],
  globalConfig: any,
  timeoutMs: number
): Promise<TranscriptionResult[]> {
  const promises = providers.map(provider =>
    processProvider(audioBlob, provider, globalConfig, timeoutMs)
  )

  return Promise.all(promises)
}

/**
 * Process multiple providers sequentially
 */
async function processProvidersSequential(
  audioBlob: Blob,
  providers: STT_PROVIDER_ID[],
  globalConfig: any,
  timeoutMs: number
): Promise<TranscriptionResult[]> {
  const results: TranscriptionResult[] = []

  for (const provider of providers) {
    const result = await processProvider(audioBlob, provider, globalConfig, timeoutMs)
    results.push(result)
  }

  return results
}

/**
 * Process a single provider with timeout and error handling
 */
async function processProvider(
  audioBlob: Blob,
  provider: STT_PROVIDER_ID,
  globalConfig: any,
  timeoutMs: number
): Promise<TranscriptionResult> {
  const startTime = Date.now()

  try {
    const transcript = await Promise.race([
      transcribeWithProvider(audioBlob, provider, globalConfig),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeoutMs)
      )
    ])

    const processingTime = Date.now() - startTime
    const confidence = estimateConfidence(transcript, provider, processingTime)

    return {
      provider,
      transcript,
      confidence,
      processingTime,
      success: true
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error(`Provider ${provider} failed:`, error)

    return {
      provider,
      transcript: "",
      confidence: 0,
      processingTime,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Transcribe with a specific provider
 * Reuses existing provider logic from main transcription flow
 */
async function transcribeWithProvider(
  audioBlob: Blob,
  provider: STT_PROVIDER_ID,
  globalConfig: any
): Promise<string> {
  const form = new FormData()
  form.append(
    "file",
    new File([audioBlob], "recording.webm", { type: "audio/webm" })
  )
  form.append(
    "model",
    provider === "groq" ? "whisper-large-v3" : "whisper-1"
  )
  form.append("response_format", "json")

  let baseUrl: string
  let apiKey: string

  switch (provider) {
    case "groq":
      baseUrl = globalConfig.groqBaseUrl || "https://api.groq.com/openai/v1"
      apiKey = globalConfig.groqApiKey
      break
    case "openai":
      baseUrl = globalConfig.openaiBaseUrl || "https://api.openai.com/v1"
      apiKey = globalConfig.openaiApiKey
      break
            // Note: Gemini not supported for STT in fusion mode
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }

  if (!apiKey) {
    throw new Error(`API key not configured for ${provider}`)
  }

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`${response.statusText}: ${errorText.slice(0, 300)}`)
  }

  const json: { text: string } = await response.json()
  return json.text
}

/**
 * Apply fusion strategy to combine results
 */
async function applyFusionStrategy(
  results: TranscriptionResult[],
  strategy: FusionStrategy,
  config: FusionConfig
): Promise<string> {
  switch (strategy) {
    case "best-confidence":
      return results.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      ).transcript

    case "primary-fallback":
      const primaryResult = results.find(r => r.provider === config.primaryProvider)
      if (primaryResult && primaryResult.confidence >= config.confidenceThreshold) {
        return primaryResult.transcript
      }
      // Fallback to best confidence from other providers
      const fallbackResults = results.filter(r => r.provider !== config.primaryProvider)
      if (fallbackResults.length === 0) {
        return primaryResult?.transcript || ""
      }
      return fallbackResults.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      ).transcript

    case "majority-vote":
      return combineMajorityVote(results)

    case "weighted-average":
      return combineWeightedAverage(results, config.providerWeights)

    case "consensus":
      return combineConsensus(results, config.confidenceThreshold)

    default:
      throw new Error(`Unknown fusion strategy: ${strategy}`)
  }
}

/**
 * Combine results using majority vote at word level
 */
function combineMajorityVote(results: TranscriptionResult[]): string {
  if (results.length === 0) return ""
  if (results.length === 1) return results[0].transcript

  // Split all transcripts into words
  const wordLists = results.map(r =>
    r.transcript.toLowerCase().split(/\s+/).filter(word => word.length > 0)
  )

  const maxLength = Math.max(...wordLists.map(list => list.length))
  const finalWords: string[] = []

  // For each position, find the most common word
  for (let i = 0; i < maxLength; i++) {
    const wordCounts = new Map<string, number>()

    wordLists.forEach(wordList => {
      if (i < wordList.length) {
        const word = wordList[i]
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
      }
    })

    if (wordCounts.size > 0) {
      const mostCommonWord = [...wordCounts.entries()]
        .reduce((best, current) => current[1] > best[1] ? current : best)[0]
      finalWords.push(mostCommonWord)
    }
  }

  return finalWords.join(" ")
}

/**
 * Combine results using weighted average based on provider weights and confidence
 */
function combineWeightedAverage(
  results: TranscriptionResult[],
  providerWeights: Partial<Record<STT_PROVIDER_ID, number>>
): string {
  if (results.length === 0) return ""
  if (results.length === 1) return results[0].transcript

  // Calculate total weight for each result
  const weightedResults = results.map(result => {
    const providerWeight = providerWeights[result.provider] || 1.0
    const totalWeight = providerWeight * result.confidence
    return { ...result, totalWeight }
  })

  // For now, return the result with highest total weight
  // In a more sophisticated implementation, we could do character-level weighting
  return weightedResults.reduce((best, current) =>
    current.totalWeight > best.totalWeight ? current : best
  ).transcript
}

/**
 * Combine results using consensus - require agreement between providers
 */
function combineConsensus(results: TranscriptionResult[], threshold: number): string {
  if (results.length === 0) return ""
  if (results.length === 1) return results[0].transcript

  // Filter results that meet confidence threshold
  const highConfidenceResults = results.filter(r => r.confidence >= threshold)

  if (highConfidenceResults.length === 0) {
    // No high confidence results, return best available
    return results.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    ).transcript
  }

  // For consensus, we'll use a simple similarity check
  // In production, you might want more sophisticated text similarity
  const transcripts = highConfidenceResults.map(r => r.transcript.toLowerCase().trim())

  // Find the transcript that appears most frequently (exact match)
  const transcriptCounts = new Map<string, number>()
  transcripts.forEach(transcript => {
    transcriptCounts.set(transcript, (transcriptCounts.get(transcript) || 0) + 1)
  })

  const consensusTranscript = [...transcriptCounts.entries()]
    .reduce((best, current) => current[1] > best[1] ? current : best)[0]

  return consensusTranscript
}

/**
 * Calculate overall confidence based on strategy
 */
function calculateOverallConfidence(
  results: TranscriptionResult[],
  strategy: FusionStrategy
): number {
  if (results.length === 0) return 0

  switch (strategy) {
    case "best-confidence":
      return Math.max(...results.map(r => r.confidence))

    case "primary-fallback":
    case "consensus":
      return results.reduce((sum, r) => sum + r.confidence, 0) / results.length

    case "majority-vote":
      // Higher confidence if more providers agree
      return Math.min(0.95, results.length * 0.2 + 0.3)

    case "weighted-average":
      // Weighted average of confidences
      const totalWeight = results.reduce((sum, r) => sum + r.confidence, 0)
      return totalWeight / results.length

    default:
      return results.reduce((sum, r) => sum + r.confidence, 0) / results.length
  }
}

/**
 * Estimate confidence for a transcript from a specific provider
 * This is a heuristic since most APIs don't return confidence scores
 */
function estimateConfidence(
  transcript: string,
  provider: STT_PROVIDER_ID,
  processingTime: number
): number {
  // Base confidence by provider (based on general reliability)
  const baseConfidence = {
    openai: 0.9,
    groq: 0.85
  }[provider] || 0.7

  // Adjust based on transcript characteristics
  let confidence = baseConfidence

  // Longer transcripts generally more reliable if they make sense
  if (transcript.length > 50) {
    confidence += 0.05
  }

  // Very short transcripts might be noise
  if (transcript.length < 5) {
    confidence -= 0.2
  }

  // Adjust based on processing time (very fast might indicate simple/short audio)
  if (processingTime < 1000) {
    confidence -= 0.1
  } else if (processingTime > 10000) {
    confidence -= 0.05 // Very slow might indicate problems
  }

  // Check for obvious errors or garbled text
  const wordCount = transcript.split(/\s+/).length
  const avgWordLength = transcript.length / wordCount

  if (avgWordLength > 15) { // Unusually long "words" might be garbled
    confidence -= 0.15
  }

  // Ensure confidence stays in valid range
  return Math.max(0.1, Math.min(0.99, confidence))
}

/**
 * Test fusion configuration with current providers
 */
export async function testFusionConfiguration(config: FusionConfig): Promise<{
  success: boolean
  availableProviders: STT_PROVIDER_ID[]
  errors: string[]
}> {
  const globalConfig = configStore.get()
  const availableProviders: STT_PROVIDER_ID[] = []
  const errors: string[] = []

  for (const provider of config.providers) {
    try {
      let hasApiKey = false

      switch (provider) {
        case "openai":
          hasApiKey = !!globalConfig.openaiApiKey
          break
        case "groq":
          hasApiKey = !!globalConfig.groqApiKey
          break
      }

      if (!hasApiKey) {
        errors.push(`${provider}: API key not configured`)
      } else {
        availableProviders.push(provider)
      }
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    success: availableProviders.length >= config.minProvidersRequired,
    availableProviders,
    errors
  }
}
