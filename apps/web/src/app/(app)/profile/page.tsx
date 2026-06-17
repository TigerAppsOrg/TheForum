import { getFriends } from "~/actions/friends";
import { getUserProfile } from "~/actions/users";
import { SettingsClient } from "../settings/settings-client";

export default async function ProfilePage() {
  const [profile, friends] = await Promise.all([getUserProfile(), getFriends()]);

  return <SettingsClient profile={profile} friends={friends} />;
}
