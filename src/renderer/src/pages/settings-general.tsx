import { Button } from "@renderer/components/ui/button"
import { Control, ControlGroup } from "@renderer/components/ui/control"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@renderer/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@renderer/components/ui/select"
import { Switch } from "@renderer/components/ui/switch"
import { Textarea } from "@renderer/components/ui/textarea"
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
    CHAT_PROVIDER_ID,
    DEFAULT_STREAMING_DICTATION_CONFIG,
    getAvailableChatProviders,
    getAvailableSTTProviders,
    getHoldKeyDisplayName,
    HOLD_KEY_OPTIONS,
    SHORTCUT_OPTIONS,
    STREAMING_DICTATION_COMMANDS,
    STREAMING_DICTATION_LANGUAGES,
    STT_PROVIDER_ID
} from "@shared/index"
import { Config } from "@shared/types"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"

export function Component() {
  const configQuery = useConfigQuery()
  const saveConfigMutation = useSaveConfigMutation()
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false)

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

  const saveConfig = (config: Partial<Config>) => {
    saveConfigMutation.mutate({
      config: {
        ...configQuery.data,
        ...config,
      },
    })
  }

  const sttProviderId: STT_PROVIDER_ID =
    configQuery.data?.sttProviderId || "openai"
  const shortcut = configQuery.data?.shortcut || "hold-key"
  const holdKey = configQuery.data?.holdKey || "AltLeft+Space"
  const transcriptPostProcessingProviderId: CHAT_PROVIDER_ID =
    configQuery.data?.transcriptPostProcessingProviderId || "openai"

  // Streaming dictation configuration
  const streamingConfig = {
    ...DEFAULT_STREAMING_DICTATION_CONFIG,
    ...configQuery.data?.streamingDictation,
  }

  const updateStreamingConfig = (updates: Partial<typeof streamingConfig>) => {
    saveConfig({
      streamingDictation: {
        ...streamingConfig,
        ...updates,
      },
    })
  }

  if (!configQuery.data) return null

  const selectedShortcutOption = SHORTCUT_OPTIONS.find(opt => opt.value === shortcut)
  const selectedHoldKeyOption = HOLD_KEY_OPTIONS.find(opt => opt.value === holdKey)

  const getShortcutDescription = () => {
    if (shortcut === "hold-key") {
      return selectedHoldKeyOption?.description || getHoldKeyDisplayName(holdKey)
    } else if (shortcut === "streaming-dictation") {
      return "Real-time speech-to-text that types as you speak"
    }
    return selectedShortcutOption?.description || ""
  }

  const isStreamingActive = streamingStatusQuery.data?.isActive || false
  const isStreamingListening = streamingStatusQuery.data?.isListening || false
  const streamingWordsSpoken = streamingStatusQuery.data?.wordsSpoken || 0

  return (
    <div className="grid gap-4">
      {process.env.IS_MAC && (
        <ControlGroup title="App">
          <Control label="Hide Dock Icon" className="px-3">
            <Switch
              defaultChecked={configQuery.data.hideDockIcon}
              onCheckedChange={(value) => {
                saveConfig({
                  hideDockIcon: value,
                })
              }}
            />
          </Control>
        </ControlGroup>
      )}

      <ControlGroup
        title="Shortcuts"
        endDescription={
          <div className="flex items-center gap-1">
            <div>
              {getShortcutDescription()}
            </div>
            <TooltipProvider disableHoverableContent delayDuration={0}>
              <Tooltip>
                <TooltipTrigger className="inline-flex items-center justify-center">
                  <span className="i-mingcute-information-fill text-base"></span>
                </TooltipTrigger>
                <TooltipContent collisionPadding={5}>
                  {shortcut === "hold-key"
                    ? "Press any key to cancel"
                    : shortcut === "ctrl-slash"
                    ? "Press Esc to cancel"
                    : shortcut === "voice-activation"
                    ? "Detects voice automatically, no manual control needed"
                    : "Recording disabled for this configuration"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
      >
        <Control label="Recording" className="px-3">
          <Select
            defaultValue={shortcut}
            onValueChange={(value) => {
              saveConfig({
                shortcut: value as typeof configQuery.data.shortcut,
              })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHORTCUT_OPTIONS.filter(opt =>
                ['hold-key', 'ctrl-slash', 'voice-activation', 'streaming-dictation'].includes(opt.value)
              ).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>

        {shortcut === "hold-key" && (
          <Control label="Hold Key" className="px-3">
            <Select
              value={holdKey}
              onValueChange={(value) => {
                saveConfig({ holdKey: value as typeof configQuery.data.holdKey })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOLD_KEY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Control>
        )}
      </ControlGroup>

      {shortcut === "voice-activation" && (
        <ControlGroup
          title="Voice Activation"
          endDescription="Configure automatic voice detection settings for hands-free recording"
        >
          <Control label="Sensitivity" className="px-3">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="10"
                max="90"
                value={configQuery.data.voiceActivation?.sensitivity || 30}
                onChange={(e) => {
                  saveConfig({
                    voiceActivation: {
                      enabled: true,
                      sensitivity: parseInt(e.target.value),
                      silenceThreshold: configQuery.data.voiceActivation?.silenceThreshold || 2000,
                      noiseGate: configQuery.data.voiceActivation?.noiseGate || 20,
                      minRecordingDuration: configQuery.data.voiceActivation?.minRecordingDuration || 500,
                      maxRecordingDuration: configQuery.data.voiceActivation?.maxRecordingDuration || 30000,
                    },
                  })
                }}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-8">
                {configQuery.data.voiceActivation?.sensitivity || 30}%
              </span>
            </div>
          </Control>

          <Control label="Silence Threshold" className="px-3">
            <Select
              defaultValue={String(configQuery.data.voiceActivation?.silenceThreshold || 2000)}
              onValueChange={(value) => {
                saveConfig({
                  voiceActivation: {
                    enabled: true,
                    sensitivity: configQuery.data.voiceActivation?.sensitivity || 30,
                    silenceThreshold: parseInt(value),
                    noiseGate: configQuery.data.voiceActivation?.noiseGate || 20,
                    minRecordingDuration: configQuery.data.voiceActivation?.minRecordingDuration || 500,
                    maxRecordingDuration: configQuery.data.voiceActivation?.maxRecordingDuration || 30000,
                  },
                })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1 second</SelectItem>
                <SelectItem value="2000">2 seconds</SelectItem>
                <SelectItem value="3000">3 seconds</SelectItem>
                <SelectItem value="5000">5 seconds</SelectItem>
              </SelectContent>
            </Select>
          </Control>

          <Control label="Max Recording Duration" className="px-3">
            <Select
              defaultValue={String(configQuery.data.voiceActivation?.maxRecordingDuration || 30000)}
              onValueChange={(value) => {
                saveConfig({
                  voiceActivation: {
                    enabled: true,
                    sensitivity: configQuery.data.voiceActivation?.sensitivity || 30,
                    silenceThreshold: configQuery.data.voiceActivation?.silenceThreshold || 2000,
                    noiseGate: configQuery.data.voiceActivation?.noiseGate || 20,
                    minRecordingDuration: configQuery.data.voiceActivation?.minRecordingDuration || 500,
                    maxRecordingDuration: parseInt(value),
                  },
                })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15000">15 seconds</SelectItem>
                <SelectItem value="30000">30 seconds</SelectItem>
                <SelectItem value="60000">1 minute</SelectItem>
                <SelectItem value="120000">2 minutes</SelectItem>
              </SelectContent>
            </Select>
          </Control>
        </ControlGroup>
      )}

      {/* Streaming Dictation Configuration */}
      {shortcut === "streaming-dictation" && (
        <ControlGroup
          title="Streaming Dictation"
          endDescription="Real-time speech-to-text configuration for live typing as you speak"
        >
          <Control label="Streaming Status" className="px-3">
            <div className="flex items-center gap-3">
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
              {streamingWordsSpoken > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  {streamingWordsSpoken} words spoken
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1 px-2 ml-auto"
                onClick={() => setIsTestDialogOpen(true)}
                disabled={testStreamingMutation.isPending}
              >
                <span className="i-mingcute-mic-line"></span>
                Test
              </Button>
            </div>
          </Control>

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

          <Control label="Voice Commands" className="px-3">
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
      )}

      <ControlGroup title="Speech to Text">
        <Control label="Provider" className="px-3">
          <div className="space-y-2">
            <Select
              defaultValue={sttProviderId}
              onValueChange={(value) => {
                saveConfig({
                  sttProviderId: value as STT_PROVIDER_ID,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableSTTProviders(configQuery.data).map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-2">
                      <span className="i-mingcute-check-circle-fill text-green-500 text-xs"></span>
                      {p.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getAvailableSTTProviders(configQuery.data).length === 0 && (
              <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <span className="i-mingcute-alert-circle-line"></span>
                No STT providers are enabled. Please configure and enable at least one provider in the Providers settings.
              </div>
            )}
          </div>
        </Control>
      </ControlGroup>

      <ControlGroup title="Transcript Post-Processing">
        <Control label="Enabled" className="px-3">
          <Switch
            defaultChecked={configQuery.data.transcriptPostProcessingEnabled}
            onCheckedChange={(value) => {
              saveConfig({
                transcriptPostProcessingEnabled: value,
              })
            }}
          />
        </Control>

        {configQuery.data.transcriptPostProcessingEnabled && (
          <>
            <Control label="Provider" className="px-3">
              <div className="space-y-2">
                <Select
                  defaultValue={transcriptPostProcessingProviderId}
                  onValueChange={(value) => {
                    saveConfig({
                      transcriptPostProcessingProviderId:
                        value as CHAT_PROVIDER_ID,
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableChatProviders(configQuery.data).map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-2">
                          <span className="i-mingcute-check-circle-fill text-green-500 text-xs"></span>
                          {p.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getAvailableChatProviders(configQuery.data).length === 0 && (
                  <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                    <span className="i-mingcute-alert-circle-line"></span>
                    No Chat providers are enabled. Please configure and enable at least one provider in the Providers settings.
                  </div>
                )}
              </div>
            </Control>

            <Control label="Prompt" className="px-3">
              <div className="flex flex-col items-end gap-1 text-right">
                {configQuery.data.transcriptPostProcessingPrompt && (
                  <div className="line-clamp-3 text-sm text-neutral-500 dark:text-neutral-400">
                    {configQuery.data.transcriptPostProcessingPrompt}
                  </div>
                )}
                <Dialog>
                  <DialogTrigger className="" asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 px-2"
                    >
                      <span className="i-mingcute-edit-2-line"></span>
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Prompt</DialogTitle>
                    </DialogHeader>
                    <Textarea
                      rows={10}
                      defaultValue={
                        configQuery.data.transcriptPostProcessingPrompt
                      }
                      onChange={(e) => {
                        saveConfig({
                          transcriptPostProcessingPrompt: e.currentTarget.value,
                        })
                      }}
                    ></Textarea>
                    <div className="text-sm text-muted-foreground">
                      Use <span className="select-text">{"{transcript}"}</span>{" "}
                      placeholder to insert the original transcript
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </Control>
          </>
        )}
      </ControlGroup>

      {/* Streaming Dictation Test Dialog */}
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

            {streamingConfig.enableVoiceCommands && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-2 text-sm">Available Voice Commands</h4>
                <div className="space-y-1">
                  {STREAMING_DICTATION_COMMANDS.slice(0, 4).map((cmd) => (
                    <div key={cmd.command} className="flex items-center justify-between text-xs">
                      <span className="font-mono bg-background px-2 py-1 rounded">
                        "{cmd.command}"
                      </span>
                      <span className="text-muted-foreground">
                        {cmd.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
