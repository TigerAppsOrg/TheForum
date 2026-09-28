/**
 * Very soft blurred pastel blobs behind the app, per the Figma. Kept faint and
 * few (three), fixed so they don't scroll, and purely decorative — content
 * surfaces (cards, panels) stay solid white on top of them.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 right-[-10%] size-[520px] rounded-full bg-forum-pink opacity-30 blur-3xl" />
      <div className="absolute top-[45%] -left-40 size-[480px] rounded-full bg-forum-turquoise opacity-20 blur-3xl" />
      <div className="absolute right-[15%] -bottom-48 size-[440px] rounded-full bg-forum-yellow opacity-20 blur-3xl" />
    </div>
  );
}
