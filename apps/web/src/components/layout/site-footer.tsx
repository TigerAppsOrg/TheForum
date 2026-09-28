import Link from "next/link";
import { CONTACT_EMAIL } from "~/lib/site";

/** Public-page footer: attribution plus Privacy, Terms and contact. */
export function SiteFooter() {
  return (
    <footer className="border-t border-forum-medium-gray bg-white px-6 py-5 sm:px-15">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-forum-light-gray">
          Built for Princeton students — The Forum by TigerApps
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
          <Link href="/privacy" className="text-forum-dark-gray hover:text-black">
            Privacy
          </Link>
          <Link href="/terms" className="text-forum-dark-gray hover:text-black">
            Terms
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-forum-dark-gray hover:text-black">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
