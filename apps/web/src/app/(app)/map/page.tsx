import type { Metadata } from "next";
import { getMapEvents } from "~/actions/map";
import { MapClient } from "./map-client";

export const metadata: Metadata = { title: "Map" };

export default async function MapPage() {
  const events = await getMapEvents({ days: 14 });
  return <MapClient initialEvents={events} />;
}
