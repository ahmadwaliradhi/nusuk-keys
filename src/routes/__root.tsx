/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "~/components/ui/sonner";
import appCss from "~/styles.css?url";

const SITE = "https://nusuk-keys.web.id";
const DESCRIPTION =
  "Kode akses & kunci jawaban Nusuk — salin, buka, dan tandai kode yang sudah dipakai.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "robots", content: "noindex, nofollow, noarchive, nosnippet" },
      { name: "theme-color", content: "#f5f8f7", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#07130f", media: "(prefers-color-scheme: dark)" },
      { title: "Nusuk Keys" },
      { name: "description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Nusuk Keys" },
      { property: "og:title", content: "Nusuk Keys" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: SITE },
      { property: "og:locale", content: "id_ID" },
      { property: "og:image", content: `${SITE}/og.png` },
      { property: "og:image:secure_url", content: `${SITE}/og.png` },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Nusuk Keys — kode akses & kunci jawaban Nusuk" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Nusuk Keys" },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: `${SITE}/og.png` },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: () => (
    <RootDocument>
      <Outlet />
    </RootDocument>
  ),
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="id" dir="ltr" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
