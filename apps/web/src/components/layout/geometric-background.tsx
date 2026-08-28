/**
 * Decorative geometric background with blurred pastel shapes.
 * Used across all authenticated pages (explore, events, friends, profile, etc.)
 * and the onboarding flow.
 */
export function GeometricBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden opacity-80 blur-[8px]"
      aria-hidden="true"
    >
      {/* Large turquoise polygon — bottom left */}
      <div className="absolute -left-[200px] top-[60%] h-[500px] w-[500px] rotate-[40deg] rounded-[40px] bg-forum-turquoise opacity-25" />

      {/* Pink rectangles — bottom left */}
      <div className="absolute left-0 top-[75%] flex gap-[44px] opacity-25">
        <div className="h-[376px] w-[64px] rounded-[10px] bg-forum-pink" />
        <div className="h-[376px] w-[64px] rounded-[10px] bg-forum-pink" />
        <div className="h-[376px] w-[64px] rounded-[10px] bg-forum-pink" />
      </div>

      {/* Turquoise rectangle — right side */}
      <div className="absolute right-[50px] top-[80%] h-[188px] w-[201px] rounded-[10px] bg-forum-turquoise opacity-25" />

      {/* Yellow triangle — top right */}
      <div className="absolute -top-[40px] right-[15%] h-0 w-0 opacity-30 border-l-[130px] border-r-[130px] border-b-[225px] border-l-transparent border-r-transparent border-b-forum-yellow" />

      {/* Pink circle — bottom center */}
      <div className="absolute bottom-[-100px] left-[40%] h-[350px] w-[350px] rounded-full bg-forum-pink opacity-20" />

      {/* Small turquoise triangle — left of center */}
      <div className="absolute left-[10%] top-[40%] h-0 w-0 opacity-25 border-l-[80px] border-r-[80px] border-b-[140px] border-l-transparent border-r-transparent border-b-forum-turquoise" />

      {/* Yellow polygon — top left */}
      <div className="absolute -left-[50px] top-[20%] h-[180px] w-[180px] rotate-[-30deg] rounded-[20px] bg-forum-yellow opacity-20" />

      {/* Turquoise tilted rectangle — center */}
      <div className="absolute left-[35%] top-[55%] h-[120px] w-[230px] rotate-[-27deg] rounded-[10px] bg-forum-turquoise opacity-20" />

      {/* Pink triangles — top right area */}
      <div className="absolute right-[5%] top-[25%] h-0 w-0 opacity-25 border-l-[100px] border-r-[100px] border-b-[175px] border-l-transparent border-r-transparent border-b-forum-pink rotate-[15deg]" />

      {/* Small circle — top left */}
      <div className="absolute left-[30%] top-[3%] h-[140px] w-[140px] rounded-full bg-forum-turquoise opacity-15" />
    </div>
  );
}
