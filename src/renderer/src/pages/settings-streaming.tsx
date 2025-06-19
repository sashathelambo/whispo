import { Button } from "@renderer/components/ui/button"
import { Control, ControlGroup } from "@renderer/components/ui/control"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from "@renderer/components/ui/dialog"
import { Input } from "@renderer/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@renderer/components/ui/select"
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
import { tipcClient } from "@renderer/lib/tipc-client"
import {
    DEFAULT_STREAMING_DICTATION_CONFIG,
    STREAMING_DICTATION_COMMANDS,
    STREAMING_DICTATION_LANGUAGES
} from "@shared/index"
import { Config } from "@shared/types"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"

export function Component() {
  const configQuery = useConfigQuery()
  const saveConfigMutation = useSaveConfigMutation()
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false)

  const saveConfig = (config: Partial<Config>) => {
    saveConfigMutation.mutate({
      config: {
        ...configQuery.data,
        ...config,
      },
    })
  }

  // Get streaming dictation status
  const streamingStatusQuery = useQuery({
    queryKey: ["streaming-dictation-status"],
    queryFn: () => tipcClient.getStreamingDictationStatus(),
    refetchInterval: 1000,
  })

  // Test streaming dictation
  const testStreamingMutation = useMutation({
    mutationFn: async () => {
      await tipcClient.initStreamingDictation()
      return true
    },
    onSuccess() {
      console.log("Streaming dictation test completed")
    },
    onError(error) {
      console.error("Streaming dictation test failed:", error)
    },
  })

  if (!configQuery.data) return null

  const config = configQuery.data
  const streamingConfig = {
    ...DEFAULT_STREAMING_DICTATION_CONFIG,
    ...config.streamingDictation,
  }

  const updateStreamingConfig = (updates: Partial<typeof streamingConfig>) => {
    saveConfig({
      streamingDictation: {
        ...streamingConfig,
        ...updates,
      },
    })
  }

  const isStreamingActive = streamingStatusQuery.data?.isActive || false
  const isStreamingListening = streamingStatusQuery.data?.isListening || false

  return (
    <div className="grid gap-4">
      <ControlGroup
        title="Streaming Dictation"
        endDescription="Real-time speech-to-text that types as you speak, no recording workflow"
      >
        <Control label="Enable Streaming Dictation" className="px-3">
          <Switch
            checked={streamingConfig.enabled}
            onCheckedChange={(value) => {
              updateStreamingConfig({ enabled: value })
            }}
          />
        </Control>

        {streamingConfig.enabled && (
          <>
            <Control label="Status" className="px-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isStreamingActive
                    ? isStreamingListening
                      ? 'bg-green-500 animate-pulse'
                      : 'bg-blue-500'
                    : 'bg-gray-400'
                }`}></div>
                <span className="text-sm text-muted-foreground">
                  {isStreamingActive
                    ? isStreamingListening
                      ? 'Listening'
                      : 'Active'
                    : 'Inactive'}
                </span>
                {streamingStatusQuery.data?.wordsSpoken && streamingStatusQuery.data.wordsSpoken > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {streamingStatusQuery.data.wordsSpoken} words spoken
                  </span>
                )}
              </div>
            </Control>

            <Control label="Test Streaming" className="px-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 px-2"
                  onClick={() => setIsTestDialogOpen(true)}
                  disabled={testStreamingMutation.isPending}
                >
                  <span className="i-mingcute-mic-line"></span>
                  Test Setup
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="i-mingcute-information-line text-muted-foreground"></span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Test browser speech recognition compatibility</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </Control>
          </>
        )}
      </ControlGroup>

      {streamingConfig.enabled && (
        <>
          <ControlGroup title="Recognition Settings">
            <Control label="Language" className="px-3">
              <Select
                value={streamingConfig.language}
                onValueChange={(value) => updateStreamingConfig({ language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STREAMING_DICTATION_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Control>

            <Control label="Continuous Recognition" className="px-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={streamingConfig.continuous}
                  onCheckedChange={(value) => updateStreamingConfig({ continuous: value })}
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="i-mingcute-information-line text-muted-foreground"></span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Keep listening continuously vs stopping after each phrase</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </Control>

            <Control label="Show Interim Results" className="px-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={streamingConfig.interimResults}
                  onCheckedChange={(value) => updateStreamingConfig({ interimResults: value })}
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="i-mingcute-information-line text-muted-foreground"></span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Show partial text while you're still speaking</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </Control>

            <Control label="Sensitivity" className="px-3">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={streamingConfig.sensitivity}
                  onChange={(e) => updateStreamingConfig({ sensitivity: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-8">
                  {streamingConfig.sensitivity}%
                </span>
              </div>
            </Control>
          </ControlGroup>

          <ControlGroup title="Text Processing">
            <Control label="Punctuation Mode" className="px-3">
              <Select
                value={streamingConfig.punctuationMode}
                onValueChange={(value) => updateStreamingConfig({
                  punctuationMode: value as 'auto' | 'manual' | 'disabled'
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </Control>

            <Control label="Capitalization Mode" className="px-3">
              <Select
                value={streamingConfig.capitalizationMode}
                onValueChange={(value) => updateStreamingConfig({
                  capitalizationMode: value as 'auto' | 'manual' | 'disabled'
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </Control>

            <Control label="Pause on Silence" className="px-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="10000"
                  value={streamingConfig.pauseOnSilence}
                  onChange={(e) => updateStreamingConfig({
                    pauseOnSilence: parseInt(e.target.value) || 0
                  })}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">ms (0 = never pause)</span>
              </div>
            </Control>

            <Control label="Insert Mode" className="px-3">
              <Select
                value={streamingConfig.insertMode}
                onValueChange={(value) => updateStreamingConfig({
                  insertMode: value as 'replace' | 'append' | 'insert'
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insert">Insert at cursor</SelectItem>
                  <SelectItem value="append">Append to end</SelectItem>
                  <SelectItem value="replace">Replace selection</SelectItem>
                </SelectContent>
              </Select>
            </Control>
          </ControlGroup>

          <ControlGroup title="Voice Commands">
            <Control label="Enable Voice Commands" className="px-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={streamingConfig.enableVoiceCommands}
                  onCheckedChange={(value) => updateStreamingConfig({ enableVoiceCommands: value })}
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="i-mingcute-information-line text-muted-foreground"></span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Enable voice commands like "new line", "delete", etc.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </Control>

            {streamingConfig.enableVoiceCommands && (
              <Control label="Available Commands" className="px-3">
                <div className="space-y-1">
                  {STREAMING_DICTATION_COMMANDS.map((cmd) => (
                    <div key={cmd.command} className="flex items-center justify-between text-xs">
                      <span className="font-mono bg-muted px-2 py-1 rounded">
                        "{cmd.command}"
                      </span>
                      <span className="text-muted-foreground">
                        {cmd.description}
                      </span>
                    </div>
                  ))}
                </div>
              </Control>
            )}
          </ControlGroup>

          <ControlGroup title="Advanced Settings">
            <Control label="Context Formatting" className="px-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={streamingConfig.contextFormatting}
                  onCheckedChange={(value) => updateStreamingConfig({ contextFormatting: value })}
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="i-mingcute-information-line text-muted-foreground"></span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Apply context-aware formatting based on the active application</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </Control>

            <Control label="Max Alternatives" className="px-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={streamingConfig.maxAlternatives}
                  onChange={(e) => updateStreamingConfig({
                    maxAlternatives: parseInt(e.target.value) || 1
                  })}
                  className="w-16"
                />
                <span className="text-sm text-muted-foreground">alternative transcriptions</span>
              </div>
            </Control>
          </ControlGroup>
        </>
      )}

      {/* Test Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Streaming Dictation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Browser Compatibility</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Streaming dictation requires browser speech recognition support.
                This feature works best in Chromium-based browsers.
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>✓ Chrome, Edge, Opera</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  <span>⚠ Firefox (limited support)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span>✗ Safari (not supported)</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => {
                  testStreamingMutation.mutate()
                }}
                disabled={testStreamingMutation.isPending}
                className="w-full"
              >
                {testStreamingMutation.isPending ? "Testing..." : "Test Recognition"}
              </Button>

              <div className="text-xs text-muted-foreground text-center">
                This will initialize the speech recognition system
              </div>
            </div>

            {streamingStatusQuery.data && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>Status: {streamingStatusQuery.data.isActive ? "Active" : "Inactive"}</div>
                  <div>Listening: {streamingStatusQuery.data.isListening ? "Yes" : "No"}</div>
                  <div>Audio Level: {streamingStatusQuery.data.audioLevel}%</div>
                  <div>Confidence: {Math.round(streamingStatusQuery.data.confidence * 100)}%</div>
                </div>
                {streamingStatusQuery.data.currentText && (
                  <div className="mt-2 p-2 bg-background rounded border">
                    <div className="text-xs text-muted-foreground mb-1">Current Text:</div>
                    <div>{streamingStatusQuery.data.currentText}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
