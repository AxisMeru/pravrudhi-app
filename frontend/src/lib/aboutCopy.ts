// Every word of /about and the footer (app#519). For R1 to read and hash; no contact address, no model word, no count of users or runs. "Engine: running" only when /api/health answers ok true.
export const ABOUT_COPY = {
  title: "About",
  subtitle: "Which version of the app and of the engine you are using.",
  versionsHeading: "Versions",
  appLabel: "App",
  builtLabel: "App built",
  engineLabel: "Engine",
  engineReleasedLabel: "Engine released",
  checking: "Checking…",
  engineUnavailable: "engine version unavailable right now",
  releasedUnknown: "release time not listed",
  statusRunning: "Engine: running",
  statusDown: "Engine: not answering",
  newHeading: "What's new",
  newEmpty: "No releases are listed yet.",
  reportHeading: "Report a problem",
  copyButton: "Copy details for a problem report",
  copied: "Copied.",
  copyFallbackLabel: "Select and copy this text",
  pagesHeading: "Pages",
} as const;

export const FOOTER_COPY = { app: "App", engine: "Engine", engineUnavailable: "unavailable" } as const;
