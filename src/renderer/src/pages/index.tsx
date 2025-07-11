import { ControlGroup } from "@renderer/components/ui/control"
import { Input } from "@renderer/components/ui/input"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@renderer/components/ui/tooltip"
import { queryClient, useConfigQuery } from "@renderer/lib/query-client"
import { rendererHandlers, tipcClient } from "@renderer/lib/tipc-client"
import { cn } from "@renderer/lib/utils"
import { getHoldKeyDisplayName, HOLD_KEY_OPTIONS } from "@shared/index"
import { RecordingHistoryItem } from "@shared/types"
import { useQuery } from "@tanstack/react-query"
import dayjs from "dayjs"
import { useEffect, useMemo, useRef, useState } from "react"

export function Component() {
  const historyQuery = useQuery({
    queryKey: ["recording-history"],
    queryFn: async () => {
      return tipcClient.getRecordingHistory()
    },
  })

  const configQuery = useConfigQuery()

  const [keyword, setKeyword] = useState("")

  const today = useMemo(() => dayjs().format("MMM D, YYYY"), [])
  const yesterday = useMemo(
    () => dayjs().subtract(1, "day").format("MMM D, YYYY"),
    [],
  )

  const historyGroupsByDate = useMemo(() => {
    if (!historyQuery.data) return []

    const groups = new Map<string, RecordingHistoryItem[]>()

    for (const item of historyQuery.data) {
      if (
        keyword &&
        !item.transcript.toLowerCase().includes(keyword.toLowerCase())
      ) {
        continue
      }

      const date = dayjs(item.createdAt).format("MMM D, YYYY")

      const items = groups.get(date) || []

      items.push(item)
      groups.set(date, items)
    }

    return [...groups.entries()].map((entry) => {
      return {
        date: entry[0],
        items: entry[1],
      }
    })
  }, [historyQuery.data, keyword])

  useEffect(() => {
    return rendererHandlers.refreshRecordingHistory.listen(() => {
      queryClient.invalidateQueries({
        queryKey: ["recording-history"],
      })
    })
  }, [])

  const getShortcutDisplay = () => {
    const shortcut = configQuery.data?.shortcut
    const holdKey = configQuery.data?.holdKey || "AltLeft+Space"

    if (shortcut === "hold-key") {
      const holdKeyOption = HOLD_KEY_OPTIONS.find(opt => opt.value === holdKey)
      const displayName = holdKeyOption?.label || getHoldKeyDisplayName(holdKey)
      return {
        text: `Hold ${displayName} to record`,
        key: displayName
      }
    } else if (shortcut === "ctrl-slash") {
      return {
        text: "Press Ctrl+/ to record",
        key: "Ctrl+/"
      }
    } else if (shortcut === "voice-activation") {
      return {
        text: "Voice activation enabled - just speak to record",
        key: null
      }
    } else if (shortcut === "streaming-dictation") {
      return {
        text: "Streaming dictation - real-time speech typing",
        key: null
      }
    } else if (shortcut === "disabled") {
      return {
        text: "Recording shortcuts disabled",
        key: null
      }
    }

    // Default fallback
    return {
      text: "Hold Alt + Space to record",
      key: "Alt + Space"
    }
  }

  const shortcutInfo = getShortcutDisplay()

  return (
    <>
      <header className="app-drag-region flex h-12 shrink-0 items-center justify-between border-b px-4 text-sm">
        <span className="font-bold">History</span>

        <div className="flex">
          <Input
            wrapperClassName="dark:bg-transparent"
            endContent={
              <span className="i-mingcute-search-2-line text-muted-foreground"></span>
            }
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </header>

      {historyGroupsByDate.length === 0 ? (
        <div className="flex grow flex-col items-center justify-center gap-2 text-center font-semibold leading-none">
          <span className="mx-auto max-w-md text-2xl text-muted-foreground">
            No Recordings {keyword ? `For ${JSON.stringify(keyword)}` : ""}
          </span>
          {!keyword && (
            <span className="text-sm text-muted-foreground">
              {shortcutInfo.key ? (
                <>
                  Hold{" "}
                  <span className="inline-flex h-6 items-center rounded-lg border p-1 text-sm dark:border-neutral-700 dark:bg-neutral-800">
                    {shortcutInfo.key}
                  </span>{" "}
                  to record
                </>
              ) : (
                shortcutInfo.text
              )}
            </span>
          )}
        </div>
      ) : (
        <div className="grow overflow-auto px-8 py-8">
          <div className="grid gap-5">
            {historyGroupsByDate.map((group) => {
              return (
                <ControlGroup
                  key={group.date}
                  title={
                    group.date === today
                      ? "Today"
                      : group.date === yesterday
                        ? "Yesterday"
                        : group.date
                  }
                >
                  {group.items.map((item) => {
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-5 p-4"
                      >
                        <TooltipProvider>
                          <Tooltip delayDuration={0} disableHoverableContent>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-5 shrink-0 cursor-default items-center justify-center rounded bg-neutral-100 px-1 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                                {dayjs(item.createdAt).format("HH:mm")}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Recorded at{" "}
                              {dayjs(item.createdAt).format(
                                "ddd, MMM D, YYYY h:mm A",
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div className="grow select-text">
                          {item.isOriginalShown ? item.originalTranscript : item.transcript}
                        </div>
                        <div className="flex shrink-0 gap-2 text-sm">
                          {item.originalTranscript && (
                            <UndoButton
                              id={item.id}
                              isShowingOriginal={item.isOriginalShown || false}
                            />
                          )}

                          <PlayButton id={item.id} />

                          <DeleteButton id={item.id} />
                        </div>
                      </div>
                    )
                  })}
                </ControlGroup>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

const itemButtonVariants = ({ isDanger }: { isDanger?: boolean } = {}) =>
  cn(
    "w-6 h-6 rounded-md inline-flex items-center justify-center text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white",

    isDanger && "hover:text-red-500 dark:hover:text-red-600",
  )

const PlayButton = ({ id }: { id: string }) => {
  const [status, setStatus] = useState<null | "playing" | "paused">(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const start = () => {
    const audio = (audioRef.current = new Audio())
    audio.src = `assets://recording/${id}`
    audio.addEventListener("play", () => {
      setStatus("playing")
    })
    audio.addEventListener("ended", () => {
      setStatus(null)
    })
    audio.addEventListener("pause", () => {
      setStatus("paused")
    })

    audio.play()
  }

  const pause = () => {
    audioRef.current?.pause()
  }

  return (
    <button
      type="button"
      className={itemButtonVariants()}
      onClick={() => {
        if (status === null) {
          start()
        } else if (status === "playing") {
          pause()
        } else if (status === "paused") {
          audioRef.current?.play()
        }
      }}
    >
      <span
        className={cn(
          status === "playing"
            ? "i-mingcute-pause-fill"
            : "i-mingcute-play-fill",
        )}
      ></span>
    </button>
  )
}

const UndoButton = ({ id, isShowingOriginal }: { id: string; isShowingOriginal: boolean }) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0} disableHoverableContent>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={itemButtonVariants()}
            onClick={async () => {
              try {
                await tipcClient.toggleRecordingTranscript({ id })
                queryClient.invalidateQueries({
                  queryKey: ["recording-history"],
                })
              } catch (error) {
                console.error("Failed to toggle transcript:", error)
              }
            }}
          >
            <span
              className={isShowingOriginal ? "i-mingcute-refresh-2-line" : "i-mingcute-history-line"}
            ></span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {isShowingOriginal ? "Redo AI Edit" : "Undo AI Edit"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const DeleteButton = ({ id }: { id: string }) => {
  return (
    <button
      type="button"
      className={itemButtonVariants({ isDanger: true })}
      onClick={async () => {
        if (window.confirm("Delete this recording forever?")) {
          await tipcClient.deleteRecordingItem({ id })
          queryClient.invalidateQueries({
            queryKey: ["recording-history"],
          })
        }
      }}
    >
      <span className="i-mingcute-delete-2-fill"></span>
    </button>
  )
}
