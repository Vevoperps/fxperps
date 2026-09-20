"use client";

/**
 * The one input on the page: an email, and a button that swallows it.
 *
 * It posts to the site's own `/api/contact` route, which is the project's rule
 * — the browser never talks to a third party directly. Until an upstream is
 * configured the route logs server-side, so this is honest: the address is
 * taken and goes somewhere, it is simply not a mailing list yet.
 *
 * The button reports its own state rather than raising a toast: on a footer,
 * an alert that covers the page to say one word is worse than the word.
 */

import { useState, type FormEvent } from "react";

import { apiFetch } from "@/lib/api-client";
import { footer } from "@/data/content";

type State = "idle" | "sending" | "done" | "failed";

export const Waitlist = () => {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "sending" || !email.trim()) return;

    setState("sending");
    try {
      await apiFetch("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "waitlist",
          email: email.trim(),
          message: "waitlist signup from the footer",
        }),
      });
      setState("done");
      setEmail("");
    } catch {
      setState("failed");
    }
  };

  const label =
    state === "done"
      ? footer.loop.done
      : state === "failed"
        ? footer.loop.failed
        : footer.loop.action;

  return (
    <form onSubmit={submit} className="flex w-full max-w-[24rem] items-stretch">
      <label htmlFor="waitlist-email" className="sr-only">
        {footer.loop.placeholder}
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (state !== "idle") setState("idle");
        }}
        placeholder={footer.loop.placeholder}
        className="h-11 min-w-0 flex-1 border border-rule-paper bg-surface-paper-2 px-3 text-sm outline-none transition-colors duration-[var(--duration-fast)] ease-entrance placeholder:text-dim-paper focus:border-accent"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="label flex h-11 items-center bg-surface-ink px-5 text-ink-on-ink transition-colors duration-[var(--duration-fast)] ease-entrance hover:bg-accent disabled:opacity-60"
      >
        {label}
      </button>
    </form>
  );
};
