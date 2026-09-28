import { redirect } from "next/navigation";

/** `/profile` used to render a second copy of Settings. One page now. */
export default function ProfilePage() {
  redirect("/settings");
}
