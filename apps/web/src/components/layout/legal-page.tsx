import Link from "next/link";
import type * as React from "react";
import { SiteFooter } from "~/components/layout/site-footer";

/**
 * Shell for the public Privacy and Terms pages: the landing page's wordmark
 * header, a readable single column, and the shared footer. No session needed.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-forum-yellow-10 font-dm-sans">
      <header className="border-b border-forum-medium-gray bg-white/75 px-5 backdrop-blur-sm sm:px-15">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex flex-col">
            <span className="font-serif text-[28px] italic leading-tight tracking-tight text-black">
              The Forum
            </span>
            <span className="-mt-1 self-end text-[9px] text-forum-light-gray">by TigerApps</span>
          </Link>
          <nav aria-label="Legal" className="flex gap-5 text-[13px] font-semibold">
            <Link href="/privacy" className="text-forum-dark-gray hover:text-black">
              Privacy
            </Link>
            <Link href="/terms" className="text-forum-dark-gray hover:text-black">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-5 py-12 sm:px-15 sm:py-16">
        <article className="mx-auto max-w-2xl">
          <p className="mb-4 flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.22em] text-black">
            <span className="inline-block h-0.5 w-10 bg-black" />
            Last updated {updated}
          </p>
          <h1 className="font-serif text-[40px] font-semibold leading-tight text-black sm:text-[52px]">
            {title}
          </h1>
          <div className="mt-5 text-[17px] leading-relaxed text-forum-dark-gray">{intro}</div>
          <div className="mt-10 flex flex-col gap-9">{children}</div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-serif text-[22px] font-bold text-black">
        <span aria-hidden className="size-[11px] shrink-0 rounded-full bg-forum-coral" />
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-forum-dark-gray [&_a]:font-medium [&_a]:text-forum-cerulean [&_a:hover]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-black [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  );
}
