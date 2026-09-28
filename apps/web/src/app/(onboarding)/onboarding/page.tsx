import type { Metadata } from "next";
import { getUserProfile } from "~/actions/users";
import { OnboardingClient } from "./onboarding-client";

export const metadata: Metadata = { title: "Welcome" };

/**
 * Identity fields are read from the database (populated at sign-in) rather
 * than the client session, so they're correct regardless of which fields the
 * login provider puts in the token.
 */
export default async function OnboardingPage() {
  const profile = await getUserProfile();

  return (
    <OnboardingClient
      displayName={profile.displayName === profile.netId ? "" : profile.displayName}
      netId={profile.netId}
      email={profile.email}
    />
  );
}
