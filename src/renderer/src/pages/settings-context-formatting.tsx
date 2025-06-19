/**
 * Settings page for Context-Aware Formatting
 * Allows users to configure automatic text formatting based on application context
 */

import { Button } from "@renderer/components/ui/button"
import { Control, ControlGroup } from "@renderer/components/ui/control"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@renderer/components/ui/select"
import { Spinner } from "@renderer/components/ui/spinner"
import { Switch } from "@renderer/components/ui/switch"
import { Textarea } from "@renderer/components/ui/textarea"
import { useConfigQuery, useSaveConfigMutation } from "@renderer/lib/query-client"
import { tipcClient } from "@renderer/lib/tipc-client"
import { APPLICATION_CONTEXTS, DEFAULT_CONTEXT_PROMPTS } from "@shared/index"
import { ApplicationContext, Config, GlobalContextFormatting } from "@shared/types"
import { useEffect, useState } from "react"

export function Component() {
  const configQuery = useConfigQuery()
  const saveConfigMutation = useSaveConfigMutation()

  const [contextFormatting, setContextFormatting] = useState<GlobalContextFormatting>()
  const [testTranscript, setTestTranscript] = useState("create a function to calculate the sum of two numbers")
  const [testingPreview, setTestingPreview] = useState(false)
  const [previewResult, setPreviewResult] = useState<any>(null)
  const [testingDetection, setTestingDetection] = useState(false)
  const [detectionResult, setDetectionResult] = useState<any>(null)
  const [selectedContext, setSelectedContext] = useState<ApplicationContext>("code-editor")

  // Initialize state when config loads
  useEffect(() => {
    if (configQuery.data?.contextFormatting) {
      setContextFormatting(configQuery.data.contextFormatting)
    }
  }, [configQuery.data])

  const saveConfig = (updates: Partial<GlobalContextFormatting>) => {
    if (!configQuery.data || !contextFormatting) return

    const newContextFormatting = { ...contextFormatting, ...updates }
    const newConfig: Config = {
      ...configQuery.data,
      contextFormatting: newContextFormatting,
    }

    saveConfigMutation.mutate({ config: newConfig })
    setContextFormatting(newContextFormatting)
  }

  const testContextDetection = async () => {
    setTestingDetection(true)
    try {
      const result = await tipcClient.testContextDetection()
      setDetectionResult(result)
    } catch (error) {
      console.error("Failed to test context detection:", error)
      setDetectionResult({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      setTestingDetection(false)
    }
  }

  const previewFormatting = async () => {
    if (!contextFormatting || !testTranscript) return

    setTestingPreview(true)
    try {
      const formattingConfig = {
        enabled: true,
        context: selectedContext,
        prompt: DEFAULT_CONTEXT_PROMPTS[selectedContext],
        enableCodeFormatting: selectedContext === "code-editor" || selectedContext === "terminal",
        enableListFormatting: selectedContext === "notes" || selectedContext === "presentation",
        enableProfessionalTone: selectedContext === "email",
        enableTechnicalTerms: selectedContext === "code-editor" || selectedContext === "terminal" || selectedContext === "design",
      }

      const result = await tipcClient.previewContextFormatting({
        transcript: testTranscript,
        formattingConfig
      })
      setPreviewResult(result)
    } catch (error) {
      console.error("Failed to preview formatting:", error)
      setPreviewResult({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      setTestingPreview(false)
    }
  }

  if (!configQuery.data || !contextFormatting) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Automatically format transcribed text based on the active application context.
          This enables voice input for technical prompting, coding, emails, and more.
        </p>
      </div>

      {/* Main Enable/Disable */}
      <ControlGroup title="Context-Aware Formatting">
        <Control label="Enable Context-Aware Formatting" className="px-3">
          <Switch
            checked={contextFormatting.enabled}
            onCheckedChange={(enabled) => saveConfig({ enabled })}
          />
        </Control>
      </ControlGroup>

      {contextFormatting.enabled && (
        <>
          {/* Auto-detection Settings */}
          <ControlGroup title="Detection Settings">
            <Control label="Auto-detect Context" className="px-3">
              <Switch
                checked={contextFormatting.autoDetectContext}
                onCheckedChange={(autoDetectContext) => saveConfig({ autoDetectContext })}
              />
            </Control>

            <Control label="Fallback Context" className="px-3">
              <Select
                value={contextFormatting.fallbackContext || "generic"}
                onValueChange={(fallbackContext) =>
                  saveConfig({ fallbackContext: fallbackContext as ApplicationContext })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_CONTEXTS.map((context) => (
                    <SelectItem key={context.value} value={context.value}>
                      {context.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Control>

            <Control label="Test Context Detection" className="px-3">
              <div className="space-y-2">
                <Button
                  onClick={testContextDetection}
                  disabled={testingDetection}
                  variant="outline"
                  size="sm"
                >
                  {testingDetection ? <Spinner className="h-4 w-4" /> : "Test Detection"}
                </Button>

                {detectionResult && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                    {detectionResult.error ? (
                      <div className="text-red-600">Error: {detectionResult.error}</div>
                    ) : (
                      <div className="space-y-1">
                        <div><strong>App:</strong> {detectionResult.appInfo?.name || "Unknown"}</div>
                        <div><strong>Detected Context:</strong> {detectionResult.detectedContext || "None"}</div>
                        <div><strong>Window Title:</strong> {detectionResult.appInfo?.title || "N/A"}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Control>
          </ControlGroup>

          {/* Smart Formatting Settings */}
          <ControlGroup title="Smart Formatting">
            <Control label="Enable AI-Powered Formatting" className="px-3">
              <Switch
                checked={contextFormatting.enableSmartFormatting}
                onCheckedChange={(enableSmartFormatting) => saveConfig({ enableSmartFormatting })}
              />
            </Control>

            <Control label="Preserve Original on Error" className="px-3">
              <Switch
                checked={contextFormatting.preserveOriginalOnError}
                onCheckedChange={(preserveOriginalOnError) => saveConfig({ preserveOriginalOnError })}
              />
            </Control>
          </ControlGroup>

          {/* Preview Section */}
          <ControlGroup title="Preview & Test">
            <Control label="Test Context" className="px-3">
              <Select
                value={selectedContext}
                onValueChange={(context) => setSelectedContext(context as ApplicationContext)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_CONTEXTS.map((context) => (
                    <SelectItem key={context.value} value={context.value}>
                      {context.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Control>

            <Control label="Test Transcript" className="px-3">
              <div className="space-y-2">
                <Textarea
                  value={testTranscript}
                  onChange={(e) => setTestTranscript(e.target.value)}
                  placeholder="Enter a sample transcript to test formatting..."
                  rows={3}
                />
                <Button
                  onClick={previewFormatting}
                  disabled={testingPreview || !testTranscript}
                  variant="outline"
                  size="sm"
                >
                  {testingPreview ? <Spinner className="h-4 w-4" /> : "Preview Formatting"}
                </Button>
              </div>
            </Control>

            {previewResult && (
              <div className="px-3 space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Original:</label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                    {previewResult.originalTranscript}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Basic Formatted:</label>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                    {previewResult.basicFormatted}
                  </div>
                </div>

                {contextFormatting.enableSmartFormatting && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">AI Prompt:</label>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm font-mono whitespace-pre-wrap">
                      {previewResult.aiPrompt}
                    </div>
                  </div>
                )}

                {previewResult.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600">
                    Error: {previewResult.error}
                  </div>
                )}
              </div>
            )}
          </ControlGroup>

          {/* Context Information */}
          <ControlGroup title="Available Contexts">
            <div className="px-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {APPLICATION_CONTEXTS.map((context) => (
                  <div key={context.value} className="p-3 border rounded">
                    <div className="font-medium">{context.label}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {context.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ControlGroup>
        </>
      )}
    </div>
  )
}
