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
import { tipcClient } from "@renderer/lib/tipc-client"
import { Config } from "@shared/types"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"

export function Component() {
  const configQuery = useConfigQuery()
  const [testingVoice, setTestingVoice] = useState(false)

  const saveConfigMutation = useSaveConfigMutation()

  const saveConfig = (config: Partial<Config>) => {
    saveConfigMutation.mutate({
      config: {
        ...configQuery.data,
        ...config,
      },
    })
  }

  // Voice activation status query
  const voiceStatusQuery = useQuery({
    queryKey: ["voice-activation-status"],
    queryFn: () => tipcClient.getVoiceActivationStatus(),
    refetchInterval: 1000,
  })

  // Voice activation control mutations
  const startVoiceMutation = useMutation({
    mutationFn: () => tipcClient.startVoiceActivation(),
    onSuccess: () => voiceStatusQuery.refetch(),
  })

  const stopVoiceMutation = useMutation({
    mutationFn: () => tipcClient.stopVoiceActivation(),
    onSuccess: () => voiceStatusQuery.refetch(),
  })

  const initVoiceMutation = useMutation({
    mutationFn: () => tipcClient.initVoiceActivation(),
    onSuccess: () => voiceStatusQuery.refetch(),
  })

  const cleanupVoiceMutation = useMutation({
    mutationFn: () => tipcClient.cleanupVoiceActivation(),
    onSuccess: () => voiceStatusQuery.refetch(),
  })

  if (!configQuery.data) return null

  const voiceConfig = configQuery.data.voiceActivation || {
    enabled: false,
    sensitivity: 30,
    silenceThreshold: 2000,
    noiseGate: 20,
    minRecordingDuration: 500,
    maxRecordingDuration: 30000,
  }

  const isVoiceActivationShortcut = configQuery.data.shortcut === "voice-activation"
  const voiceStatus = voiceStatusQuery.data

  const handleVoiceToggle = async (enabled: boolean) => {
    // First update the config
    saveConfig({
      voiceActivation: {
        ...voiceConfig,
        enabled,
      },
      // Also set the shortcut to voice-activation if enabling
      ...(enabled && { shortcut: "voice-activation" }),
    })

    // Then control the voice activation system
    if (enabled) {
      await initVoiceMutation.mutateAsync()
      await startVoiceMutation.mutateAsync()
    } else {
      await stopVoiceMutation.mutateAsync()
      await cleanupVoiceMutation.mutateAsync()
    }
  }

  const testVoiceDetection = async () => {
    setTestingVoice(true)
    try {
      await tipcClient.startVoiceActivation()
      // Let it run for 5 seconds then stop
      setTimeout(async () => {
        await tipcClient.stopVoiceActivation()
        setTestingVoice(false)
      }, 5000)
    } catch (error) {
      setTestingVoice(false)
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="grid gap-4">
        <ControlGroup
          title="Voice Activation"
          endDescription="Hands-free recording that starts automatically when you speak"
        >
          <Control label="Enable Voice Activation" className="px-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={voiceConfig.enabled && isVoiceActivationShortcut}
                onCheckedChange={handleVoiceToggle}
                disabled={startVoiceMutation.isPending || stopVoiceMutation.isPending}
              />
              {voiceStatus && (
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      voiceStatus.isListening
                        ? 'bg-green-500 animate-pulse'
                        : voiceStatus.isEnabled
                          ? 'bg-yellow-500'
                          : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {voiceStatus.isListening
                      ? 'Listening'
                      : voiceStatus.isEnabled
                        ? 'Active'
                        : 'Inactive'
                    }
                  </span>
                </div>
              )}
            </div>
          </Control>

          {voiceConfig.enabled && (
            <>
              <Control
                label={`Voice Detection Sensitivity (${voiceConfig.sensitivity}%)`}
                className="px-3"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="95"
                    step="5"
                    value={voiceConfig.sensitivity}
                    onChange={(e) => {
                      const sensitivity = parseInt(e.target.value)
                      saveConfig({
                        voiceActivation: {
                          ...voiceConfig,
                          sensitivity,
                        },
                      })
                    }}
                    className="flex-1"
                  />
                  <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={testVoiceDetection}
                          disabled={testingVoice || !voiceConfig.enabled}
                        >
                          {testingVoice ? "Testing..." : "Test"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Test voice detection for 5 seconds
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </Control>

              <Control
                label="Silence Threshold (ms)"
                className="px-3"
              >
                <Input
                  type="number"
                  min="500"
                  max="10000"
                  step="100"
                  value={voiceConfig.silenceThreshold}
                  onChange={(e) => {
                    const silenceThreshold = parseInt(e.target.value)
                    if (!isNaN(silenceThreshold)) {
                      saveConfig({
                        voiceActivation: {
                          ...voiceConfig,
                          silenceThreshold,
                        },
                      })
                    }
                  }}
                />
              </Control>

              <Control
                label="Minimum Recording Duration (ms)"
                className="px-3"
              >
                <Input
                  type="number"
                  min="100"
                  max="2000"
                  step="50"
                  value={voiceConfig.minRecordingDuration}
                  onChange={(e) => {
                    const minRecordingDuration = parseInt(e.target.value)
                    if (!isNaN(minRecordingDuration)) {
                      saveConfig({
                        voiceActivation: {
                          ...voiceConfig,
                          minRecordingDuration,
                        },
                      })
                    }
                  }}
                />
              </Control>
            </>
          )}
        </ControlGroup>

        {voiceConfig.enabled && (
          <ControlGroup title="Voice Status & Controls">
            <Control label="System Status" className="px-3">
              <div className="flex items-center gap-3">
                {voiceStatus ? (
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span>Active:</span>
                      <span className={voiceStatus.isEnabled ? "text-green-600" : "text-red-600"}>
                        {voiceStatus.isEnabled ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Listening:</span>
                      <span className={voiceStatus.isListening ? "text-green-600" : "text-gray-600"}>
                        {voiceStatus.isListening ? "Yes" : "No"}
                      </span>
                    </div>

                  </div>
                ) : (
                  <span className="text-gray-500">Loading status...</span>
                )}

                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startVoiceMutation.mutate()}
                    disabled={voiceStatus?.isListening || startVoiceMutation.isPending}
                  >
                    Start
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => stopVoiceMutation.mutate()}
                    disabled={!voiceStatus?.isListening || stopVoiceMutation.isPending}
                  >
                    Stop
                  </Button>
                </div>
              </div>
            </Control>
          </ControlGroup>
        )}

        <ControlGroup title="How Voice Activation Works">
          <div className="px-3 text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p>
              <strong>🎤 Automatic Detection:</strong> When enabled, the app continuously listens for speech in the background.
            </p>
            <p>
              <strong>📊 Threshold:</strong> Adjusts sensitivity - lower values detect quieter speech, higher values reduce false triggers.
            </p>
            <p>
              <strong>⏱️ Timeouts:</strong> Fine-tune when recording starts and stops for optimal results.
            </p>
            <p>
              <strong>🚀 Mini Bar:</strong> A centered activation bar appears during recording showing your speech in real-time.
            </p>
          </div>
        </ControlGroup>
      </div>
    </TooltipProvider>
  )
}
