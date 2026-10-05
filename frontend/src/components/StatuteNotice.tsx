import { STATUTE_NOTICE } from "@/lib/statuteNotice";

// Shown with every block of statute text, and as the footer line on pages whose element analysis paraphrases or
// quotes a provision. Statute text is never rendered without it (see lib/statuteNotice.ts).
export function StatuteNotice({ href, className = "" }: { href?: string; className?: string }) {
  return (
    <p className={`text-xs text-[var(--color-text-dim)] ${className}`} data-testid="statute-notice">
      {STATUTE_NOTICE}
      {href && (
        <>
          {" "}
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
            Source on India Code
          </a>
        </>
      )}
    </p>
  );
}
