"use client";

/**
 * The pre-launch gate.
 *
 * A frozen frame of the entry wave with one plate on it. Nothing about the
 * site is revealed — no wordmark lockup, no copy, no nav — because the whole
 * point is that the project is not announced yet.
 *
 * On success the page is reloaded rather than client-navigated: the cookie was
 * just issued, and only a fresh request goes through the middleware again and
 * gets the real page instead of this rewrite.
 */

import { useState, type FormEvent } from "react";

import { apiFetch } from "@/lib/api-client";
import { brand } from "@/lib/brand";

import { PixelField } from "./pixel-field";

export const GateView = () => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !code.trim()) return;

    setPending(true);
    setError(null);

    try {
      await apiFetch("/api/gate", {
        method: "POST",
        body: JSON.stringify({ password: code }),
      });
      // Full reload, not `router.push` — see the note at the top of the file.
      window.location.reload();
    } catch {
      setError("Invalid access code");
      setCode("");
      setPending(false);
    }
  };

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      <PixelField />

      <div className="relative w-[min(26rem,calc(100vw-2.5rem))] border border-rule-paper bg-surface-paper">
        <header className="flex items-center justify-between border-b border-rule-paper px-5 py-3">
          <span className="label text-dim-paper">Restricted</span>
          <span className="label text-accent">{brand.version}</span>
        </header>

        <form onSubmit={submit} className="px-5 py-6">
          <label htmlFor="gate-code" className="label block text-dim-paper">
            Access code
          </label>

          <input
            id="gate-code"
            name="code"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "gate-error" : undefined}
            className="mt-3 h-11 w-full border border-rule-paper bg-surface-paper-2 px-3 font-mono text-[0.9375rem] tracking-[0.3em] text-foreground outline-none transition-colors duration-[var(--duration-fast)] ease-entrance focus:border-accent"
          />

          {/* Reserved line: the plate does not jump a row taller when the code
              is wrong, which on a centred layout shifts the whole thing. */}
          <p
            id="gate-error"
            role="status"
            className="label mt-3 h-3 text-accent"
          >
            {error}
          </p>

          <button
            type="submit"
            disabled={pending}
            className="label mt-5 flex h-11 w-full items-center justify-center gap-2 bg-surface-ink text-ink-on-ink transition-opacity duration-[var(--duration-fast)] ease-entrance hover:opacity-90 disabled:opacity-50"
          >
            <span className="size-1.5 bg-accent" aria-hidden="true" />
            {pending ? "Checking" : "Enter"}
          </button>
        </form>

        <footer className="border-t border-rule-paper px-5 py-3">
          <span className="label text-dim-paper">Launching soon</span>
        </footer>
      </div>
    </main>
  );
};
