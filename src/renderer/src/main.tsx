import { QueryClientProvider } from "@tanstack/react-query"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./css/spinner.css"
import "./css/tailwind.css"
import { queryClient } from "./lib/query-client"
import { tipcClient } from "./lib/tipc-client"

// Configure dayjs plugins
dayjs.extend(relativeTime)

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)

document.addEventListener("contextmenu", (e) => {
  e.preventDefault()

  const selectedText = window.getSelection()?.toString()

  tipcClient.showContextMenu({
    x: e.clientX,
    y: e.clientY,
    selectedText,
  })
})
