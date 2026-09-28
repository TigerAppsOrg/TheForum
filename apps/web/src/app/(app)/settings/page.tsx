import type { Metadata } from "next";
import { getUserProfile } from "~/actions/users";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getUserProfile();
  return <SettingsClient profile={profile} />;
}
