import type { Metadata } from "next";
import { getFriends } from "~/actions/friends";
import { getUserOrgs } from "~/actions/orgs";
import { getUserProfile } from "~/actions/users";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [profile, friends, managedOrgs] = await Promise.all([
    getUserProfile(),
    getFriends(),
    getUserOrgs(),
  ]);

  return <SettingsClient profile={profile} friends={friends} managedOrgs={managedOrgs} />;
}
