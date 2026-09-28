"use client";

import "./globals.css";

/**
 * Last-resort boundary for errors thrown by the root layout itself. It
 * replaces the whole document, so it renders its own <html>/<body> and keeps
 * to plain markup — the fonts and providers from the root layout aren't here.
 */
export default function GlobalError({
  reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-forum-yellow-10 px-6 text-center font-sans">
        <title>Something went wrong · The Forum</title>
        <h1 className="font-serif text-[36px] font-semibold text-black">
          Something went <span className="italic text-forum-coral">wrong.</span>
        </h1>
        <p className="max-w-sm text-[15px] text-forum-dark-gray">
          The Forum hit an unexpected error. Please try again — if it keeps happening, email
          it.admin@tigerapps.org.
        </p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={reset} className="button-coral">
            Try again
          </button>
          {/* Plain anchor on purpose — a full reload is the point here. */}
          <a href="/" className="text-[13px] font-medium text-forum-cerulean hover:underline">
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
