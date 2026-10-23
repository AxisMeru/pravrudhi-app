// app d65: the words of setting, changing and recovering a password. R1's exact lines (#555); each is pinned in password.spec.ts by hash. "8" is the only number. Nothing says or implies sign-ups are open.
export const PASSWORD_COPY = {
  setHeading: "Set your password",
  setIntro: "Choose a password for your account. You will use it with your email to sign in.",
  changeHeading: "Change password",
  newLabel: "New password",
  confirmLabel: "Confirm new password",
  hint: "At least 8 characters.",
  setButton: "Set password",
  changeButton: "Change password",
  busy: "Saving…",
  mismatch: "The two passwords do not match.",
  tooShort: "Use at least 8 characters.",
  same: "Choose a password you have not used before.",
  weak: "Choose a password that is harder to guess.",
  expired: "This link has expired. On the sign-in page choose \"Forgot password?\" for a new one, or ask your administrator.",
  reauth: "To change your password, sign out, sign in again, then try again.",
  failed: "Could not set the password. Try again.",
  changed: "Your password has been changed.",
  forgotLink: "Forgot password?",
  forgotSent: "If this address has an account, a link to set a new password is on its way.",
  forgotEmptyEmail: "Enter your email first, then ask for the link.",
  forgotFailed: "Could not send the link. Try again later.",
} as const;

import type { PasswordProblem, SetPasswordFailure } from "./password";

export const PROBLEM_TEXT: Record<PasswordProblem, string> = { too_short: PASSWORD_COPY.tooShort, mismatch: PASSWORD_COPY.mismatch };
export const FAILURE_TEXT: Record<SetPasswordFailure, string> = {
  session: PASSWORD_COPY.expired,
  same: PASSWORD_COPY.same,
  weak: PASSWORD_COPY.weak,
  reauth: PASSWORD_COPY.reauth,
  unavailable: PASSWORD_COPY.failed,
};
