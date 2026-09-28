import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "~/components/layout/legal-page";
import { CONTACT_EMAIL } from "~/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What The Forum stores about you, why, and who can see it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="September 28, 2026"
      intro={
        <p>
          The Forum is a campus events app for Princeton, built by TigerApps. This page explains, in
          plain language, what we store about you, why, and who can see it.
        </p>
      }
    >
      <LegalSection title="Signing in">
        <p>
          You sign in with Princeton&apos;s Central Authentication Service (CAS). We never see your
          Princeton password. From your login we receive your <strong>NetID</strong>, which we use
          to identify your account, and we keep your Princeton email address and a display name with
          it. A cookie keeps you signed in.
        </p>
      </LegalSection>

      <LegalSection title="What we store">
        <ul>
          <li>
            <strong>Profile:</strong> your NetID, email, the name you choose, and — if you add them
            — a profile photo, class year, major, whether you lead a student organization, the
            topics you&apos;re interested in, and the campus areas you spend time in.
          </li>
          <li>
            <strong>Activity:</strong> events you RSVP to or save, organizations you follow or help
            run, your friends and friend requests, events and organizations you create, and your
            notifications.
          </li>
          <li>
            <strong>Interaction logs:</strong> when you view, open, RSVP to, save, share, or hide an
            event, we record that interaction (with where in the app it happened) so we can rank
            your Explore feed.
          </li>
          <li>
            <strong>Uploads:</strong> profile photos, event flyers, and organization logos you
            upload are stored with our cloud storage provider (Amazon Web Services).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>
          We use this information to run The Forum: to show you events, personalize your feed around
          your interests, friends, and campus areas, show which friends are going to an event, and
          send you in-app notifications such as friend requests and reminders for events you&apos;ve
          RSVP&apos;d to. We don&apos;t sell your information or use it for advertising.
        </p>
      </LegalSection>

      <LegalSection title="Who can see what">
        <ul>
          <li>
            Other signed-in users can find you by name or NetID and see your name, NetID, photo, and
            class year.
          </li>
          <li>
            When you RSVP to an event, your name and photo appear in that event&apos;s attendee
            list, and your friends see that you&apos;re going.
          </li>
          <li>
            Your saved events, interests, campus areas, and interaction logs are not shown to other
            users.
          </li>
          <li>
            Events you publish and organizations you create can be seen by other signed-in users.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Events from campus listservs">
        <p>
          Some events are added automatically. We read emails sent to public Princeton campus
          listservs that The Forum is subscribed to and use an automated system — including a
          third-party AI model — to pull out event details like the title, time, and location. These
          events can contain mistakes, so check important details with the organizer.
        </p>
      </LegalSection>

      <LegalSection title="Other services we rely on">
        <p>
          Maps are provided by Mapbox, which receives standard request information (such as your IP
          address) when map tiles load. Uploaded images are stored with Amazon Web Services.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You can change your profile, interests, and campus areas at any time in{" "}
          <Link href="/settings">Settings</Link>, and remove RSVPs, saves, follows, and friends in
          the app. To ask for a copy of your data or to have your account and its data deleted,
          email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          If we change how The Forum handles your information, we&apos;ll update this page and the
          date at the top. Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
