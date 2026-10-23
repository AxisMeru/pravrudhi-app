"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn as supabaseSignIn, currentSession, sendMagicLink, completeMagicLink } from "@/lib/auth";
import { SIGNIN_COPY } from "@/lib/signinCopy";
import { requestPasswordReset } from "@/lib/password";
import { PASSWORD_COPY } from "@/lib/passwordCopy";
import { PasswordForm } from "@/components/PasswordForm";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [choosePassword, setChoosePassword] = useState(false); // an invitation or recovery link has set the session: ask for a password (app d65)

  useEffect(() => {
    // A magic link lands here with the session in the URL fragment; finish it, then go home. Otherwise, an
    // existing session goes home at once.
    let off = false;
    completeMagicLink().then((result) => {
      if (off) return;
      if (result?.ok && (result.kind === "invite" || result.kind === "recovery")) setChoosePassword(true);
      else if (result?.ok || currentSession()) router.push("/");
      else if (result && !result.ok) setError(result.error);
    });
    return () => { off = true; };
  }, [router]);

  async function handleMagicLink() {
    if (!email) { setError(SIGNIN_COPY.linkEmptyEmail); return; }
    setError(null);
    setConfirmationMessage(null);
    setIsLoading(true);
    const result = await sendMagicLink(email);
    if (result.ok) setConfirmationMessage(SIGNIN_COPY.linkSent); // the same line for every address (R1, #523): it never says whether the address has an account
    else setError(result.error);
    setIsLoading(false);
  }

  async function handleForgot() {
    if (!/^\S+@\S+$/.test(email.trim())) { setError(PASSWORD_COPY.forgotEmptyEmail); return; } // empty or not an address: asked for before anything is sent
    setError(null);
    setConfirmationMessage(null);
    setIsLoading(true);
    const result = await requestPasswordReset(email.trim());
    if (result.ok) setConfirmationMessage(PASSWORD_COPY.forgotSent); // the same line for every address: it never says whether the address has an account
    else setError(PASSWORD_COPY.forgotFailed);
    setIsLoading(false);
  }

  const isConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmationMessage(null);
    setIsLoading(true);

    const result = await supabaseSignIn(email, password);
    if (result.ok) {
      router.push("/");
    } else {
      setError(result.error || "Sign in failed");
    }

    setIsLoading(false);
  }

  if (!isConfigured) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="mx-auto w-full max-w-sm space-y-6 px-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-[var(--color-text)]">Sign in</h1>
            <p className="text-sm text-[var(--color-text-dim)]">
              Sign-in is not configured for this installation.
            </p>
          </div>
          <div className="space-y-4">
            <Link
              href="/"
              className="block rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-center text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (choosePassword) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="mx-auto w-full max-w-sm space-y-6 px-4" data-testid="set-password">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-[var(--color-text)]">{PASSWORD_COPY.setHeading}</h1>
            <p className="text-sm text-[var(--color-text-dim)]">{PASSWORD_COPY.setIntro}</p>
          </div>
          <PasswordForm mode="set" onDone={() => router.push("/")} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="mx-auto w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Sign in</h1>
          <p className="text-sm text-[var(--color-text-dim)]">Enter your email and password to continue.</p>
        </div>

        {error && (
          <div className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {confirmationMessage && (
          <div className="rounded-md border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-3 text-sm text-[var(--color-info)]">
            {confirmationMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-dim)] focus:border-[var(--color-text)] focus:outline-none"
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-dim)] focus:border-[var(--color-text)] focus:outline-none"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-text px-4 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleMagicLink}
          disabled={isLoading}
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
        >
          Email me a sign-in link instead
        </button>

        <button
          type="button"
          onClick={handleForgot}
          disabled={isLoading}
          className="inline-flex min-h-6 w-full items-center justify-center text-sm text-[var(--color-text-dim)] underline hover:text-[var(--color-text)] disabled:opacity-50"
          data-testid="forgot-password"
        >
          {PASSWORD_COPY.forgotLink}
        </button>

        <div className="space-y-3">
          <p className="text-center text-sm text-[var(--color-text-dim)]" data-testid="signin-no-new-accounts">{SIGNIN_COPY.noNewAccounts} {SIGNIN_COPY.getAccess}</p>

          <div className="text-center text-sm text-[var(--color-text-dim)]">
            <Link href="/" className="inline-flex min-h-6 items-center hover:text-[var(--color-text)]">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
