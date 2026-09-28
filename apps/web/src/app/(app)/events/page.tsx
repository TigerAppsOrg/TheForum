import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getMyEvents } from "~/actions/events";
import { PageHeading, PageShell } from "~/components/layout/page-shell";
import { Button } from "~/components/ui/button";
import { MyEventsClient } from "./my-events-client";

export const metadata: Metadata = { title: "My Events" };

export default async function MyEventsPage() {
  const { created, rsvped, saved } = await getMyEvents();

  return (
    <PageShell>
      <PageHeading
        action={
          <Button asChild variant="cerulean" size="sm" className="sm:hidden">
            <Link href="/events/create">
              <Plus />
              New event
            </Link>
          </Button>
        }
      >
        My Events
      </PageHeading>
      <MyEventsClient created={created} rsvped={rsvped} saved={saved} />
    </PageShell>
  );
}
