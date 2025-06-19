import { Spinner } from "@renderer/components/ui/spinner"
import { Recorder } from "@renderer/lib/recorder"
import { playSound } from "@renderer/lib/sound"
import { cn } from "@renderer/lib/utils"
import { STATUS_BAR_DIMENSIONS } from "@shared/index"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { rendererHandlers, tipcClient } from "~/lib/tipc-client"

const VISUALIZER_BUFFER_LENGTH = 4 // Reduced for compact view

const getInitialVisualizerData = () =>
  Array<number>(VISUALIZER_BUFFER_LENGTH).fill(-1000)

export function Component() {
  const [audioLevel, setAudioLevel] = useState(0)
  const [visualizerData, setVisualizerData] = useState(() =>
    getInitialVisualizerData(),
  )
  const [recording, setRecording] = useState(false)
  const [speechText, setSpeechText] = useState("")
  const [showContextMenu, setShowContextMenu] = useState(false)
  const isConfirmedRef = useRef(false)

  // Check current configuration and voice activation status
  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: () => tipcClient.getConfig(),
    refetchInterval: 2000,
  })

  const voiceStatusQuery = useQuery({
    queryKey: ["voice-activation-status"],
    queryFn: () => tipcClient.getVoiceActivationStatus(),
    refetchInterval: 500, // More frequent updates for better reactivity
  })

  // **NEW: Get streaming dictation status**
  const streamingStatusQuery = useQuery({
    queryKey: ["streaming-dictation-status"],
    queryFn: () => tipcClient.getStreamingDictationStatus(),
    refetchInterval: 500, // Frequent updates for real-time status
  })

  // Get recording state
  const recordingStateQuery = useQuery({
    queryKey: ["recording-state"],
    queryFn: () => tipcClient.getRecordingState(),
    refetchInterval: 500,
  })

  const isVoiceActivationMode = configQuery.data?.shortcut === "voice-activation"
  const isHoldKeyMode = configQuery.data?.shortcut === "hold-key"
  const isStreamingDictationMode = configQuery.data?.shortcut === "streaming-dictation"
  const isVoiceListening = voiceStatusQuery.data?.isListening
  const voiceAudioLevel = voiceStatusQuery.data?.audioLevel || 0
  const isRecording = recordingStateQuery.data?.isRecording || false
  const recordingDuration = recordingStateQuery.data?.duration || 0
  const holdKey = configQuery.data?.holdKey || "AltLeft+Space"

  // Streaming dictation state
  const isStreamingActive = streamingStatusQuery.data?.isActive || false
  const isStreamingListening = streamingStatusQuery.data?.isListening || false
  const streamingAudioLevel = streamingStatusQuery.data?.audioLevel || 0
  const streamingConfidence = streamingStatusQuery.data?.confidence || 0
  const streamingCurrentText = streamingStatusQuery.data?.currentText || ""
  const streamingWordsSpoken = streamingStatusQuery.data?.wordsSpoken || 0

  // Transcription mutation
  const transcribeMutation = useMutation({
    mutationFn: async ({
      blob,
      duration,
    }: {
      blob: Blob
      duration: number
    }) => {
      setSpeechText("Processing...")
      await tipcClient.createRecording({
        recording: await blob.arrayBuffer(),
        duration,
      })
    },
    onSuccess() {
      setSpeechText("✓ Done")
      setTimeout(() => {
        setSpeechText("")
      }, 2000) // Shorter success message duration
    },
    onError(error) {
      setSpeechText("❌ Error")
      setTimeout(() => {
        setSpeechText("")
      }, 2000)
      tipcClient.displayError({
        title: error.name,
        message: error.message,
      })
    },
  })

  const recorderRef = useRef<Recorder | null>(null)

  // Initialize recorder
  useEffect(() => {
    if (recorderRef.current) return

    const recorder = (recorderRef.current = new Recorder())

    recorder.on("record-start", () => {
      setRecording(true)
      setSpeechText("🎤 Listening...")
      tipcClient.recordEvent({ type: "start" })
    })

    recorder.on("visualizer-data", (rms) => {
      setVisualizerData((prev) => {
        const data = [...prev, rms]

        if (data.length > VISUALIZER_BUFFER_LENGTH) {
          data.shift()
        }

        return data
      })
    })

    recorder.on("record-end", (blob, duration) => {
      setRecording(false)
      setVisualizerData(() => getInitialVisualizerData())
      tipcClient.recordEvent({ type: "end" })

      if (!isConfirmedRef.current) {
        setSpeechText("")
        return
      }

      playSound("end_record")
      setSpeechText("Processing...")
      transcribeMutation.mutate({
        blob,
        duration,
      })
    })
  }, [])

  // Listen to recording events
  useEffect(() => {
    const unlisten = rendererHandlers.startRecording.listen(() => {
      setVisualizerData(() => getInitialVisualizerData())
      recorderRef.current?.startRecording()
    })

    return unlisten
  }, [])

  useEffect(() => {
    const unlisten = rendererHandlers.finishRecording.listen(() => {
      isConfirmedRef.current = true
      recorderRef.current?.stopRecording()
    })

    return unlisten
  }, [])

  useEffect(() => {
    const unlisten = rendererHandlers.stopRecording.listen(() => {
      isConfirmedRef.current = false
      recorderRef.current?.stopRecording()
    })

    return unlisten
  }, [])

  useEffect(() => {
    const unlisten = rendererHandlers.startOrFinishRecording.listen(() => {
      if (recording) {
        isConfirmedRef.current = true
        recorderRef.current?.stopRecording()
      } else {
        recorderRef.current?.startRecording()
      }
    })

    return unlisten
  }, [recording])

  // Update audio level for visualization (normalize from 0-100 to 0-1)
  useEffect(() => {
    if (isVoiceActivationMode && isVoiceListening) {
      setAudioLevel(voiceAudioLevel / 100)
    } else if (isStreamingDictationMode && isStreamingListening) {
      setAudioLevel(streamingAudioLevel / 100)
    } else {
      setAudioLevel(0)
    }
  }, [isVoiceActivationMode, isVoiceListening, voiceAudioLevel, isStreamingDictationMode, isStreamingListening, streamingAudioLevel])

  const handleActivate = () => {
    if (isStreamingDictationMode) {
      // Toggle streaming dictation
      if (isStreamingActive) {
        tipcClient.stopStreamingDictation()
      } else {
        tipcClient.startStreamingDictation()
      }
    } else if (!recording) {
      recorderRef.current?.startRecording()
    } else {
      isConfirmedRef.current = true
      recorderRef.current?.stopRecording()
    }
  }

  const handleRightClick = (event: React.MouseEvent) => {
    event.preventDefault()
    setShowContextMenu(true)
    // Hide context menu after 3 seconds
    setTimeout(() => setShowContextMenu(false), 3000)
  }

  // Handle window resizing - fixed compact size
  useEffect(() => {
    // Fixed compact dimensions as specified
    tipcClient.resizeStatusBarWindow({
      width: STATUS_BAR_DIMENSIONS.width,
      height: STATUS_BAR_DIMENSIONS.height,
      expanded: false
    })
  }, []) // Only run once on mount

  const getCompactStatusText = () => {
    // Processing states take priority
    if (speechText) {
      if (speechText.includes('Processing')) return '⚡'
      if (speechText.includes('Done')) return '✓'
      if (speechText.includes('Error')) return '❌'
      if (speechText.length > 3) return speechText.substring(0, 3)
      return speechText
    }

    // Streaming dictation has its own status
    if (isStreamingDictationMode) {
      if (isStreamingActive) {
        if (isStreamingListening) return 'TALK'
        if (streamingCurrentText) return 'TYPE'
        return 'LIVE'
      }
      return 'STRM'
    }

    // Mode-based status text (3 characters max)
    if (isVoiceActivationMode) {
      if (isRecording) return 'REC'
      if (isVoiceListening) return 'LIVE'
      return 'VOICE'
    } else if (isHoldKeyMode) {
      return isRecording ? 'REC' : 'HOLD'
    } else if (configQuery.data?.shortcut === "ctrl-slash") {
      return isRecording ? 'REC' : 'CTRL'
    }
    return 'READY'
  }

  const getCompactStatusIndicator = () => {
    // Streaming dictation indicators
    if (isStreamingDictationMode) {
      if (isStreamingActive && isStreamingListening) {
        return <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
      } else if (isStreamingActive) {
        return <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full"></div>
      }
      return <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
    }

    // Compact single dot indicator with different colors for different states
    if (isRecording) {
      return <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
    } else if (isVoiceActivationMode && isVoiceListening) {
      return <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
    } else if (isVoiceActivationMode) {
      return <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
    } else if (isHoldKeyMode) {
      return <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
    } else if (configQuery.data?.shortcut === "ctrl-slash") {
      return <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
    }
    return <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
  }

  const getBackgroundClass = () => {
    if (isStreamingDictationMode && isStreamingActive) {
      if (isStreamingListening) {
        return "bg-cyan-500/20 border-cyan-500/30"
      }
      return "bg-cyan-600/20 border-cyan-600/30"
    }
    if (isRecording) {
      return "bg-red-500/20 border-red-500/30"
    } else if (isVoiceActivationMode && isVoiceListening) {
      return "bg-green-500/20 border-green-500/30"
    } else if (isVoiceActivationMode) {
      return "bg-blue-500/20 border-blue-500/30"
    }
    return "bg-black/30 border-white/10"
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${seconds}s`
  }

  const handleVoiceMenuAction = async (action: string) => {
    setShowContextMenu(false)

    switch (action) {
      case 'start-voice':
        await tipcClient.startVoiceActivation()
        break
      case 'stop-voice':
        await tipcClient.stopVoiceActivation()
        break
      case 'toggle-voice':
        if (isVoiceListening) {
          await tipcClient.stopVoiceActivation()
        } else {
          await tipcClient.startVoiceActivation()
        }
        break
      case 'start-streaming':
        await tipcClient.startStreamingDictation()
        break
      case 'stop-streaming':
        await tipcClient.stopStreamingDictation()
        break
      case 'toggle-streaming':
        if (isStreamingActive) {
          await tipcClient.stopStreamingDictation()
        } else {
          await tipcClient.startStreamingDictation()
        }
        break
      case 'pause-streaming':
        await tipcClient.pauseStreamingDictation()
        break
      case 'resume-streaming':
        await tipcClient.resumeStreamingDictation()
        break
      case 'record':
        handleActivate()
        break
      case 'settings':
        // This could open a settings dialog or send to main window
        console.log('Open settings')
        break
    }
  }

  // Fixed compact status bar - 160x16px with integrated voice menu
  return (
    <div className="relative h-full w-full">
      {/* Main compact status bar */}
      <div
        className={`flex items-center h-full w-full backdrop-blur-sm transition-all duration-200 border ${getBackgroundClass()} cursor-pointer rounded-lg`}
        onClick={handleActivate}
        onContextMenu={handleRightClick}
      >
        <div className="flex items-center gap-1 px-1.5 py-0.5 w-full">
          {/* Status indicator dot */}
          {getCompactStatusIndicator()}

          {/* Compact status text (max 3-4 chars) */}
          <span className="text-[10px] text-white/90 font-medium select-none truncate flex-shrink-0">
            {getCompactStatusText()}
          </span>

          {/* Recording timer (only during recording) */}
          {isRecording && recordingDuration > 0 && (
            <span className="text-[9px] text-red-300 animate-pulse font-mono flex-shrink-0">
              {Math.floor(recordingDuration / 1000)}s
            </span>
          )}

          {/* Streaming dictation word count */}
          {isStreamingDictationMode && isStreamingActive && streamingWordsSpoken > 0 && (
            <span className="text-[9px] text-cyan-300 font-mono flex-shrink-0">
              {streamingWordsSpoken}w
            </span>
          )}

          {/* Ultra compact 3-bar level meter for voice activation and streaming */}
          {((isVoiceActivationMode && isVoiceListening) || (isStreamingDictationMode && isStreamingListening)) && audioLevel > 0 && !recording && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-0.5 h-1 rounded-full transition-all duration-75 ${
                    audioLevel * 3 > i
                      ? isStreamingDictationMode
                        ? "bg-cyan-300"
                        : "bg-green-300"
                      : "bg-gray-600"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Ultra compact visualizer during recording (4 bars max) */}
          {recording && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {visualizerData.map((rms, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-0.5 rounded-full transition-all duration-100",
                    "bg-gradient-to-t from-green-400 to-blue-400",
                    rms === -1000 && "bg-gray-600",
                  )}
                  style={{
                    height: `${Math.min(6, Math.max(1, Math.abs(rms) * 8))}px`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Processing spinner */}
          {transcribeMutation.isPending && (
            <Spinner className="w-2 h-2 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Integrated voice menu context */}
      {showContextMenu && (
        <div className="absolute top-full left-0 mt-1 bg-black/90 backdrop-blur-sm border border-white/20 rounded-md shadow-lg z-50 min-w-32">
          <div className="py-1">
            {isStreamingDictationMode && (
              <>
                <button
                  className="w-full px-3 py-1 text-xs text-white/80 hover:bg-white/10 text-left"
                  onClick={() => handleVoiceMenuAction('toggle-streaming')}
                >
                  {isStreamingActive ? '⏸ Stop Streaming' : '🗣 Start Streaming'}
                </button>
                {isStreamingActive && (
                  <button
                    className="w-full px-3 py-1 text-xs text-white/80 hover:bg-white/10 text-left"
                    onClick={() => handleVoiceMenuAction(isStreamingListening ? 'pause-streaming' : 'resume-streaming')}
                  >
                    {isStreamingListening ? '⏸ Pause' : '▶ Resume'}
                  </button>
                )}
                <div className="border-t border-white/10 my-1"></div>
              </>
            )}
            {isVoiceActivationMode && (
              <>
                <button
                  className="w-full px-3 py-1 text-xs text-white/80 hover:bg-white/10 text-left"
                  onClick={() => handleVoiceMenuAction('toggle-voice')}
                >
                  {isVoiceListening ? '⏸ Stop Voice' : '🎤 Start Voice'}
                </button>
                <div className="border-t border-white/10 my-1"></div>
              </>
            )}
            {!isStreamingDictationMode && (
              <button
                className="w-full px-3 py-1 text-xs text-white/80 hover:bg-white/10 text-left"
                onClick={() => handleVoiceMenuAction('record')}
              >
                {recording ? '⏹ Stop Record' : '🔴 Record'}
              </button>
            )}
            <button
              className="w-full px-3 py-1 text-xs text-white/80 hover:bg-white/10 text-left"
              onClick={() => handleVoiceMenuAction('settings')}
            >
              ⚙️ Settings
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
