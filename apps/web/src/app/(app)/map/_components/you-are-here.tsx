"use client";

import { useEffect, useState } from "react";
import { Marker } from "react-map-gl/mapbox";
import { CAMPUS_BOUNDS } from "../_lib/map-constants";

/**
 * The viewer's own position, labelled "You Are Here".
 *
 * Geolocation is requested once and failures are swallowed — the browser
 * prompt can be denied, dismissed, or unavailable over plain HTTP, and none of
 * those should surface an error on a map that works fine without it. The
 * marker is simply omitted when there is no fix, or when the fix falls outside
 * the campus bounds (so a user across the country doesn't yank the layout).
 */
export function YouAreHere() {
  const [position, setPosition] = useState<{ lng: number; lat: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const { longitude: lng, latitude: lat } = pos.coords;
        const [[west, south], [east, north]] = CAMPUS_BOUNDS;
        if (lng < west || lng > east || lat < south || lat > north) return;
        setPosition({ lng, lat });
      },
      () => {
        /* denied or unavailable — the map is still fully usable */
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  if (!position) return null;

  return (
    <Marker longitude={position.lng} latitude={position.lat} anchor="bottom">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className="size-3.5 rounded-full border-2 border-white bg-forum-cerulean shadow-md"
        />
        <span className="mt-1 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 font-dm-sans text-[10px] font-bold text-black shadow-sm backdrop-blur-sm">
          You Are Here
        </span>
      </div>
    </Marker>
  );
}
