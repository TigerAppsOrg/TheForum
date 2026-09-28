import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "~/components/layout/legal-page";
import { CONTACT_EMAIL } from "~/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The ground rules for using The Forum.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="September 28, 2026"
      intro={
        <p>
          The Forum is a campus events app for the Princeton community, built and run by TigerApps.
          By using it, you agree to these ground rules.
        </p>
      }
    >
      <LegalSection title="Who can use The Forum">
        <p>
          You need a Princeton NetID to sign in. Keep your account to yourself, and use The Forum in
          line with Princeton University&apos;s policies, including its rules on acceptable use of
          campus technology and on respectful conduct.
        </p>
      </LegalSection>

      <LegalSection title="Posting events and organizations">
        <ul>
          <li>
            Post real events with accurate details, and keep them up to date — edit or delete an
            event if it changes or is cancelled.
          </li>
          <li>
            Only post for an organization if you&apos;re allowed to speak for it, and only upload
            images you have the right to share.
          </li>
          <li>
            No spam, harassment, hateful or explicit content, or anything that breaks the law or
            University policy.
          </li>
        </ul>
        <p>
          You&apos;re responsible for what you post. We may remove content that breaks these rules.
        </p>
      </LegalSection>

      <LegalSection title="Events added automatically">
        <p>
          Some events are extracted automatically from public campus listserv emails and may contain
          errors. Event details come from organizers and those emails, not from TigerApps — always
          confirm important details like time, location, and registration with the organizer. If an
          event is wrong or shouldn&apos;t be listed, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="Your information">
        <p>
          How we collect and use your information is described in our{" "}
          <Link href="/privacy">Privacy page</Link>.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          The Forum is a student-built project. We work to keep it running and accurate, but it may
          sometimes be unavailable or contain mistakes, and features may change. We may suspend
          accounts that misuse the service.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          We may update these terms; when we do, we&apos;ll change the date at the top of this page.
          Questions or reports: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
