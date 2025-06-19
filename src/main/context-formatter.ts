/**
 * Context-Aware Formatting Module
 * Automatically formats transcribed text based on application context
 * Enables voice input for technical prompting, coding, and specialized use cases
 */

import { APPLICATION_CONTEXTS, APP_CONTEXT_PATTERNS, DEFAULT_CONTEXT_PROMPTS } from "@shared/index"
import { ApplicationContext, ContextFormatting } from "@shared/types"
import { ActiveAppInfo, getActiveApplication } from "./app-detector"
import { configStore } from "./config"

/**
 * Detect application context based on active application info
 */
export function detectApplicationContext(appInfo: ActiveAppInfo): ApplicationContext {
  const appName = appInfo.name.toLowerCase()
  const executable = appInfo.executable.toLowerCase()
  const title = appInfo.title.toLowerCase()

  // Check each context pattern
  for (const [context, patterns] of Object.entries(APP_CONTEXT_PATTERNS)) {
    for (const pattern of patterns) {
      // Check app name pattern
      if (pattern.name.test(appName) || pattern.name.test(title)) {
        return context as ApplicationContext
      }

      // Check executable pattern
      if (pattern.executable && pattern.executable.test(executable)) {
        return context as ApplicationContext
      }
    }
  }

  // Check for specific title patterns that might indicate context
  if (title.includes('.js') || title.includes('.ts') || title.includes('.py') ||
      title.includes('.java') || title.includes('.cpp') || title.includes('.cs') ||
      title.includes('.html') || title.includes('.css') || title.includes('.json') ||
      title.includes('.xml') || title.includes('.yaml') || title.includes('.sql')) {
    return "code-editor"
  }

  if (title.includes('terminal') || title.includes('command') || title.includes('powershell') || title.includes('bash')) {
    return "terminal"
  }

  if (title.includes('mail') || title.includes('inbox') || title.includes('compose')) {
    return "email"
  }

  if (title.includes('slack') || title.includes('discord') || title.includes('teams') || title.includes('chat')) {
    return "chat"
  }

  // Default to generic if no specific context is detected
  return "generic"
}

/**
 * Get effective formatting configuration for current context
 */
export function getEffectiveFormattingConfig(
  appInfo: ActiveAppInfo,
  activeRule?: any
): ContextFormatting | null {
  const globalConfig = configStore.get()
  const globalFormatting = globalConfig.contextFormatting

  // Check if global context formatting is enabled
  if (!globalFormatting?.enabled) {
    return null
  }

  // Check if active rule has context formatting
  if (activeRule?.contextFormatting?.enabled) {
    return activeRule.contextFormatting
  }

  // Auto-detect context if enabled
  if (globalFormatting.autoDetectContext) {
    const detectedContext = detectApplicationContext(appInfo)

    return {
      enabled: true,
      context: detectedContext,
      prompt: DEFAULT_CONTEXT_PROMPTS[detectedContext],
      enableCodeFormatting: detectedContext === "code-editor" || detectedContext === "terminal",
      enableListFormatting: detectedContext === "notes" || detectedContext === "presentation",
      enableProfessionalTone: detectedContext === "email",
      enableTechnicalTerms: detectedContext === "code-editor" || detectedContext === "terminal" || detectedContext === "design",
    }
  }

  // Use fallback context
  const fallbackContext = globalFormatting.fallbackContext || "generic"
  return {
    enabled: true,
    context: fallbackContext,
    prompt: DEFAULT_CONTEXT_PROMPTS[fallbackContext],
    enableCodeFormatting: fallbackContext === "code-editor" || fallbackContext === "terminal",
    enableListFormatting: fallbackContext === "notes" || fallbackContext === "presentation",
    enableProfessionalTone: fallbackContext === "email",
    enableTechnicalTerms: fallbackContext === "code-editor" || fallbackContext === "terminal" || fallbackContext === "design",
  }
}

/**
 * Build context-aware formatting prompt
 */
export function buildContextFormattingPrompt(
  transcript: string,
  formatting: ContextFormatting
): string {
  let prompt = formatting.prompt

  // Replace transcript placeholder
  prompt = prompt.replace(/\{transcript\}/g, transcript)

  // Add custom instructions if provided
  if (formatting.customInstructions) {
    prompt += `\n\nAdditional instructions: ${formatting.customInstructions}`
  }

  // Add context-specific enhancements
  const enhancements: string[] = []

  if (formatting.enableCodeFormatting) {
    enhancements.push("- Pay special attention to code syntax and programming terminology")
  }

  if (formatting.enableListFormatting) {
    enhancements.push("- Convert appropriate content to bullet points or numbered lists")
  }

  if (formatting.enableProfessionalTone) {
    enhancements.push("- Maintain a professional, business-appropriate tone throughout")
  }

  if (formatting.enableTechnicalTerms) {
    enhancements.push("- Preserve technical terminology and jargon accurately")
  }

  if (enhancements.length > 0) {
    prompt += `\n\nSpecial considerations:\n${enhancements.join('\n')}`
  }

  return prompt
}

/**
 * Enhanced formatting for specific contexts
 */
export function applyContextSpecificFormatting(
  text: string,
  context: ApplicationContext
): string {
  switch (context) {
    case "code-editor":
      return formatForCodeEditor(text)

    case "terminal":
      return formatForTerminal(text)

    case "email":
      return formatForEmail(text)

    case "chat":
      return formatForChat(text)

    case "notes":
      return formatForNotes(text)

    default:
      return formatGeneric(text)
  }
}

/**
 * Format text for code editor context
 */
function formatForCodeEditor(text: string): string {
  // Basic code formatting enhancements
  let formatted = text

  // Fix common spoken-to-code patterns
  formatted = formatted.replace(/\bfunction\s+(\w+)/gi, 'function $1')
  formatted = formatted.replace(/\bconst\s+(\w+)/gi, 'const $1')
  formatted = formatted.replace(/\blet\s+(\w+)/gi, 'let $1')
  formatted = formatted.replace(/\bvar\s+(\w+)/gi, 'var $1')
  formatted = formatted.replace(/\bif\s*\(/gi, 'if (')
  formatted = formatted.replace(/\bfor\s*\(/gi, 'for (')
  formatted = formatted.replace(/\bwhile\s*\(/gi, 'while (')

  // Fix spacing around operators
  formatted = formatted.replace(/\s*=\s*/g, ' = ')
  formatted = formatted.replace(/\s*\+\s*/g, ' + ')
  formatted = formatted.replace(/\s*-\s*/g, ' - ')
  formatted = formatted.replace(/\s*\*\s*/g, ' * ')
  formatted = formatted.replace(/\s*\/\s*/g, ' / ')

  return formatted
}

/**
 * Format text for terminal context
 */
function formatForTerminal(text: string): string {
  let formatted = text

  // Common command patterns
  formatted = formatted.replace(/change directory to/gi, 'cd')
  formatted = formatted.replace(/list directory/gi, 'ls')
  formatted = formatted.replace(/list files/gi, 'ls')
  formatted = formatted.replace(/make directory/gi, 'mkdir')
  formatted = formatted.replace(/remove file/gi, 'rm')
  formatted = formatted.replace(/copy file/gi, 'cp')
  formatted = formatted.replace(/move file/gi, 'mv')

  // Fix command spacing
  formatted = formatted.replace(/\s+-/g, ' -')
  formatted = formatted.replace(/\s+--/g, ' --')

  return formatted
}

/**
 * Format text for email context
 */
function formatForEmail(text: string): string {
  let formatted = text

  // Capitalize first letter of sentences
  formatted = formatted.replace(/(^|\. )([a-z])/g, (_match, prefix, letter) =>
    prefix + letter.toUpperCase()
  )

  // Add proper punctuation
  if (!formatted.endsWith('.') && !formatted.endsWith('!') && !formatted.endsWith('?')) {
    formatted += '.'
  }

  return formatted
}

/**
 * Format text for chat context
 */
function formatForChat(text: string): string {
  let formatted = text

  // Keep it casual but clean
  formatted = formatted.replace(/\bum+\b/gi, '')
  formatted = formatted.replace(/\buh+\b/gi, '')
  formatted = formatted.replace(/\s+/g, ' ')
  formatted = formatted.trim()

  return formatted
}

/**
 * Format text for notes context
 */
function formatForNotes(text: string): string {
  let formatted = text

  // Convert lists if appropriate
  if (formatted.includes(' and ') && formatted.split(' and ').length > 2) {
    const items = formatted.split(' and ')
    formatted = items.map(item => `• ${item.trim()}`).join('\n')
  }

  return formatted
}

/**
 * Generic formatting
 */
function formatGeneric(text: string): string {
  let formatted = text

  // Basic cleanup
  formatted = formatted.replace(/\bum+\b/gi, '')
  formatted = formatted.replace(/\buh+\b/gi, '')
  formatted = formatted.replace(/\blike\b/gi, '')
  formatted = formatted.replace(/\s+/g, ' ')
  formatted = formatted.trim()

  // Capitalize first letter
  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }

  // Add period if needed
  if (!formatted.endsWith('.') && !formatted.endsWith('!') && !formatted.endsWith('?')) {
    formatted += '.'
  }

  return formatted
}

/**
 * Test context detection with current active app
 */
export async function testContextDetection(): Promise<{
  appInfo: ActiveAppInfo | null
  detectedContext: ApplicationContext | null
  availableContexts: typeof APPLICATION_CONTEXTS
}> {
  const appInfo = await getActiveApplication()

  if (!appInfo) {
    return {
      appInfo: null,
      detectedContext: null,
      availableContexts: APPLICATION_CONTEXTS
    }
  }

  const detectedContext = detectApplicationContext(appInfo)

  return {
    appInfo,
    detectedContext,
    availableContexts: APPLICATION_CONTEXTS
  }
}
