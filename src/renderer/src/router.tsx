import { createBrowserRouter } from "react-router-dom"

export const router: ReturnType<typeof createBrowserRouter> =
  createBrowserRouter([
    {
      path: "/",
      lazy: () => import("./components/app-layout"),
      children: [
        {
          path: "settings",
          lazy: () => import("./pages/settings"),
          children: [
            {
              path: "",
              lazy: () => import("./pages/settings-general"),
            },
            {
              path: "profiles",
              lazy: () => import("./pages/settings-profiles"),
            },
            {
              path: "about",
              lazy: () => import("./pages/settings-about"),
            },
            {
              path: "providers",
              lazy: () => import("./pages/settings-providers"),
            },
            {
              path: "data",
              lazy: () => import("./pages/settings-data"),
            },
            {
              path: "app-rules",
              lazy: () => import("./pages/settings-app-rules"),
            },
            {
              path: "voice",
              lazy: () => import("./pages/settings-voice"),
            },
            {
              path: "context-formatting",
              lazy: () => import("./pages/settings-context-formatting"),
            },
          ],
        },
        {
          path: "",
          lazy: () => import("./pages/index"),
        },
      ],
    },
    {
      path: "/setup",
      lazy: () => import("./pages/setup"),
    },
    {
      path: "/panel",
      lazy: () => import("./pages/panel"),
    },
    {
      path: "/statusbar",
      lazy: () => import("./pages/statusbar"),
    },
  ])
