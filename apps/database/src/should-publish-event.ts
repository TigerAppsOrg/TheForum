import type { EngineEvent } from "../../../packages/inbox-engine/src/client/index.ts";

/** Apply publication gates and the recurring-series window to an engine event. */
export function shouldPublishEvent(
  e: EngineEvent,
  seriesRank: ReadonlyMap<string, number>,
  publishLocationless: boolean,
  now = Date.now(),
): boolean {
  const admitsLocationless =
    publishLocationless &&
    e.status === "active" &&
    !e.publishable &&
    e.timePrecision === "exact" &&
    (e.confidence ?? 0) >= 0.7 &&
    !e.location.text &&
    !e.location.online;
  if (e.status !== "active" || (!e.publishable && !admitsLocationless)) return false;
  if (new Date(e.endsAt ?? e.startsAt).getTime() <= now - 6 * 3600_000) return false;
  if (e.series && e.series.size > 2) return (seriesRank.get(e.id) ?? Number.POSITIVE_INFINITY) < 2;
  return true;
}
