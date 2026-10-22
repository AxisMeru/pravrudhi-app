// Admin → Access page, minimal version (app#520; Lead-2 22 Oct: invite + resend only). DRAFT for R1: every string the page shows is here, none inline.
// No account list, no block/ban, no model-start switch, no delete; nothing here names an email or an id.
export const ACCESS_COPY = {
  heading: "Access",
  intro: "Invite a person by email. Only an administrator sees this page.",
  notAdmin: "This page is for administrators.",
  loading: "Loading…",
  inviteHeading: "Invite by email",
  inviteExplain: "A person you invite gets an account. The link in the email opens the sign-in page.",
  resendExplain: "To send an invitation again, enter the same address and choose Send again.",
  inviteLabel: "Email address",
  invitePlaceholder: "name@example.org",
  inviteButton: "Send invitation",
  resendButton: "Send again",
  invitedOk: "Invitation sent.",
  resentOk: "Invitation sent again.",
  working: "Working…",
} as const;

/** One fixed message per error code of the contract; an unknown code gets the generic one. Never an upstream message, never an input. */
export const ERROR_COPY: Readonly<Record<string, string>> = {
  unauthorized: "Your sign-in has ended. Sign in again.",
  forbidden: "You are not allowed to do this.",
  invalid_email: "Enter one valid email address.",
  rate_limited: "Too many requests. Try again later.",
  invite_rate_limited: "Email sending is limited at the moment. Try again later.",
  already_registered: "This address already has an account.",
  upstream_unavailable: "The service did not answer. Nothing was changed. Try again.",
  audit_unavailable: "Nothing was done. Try again.",
  not_configured: "This is not available.",
  invite_redirect_not_allowed: "Something went wrong. The invitation was not sent.",
};
export const ERROR_GENERIC = "Something went wrong. Nothing was done.";
