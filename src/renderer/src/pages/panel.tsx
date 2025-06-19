import { Spinner } from "@renderer/components/ui/spinner"
import { Recorder } from "@renderer/lib/recorder"
import { playSound } from "@renderer/lib/sound"
import { cn } from "@renderer/lib/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { rendererHandlers, tipcClient } from "~/lib/tipc-client"

const VISUALIZER_BUFFER_LENGTH = 40

const getInitialVisualizerData = () =>
  Array<number>(VISUALIZER_BUFFER_LENGTH).fill(-1000)

export function Component() {
  const [visualizerData, setVisualizerData] = useState(() =>
    getInitialVisualizerData(),
  )
  const [recording, setRecording] = useState(false)
  const [speechText, setSpeechText] = useState("")
  const [isActivated, setIsActivated] = useState(false)
  const isConfirmedRef = useRef(false)

  // Check if voice activation is enabled
  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: () => tipcClient.getConfig(),
  })

  const isVoiceActivationMode = configQuery.data?.shortcut === "voice-activation"

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
      setSpeechText("✓ Transcript copied to clipboard")
      setTimeout(() => {
        setSpeechText("")
        setIsActivated(false)
      }, 2000)
    },
    onError(error) {
      setSpeechText("❌ Error processing speech")
      setTimeout(() => {
        setSpeechText("")
        setIsActivated(false)
      }, 2000)
      tipcClient.hidePanelWindow()
      tipcClient.displayError({
        title: error.name,
        message: error.message,
      })
    },
  })

  const recorderRef = useRef<Recorder | null>(null)

  useEffect(() => {
    if (recorderRef.current) return

    const recorder = (recorderRef.current = new Recorder())

    recorder.on("record-start", () => {
      setRecording(true)
      setIsActivated(true)
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
        setIsActivated(false)
        return
      }

      playSound("end_record")
      transcribeMutation.mutate({
        blob,
        duration,
      })
    })
  }, [])

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
        tipcClient.showPanelWindow()
        recorderRef.current?.startRecording()
      }
    })

    return unlisten
  }, [recording])

  const handleActivate = () => {
    if (!isActivated && !recording) {
      tipcClient.showPanelWindow()
      recorderRef.current?.startRecording()
    } else if (recording) {
      isConfirmedRef.current = true
      recorderRef.current?.stopRecording()
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* Futuristic container with gradient background and glow effects */}
      <div className="relative w-full h-full">
        {/* Background with animated gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-blue-900/90 to-purple-900/95 backdrop-blur-md rounded-2xl border border-cyan-400/30 shadow-2xl">
          {/* Animated glow border */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-purple-500/20 blur-sm animate-pulse"></div>
          {/* Inner border glow */}
          <div className="absolute inset-0.5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-blue-900/85 to-purple-900/90 backdrop-blur-lg"></div>
        </div>

        {/* Content overlay */}
        <div className="relative z-10 flex w-full h-full flex-col items-center justify-center gap-2 p-4 text-white">
          {/* Status Section */}
          <div className="flex items-center gap-3">
            {!isActivated && !recording && !transcribeMutation.isPending && (
              <>
                <button
                  className="group relative overflow-hidden rounded-xl px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 text-white hover:from-cyan-400/30 hover:to-blue-500/30 hover:border-cyan-300/60 transition-all duration-300 backdrop-blur-sm shadow-lg hover:shadow-cyan-400/25"
                  onClick={handleActivate}
                >
                  {/* Button glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-cyan-400/20 to-cyan-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center gap-2 text-sm font-medium">
                    <span className="i-mingcute-mic-line text-cyan-300"></span>
                    {isVoiceActivationMode ? "Voice Mode" : "Record"}
                  </div>
                </button>
                {!isVoiceActivationMode && (
                  <span className="text-xs text-cyan-200/70 font-light">
                    {configQuery.data?.shortcut === "ctrl-slash" ? "Ctrl+/" : "Ctrl"} shortcut
                  </span>
                )}
              </>
            )}

            {recording && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-500/30 to-orange-500/30 rounded-xl border border-red-400/50 backdrop-blur-sm">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-lg shadow-red-400/50"></div>
                  <span className="font-medium text-sm text-red-100">Recording</span>
                </div>
                {!isVoiceActivationMode && (
                  <button
                    className="px-3 py-1.5 bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-400/40 text-white hover:from-red-500/30 hover:to-orange-500/30 hover:border-red-300/60 transition-all duration-300 rounded-xl backdrop-blur-sm text-sm font-medium"
                    onClick={handleActivate}
                  >
                    <span className="i-mingcute-stop-fill text-red-300 mr-1"></span>
                    Stop
                  </button>
                )}
              </div>
            )}

            {transcribeMutation.isPending && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500/30 to-blue-500/30 rounded-xl border border-purple-400/50 backdrop-blur-sm">
                <Spinner className="w-3 h-3" />
                <span className="font-medium text-sm text-purple-100">Processing</span>
              </div>
            )}
          </div>

          {/* Speech Text Display */}
          {speechText && (
            <div className="w-full text-center">
              <div className="bg-gradient-to-r from-white/10 via-cyan-500/10 to-white/10 rounded-xl px-3 py-2 backdrop-blur-sm border border-cyan-400/30 shadow-lg">
                <p className="text-xs font-medium break-words text-cyan-100">
                  {speechText}
                </p>
              </div>
            </div>
          )}

          {/* Enhanced Audio Visualizer */}
          {recording && (
            <div className="flex items-center justify-center gap-0.5 h-6">
              {visualizerData
                .slice()
                .map((rms, index) => {
                  return (
                    <div
                      key={index}
                      className={cn(
                        "w-0.5 rounded-full transition-all duration-100 shadow-sm",
                        "bg-gradient-to-t from-cyan-400 via-blue-400 to-purple-400",
                        rms === -1000 && "bg-white/20",
                      )}
                      style={{
                        height: `${Math.min(80, Math.max(4, rms * 80))}%`,
                        boxShadow: rms !== -1000 ? '0 0 4px rgba(34, 211, 238, 0.6)' : 'none'
                      }}
                    />
                  )
                })}
            </div>
          )}

          {/* Quick Help Text */}
          {!isActivated && !recording && !transcribeMutation.isPending && (
            <div className="text-xs text-cyan-200/60 text-center max-w-xs font-light">
              {isVoiceActivationMode
                ? "Speak naturally - auto recording"
                : "Press Ctrl or click to record"
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
