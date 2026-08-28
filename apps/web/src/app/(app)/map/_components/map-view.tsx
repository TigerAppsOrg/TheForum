"use client";

import type { Map as MapboxMap } from "mapbox-gl";
import { forwardRef, useCallback, useEffect, useRef } from "react";
import { Map as MapGL, type MapRef, Marker, NavigationControl } from "react-map-gl/mapbox";
import type { MapEvent } from "~/actions/map";
import { env } from "~/env";
import {
  CAMPUS_BOUNDS,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  PRINCETON_CENTER,
} from "../_lib/map-constants";
import { getTimeGroup } from "../_lib/map-helpers";
import { MapPin } from "./map-pin";
import { YouAreHere } from "./you-are-here";

interface MapViewProps {
  locationGroups: Map<string, MapEvent[]>;
  selectedLocation: string | null;
  onSelectLocation: (locId: string | null) => void;
  onExpandEvent: (eventId: string) => void;
  /** Open the sidebar listing every event at this location. */
  onShowLocationList: (locId: string) => void;
}

export const MapView = forwardRef<MapRef, MapViewProps>(function MapView(
  { locationGroups, selectedLocation, onSelectLocation, onExpandEvent, onShowLocationList },
  ref,
) {
  /*
   * Clicking a pin goes straight to the designed surface — no intermediate
   * popup. One event opens the full detail card; several open the right-hand
   * sidebar listing them.
   *
   * The previous mini-popup stacked a carousel's prev/next arrows on top of the
   * popup body (`absolute top-1/2` over the content), so the arrows covered the
   * event's own start time.
   */
  const handleMarkerClick = useCallback(
    (locId: string, locEvents: MapEvent[]) => {
      const first = locEvents[0];
      if (!first) return;
      onSelectLocation(locId);
      if (locEvents.length === 1) {
        onExpandEvent(first.id);
      } else {
        onShowLocationList(locId);
      }
    },
    [onSelectLocation, onExpandEvent, onShowLocationList],
  );

  const handleMapClick = useCallback(() => {
    onSelectLocation(null);
  }, [onSelectLocation]);

  /*
   * Mapbox sizes its canvas once and does not track its container, so any
   * layout change after mount — the shell switching to a flex column, the nav
   * rail animating, a window resize — leaves the canvas at its old size with
   * blank space where the map should be. Re-measure whenever the box changes.
   */
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapboxMap | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => mapInstance.current?.resize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="size-full">
      <MapGL
        ref={ref}
        onLoad={(e) => {
          mapInstance.current = e.target;
          e.target.resize();
        }}
        mapboxAccessToken={env.NEXT_PUBLIC_CAMPUS_MAP_TOKEN}
        initialViewState={{
          longitude: PRINCETON_CENTER.lng,
          latitude: PRINCETON_CENTER.lat,
          zoom: DEFAULT_ZOOM,
          pitch: 0,
          bearing: 0,
        }}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxBounds={CAMPUS_BOUNDS}
        mapStyle={env.NEXT_PUBLIC_CAMPUS_MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        reuseMaps
        onClick={handleMapClick}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <YouAreHere />

        {Array.from(locationGroups.entries()).map(([locId, locEvents]) => {
          const first = locEvents[0];
          if (!first) return null;
          const isNow = getTimeGroup(first.rawDatetime) === "now";
          const isSelected = selectedLocation === locId;

          return (
            <Marker
              key={locId}
              longitude={first.longitude}
              latitude={first.latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleMarkerClick(locId, locEvents);
              }}
            >
              <MapPin
                isNow={isNow}
                count={locEvents.length > 1 ? locEvents.length : undefined}
                isSelected={isSelected}
              />
            </Marker>
          );
        })}
      </MapGL>
    </div>
  );
});
