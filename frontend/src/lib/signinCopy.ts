// The words /signin gained or changed when new sign-ups were switched off (app#523; R1: SIGNIN_SIGNUPS_OFF_R1_2026-10-22, hashes pinned in signin.spec.ts). When sign-ups are switched on again the paragraph goes back out and R1 re-words.
export const SIGNIN_COPY = {
  noNewAccounts: "New accounts cannot be created on this page.", // 72fb2305a8ada807
  getAccess: "To get an account, ask your administrator.", // b5cdd717fb40a941
  linkSent: "If this address has an account, a sign-in link is on its way. Open it on this device to continue.", // 03d2a0dc38199104
  linkEmptyEmail: "Enter your email first, then ask for the link.", // 211990c508c815fd
} as const;
