import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { EditionGate } from "@/components/EditionGate";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { KeyboardShortcuts } from "@/components/keyboard/KeyboardShortcuts";
import { WorkspaceBootstrap } from "@/components/WorkspaceBootstrap";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/productCopy";
import { LAYOUT_ATTRIBUTE } from "@/lib/layoutFlag";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";
import "./globals.css";

// GitHub Pages serves this app under /pravrudhi/app, and Next does not prefix an absolute icon URL with the
// base path the way it does for imported assets. Written as "/icon.svg" the browser asked the origin root for
// it and got a 404 — invisible in Chromium, which never requested it in these runs, and caught by Firefox.
// Same pattern the rest of the app already uses for base-path-relative assets (see lib/demo.ts, lib/tour.ts).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  icons: { icon: `${basePath}/icon.svg` },
  title: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-layout={LAYOUT_ATTRIBUTE}>
      <head>
        {/* Sets data-theme from the stored choice before first paint (no flash of the wrong theme). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-[var(--color-surface)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--color-text)]">Skip to main content</a>
        <ThemeSwitch />
        <div className="flex h-screen print:block print:h-auto">
          <Sidebar />
          {/* Room for the drawer toggle, which is fixed at top-left below `md` and would otherwise sit on top
              of the first line of every page. */}
          <div className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0 print:block print:pt-0">
            <div className="print:hidden">
              <ConnectionBanner />
            </div>
            <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto print:overflow-visible">
              <EditionGate>{children}</EditionGate>
            </main>
          </div>
        </div>
        {/* The palette was built and never mounted, so Ctrl+K did nothing. The parity matrix caught it by
            re-running the evidence for the claim rather than trusting the claim. */}
        <CommandPalette />
        <KeyboardShortcuts />
        <WorkspaceBootstrap />
      </body>
    </html>
  );
}
