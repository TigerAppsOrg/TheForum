import { cn } from "~/lib/utils";

/** Soft brand pastels for orgs without a logo; picked deterministically by name. */
const FALLBACKS = [
  { bg: "#e6f9f9", fg: "#0a7fa8" },
  { bg: "#fff3d6", fg: "#8a5a00" },
  { bg: "#ffe9e3", fg: "#c2410c" },
  { bg: "#ffe8f3", fg: "#a3195b" },
  { bg: "#eaf4ff", fg: "#1d4ed8" },
  { bg: "#eefbea", fg: "#2f7a1f" },
];

const SKIP_WORDS = new Set(["princeton", "the", "of", "and", "for", "at", "&", "a", "university"]);

/** "Princeton Women in Business" → "WB"; "ACM" → "AC"; falls back to the first letter. */
export function orgInitials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s&]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const significant = words.filter((w) => !SKIP_WORDS.has(w.toLowerCase()));
  const pool = significant.length > 0 ? significant : words;
  if (pool.length === 0) return "?";
  if (pool.length === 1) return (pool[0] ?? "?").slice(0, 2).toUpperCase();
  return `${pool[0]?.[0] ?? ""}${pool[1]?.[0] ?? ""}`.toUpperCase();
}

function fallbackColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return FALLBACKS[Math.abs(hash) % FALLBACKS.length] ?? FALLBACKS[0];
}

/**
 * An organization's mark: its MyPrincetonU logo on white (logos are often
 * transparent PNGs or wide wordmarks, so `object-contain`), or tasteful
 * initials on a pastel tile when there's no logo.
 */
export function OrgAvatar({
  name,
  logoUrl,
  size = 40,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const radius = Math.round(size * 0.28);
  if (logoUrl) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden border border-forum-medium-gray bg-white",
          className,
        )}
        style={{ width: size, height: size, borderRadius: radius }}
      >
        <img src={logoUrl} alt="" className="size-full object-contain p-[8%]" loading="lazy" />
      </span>
    );
  }
  const color = fallbackColor(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-dm-sans font-bold tracking-tight",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: color?.bg,
        color: color?.fg,
        fontSize: Math.max(10, Math.round(size * 0.36)),
      }}
    >
      {orgInitials(name)}
    </span>
  );
}
