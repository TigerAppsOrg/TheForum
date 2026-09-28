import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-forum-yellow-10 px-6 font-dm-sans">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -bottom-24 size-96 rounded-full bg-[#F4A08E] opacity-40 blur-lg" />
        <div className="absolute -right-10 -top-24 size-80 rounded-full bg-forum-pink opacity-60 blur-lg" />
        <div className="absolute right-24 -bottom-24 size-72 rounded-full bg-forum-turquoise opacity-40 blur-lg" />
      </div>

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <p className="mb-4 flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.22em] text-black">
          <span className="inline-block h-0.5 w-10 bg-black" />
          Error 404
          <span className="inline-block h-0.5 w-10 bg-black" />
        </p>
        <h1 className="font-serif text-[40px] font-semibold leading-tight text-black sm:text-[52px]">
          This page <span className="italic text-forum-coral">wandered off.</span>
        </h1>
        <p className="mt-4 text-[15px] text-forum-dark-gray">
          The event or page you&apos;re looking for doesn&apos;t exist, was removed, or isn&apos;t
          visible to you.
        </p>
        <Link href="/" className="button-white mt-8">
          Back to The Forum
        </Link>
      </div>
    </main>
  );
}
