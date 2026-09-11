"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn as supabaseSignIn, currentSession } from "@/lib/auth";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If already signed in, redirect to home
    if (currentSession()) {
      router.push("/");
    }
  }, [router]);

  const isConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
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
              className="block rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-center text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
      <div className="mx-auto w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Sign in</h1>
          <p className="text-sm text-[var(--color-text-dim)]">Enter your email and password to continue.</p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
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
            className="w-full rounded-md bg-[var(--color-text)] px-4 py-2 text-sm font-medium text-[var(--color-background)] hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="text-center text-sm text-[var(--color-text-dim)]">
          <Link href="/" className="hover:text-[var(--color-text)]">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
