/**
 * The name a greeting addresses someone by: the first word of their display
 * name — or nothing, when there is no real name yet. New accounts start with
 * their NetID as the display name, and "Hello ia1234," reads like a bug, so a
 * display name equal to the NetID counts as no name. Callers then render
 * "Hello," with no name rather than a placeholder.
 */
export function greetingName(
  displayName: string | null | undefined,
  netId: string | null | undefined,
): string | null {
  const name = displayName?.trim() ?? "";
  if (!name) return null;
  if (netId && name.toLowerCase() === netId.trim().toLowerCase()) return null;
  return name.split(/\s+/)[0] ?? null;
}
