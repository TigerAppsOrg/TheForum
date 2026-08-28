import { Plus } from "lucide-react";
import Link from "next/link";
import { getMyEvents } from "~/actions/events";
import { PageHeading, PageShell } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";
import { MyEventsClient } from "./my-events-client";

export default async function MyEventsPage() {
  const { created, rsvped, saved } = await getMyEvents();

  return (
    <PageShell>
      <PageHeading
        clearTopBar
        action={
          <Button asChild variant="cerulean" size="cta">
            <Link href="/events/create">
              <Plus />
              Create an event
            </Link>
          </Button>
        }
      >
        Events
      </PageHeading>
      <MyEventsClient created={created} rsvped={rsvped} saved={saved} />
    </PageShell>
  );
}
