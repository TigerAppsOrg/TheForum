/**
 * Generates unique geometric cover art for events that don't have a flyer.
 * Each category gets a distinct color palette and shape composition.
 * A seed derived from the event title ensures the same event always gets the same art.
 */

interface EventCoverArtProps {
  title: string;
  tags: string[];
  className?: string;
}

/* ── Color palettes per category ── */
const PALETTES: Record<string, { bg: string; shapes: string[] }> = {
  "free food": {
    bg: "#FFF0EB",
    shapes: ["#FF7151", "#FFB199", "#FEE882", "#FFD3EA"],
  },
  career: {
    bg: "#EBF8F1",
    shapes: ["#34d399", "#A2EFF0", "#0A9CD5", "#FEE882"],
  },
  tech: {
    bg: "#F0EDFF",
    shapes: ["#a78bfa", "#0A9CD5", "#A2EFF0", "#FFD3EA"],
  },
  music: {
    bg: "#FFFBEB",
    shapes: ["#FEE882", "#FF7700", "#FFD3EA", "#A2EFF0"],
  },
  "visual arts": {
    bg: "#FFF5EB",
    shapes: ["#FF7700", "#FFD3EA", "#A2EFF0", "#FEE882"],
  },
  "social event": {
    bg: "#FFF0F6",
    shapes: ["#FFD3EA", "#FF7151", "#A2EFF0", "#FEE882"],
  },
  athletics: {
    bg: "#EBF5FF",
    shapes: ["#60a5fa", "#A2EFF0", "#FEE882", "#FFD3EA"],
  },
  academics: {
    bg: "#EBF8FC",
    shapes: ["#0A9CD5", "#A2EFF0", "#FEE882", "#FFD3EA"],
  },
  culture: {
    bg: "#FFF8EB",
    shapes: ["#f59e0b", "#FF7700", "#FFD3EA", "#A2EFF0"],
  },
  "performing arts": {
    bg: "#FFF0F6",
    shapes: ["#f472b6", "#FFD3EA", "#FEE882", "#A2EFF0"],
  },
  research: {
    bg: "#EBFAF8",
    shapes: ["#14b8a6", "#A2EFF0", "#FEE882", "#FFD3EA"],
  },
  gaming: {
    bg: "#F0EDFF",
    shapes: ["#8b5cf6", "#A2EFF0", "#FEE882", "#FF7151"],
  },
  outdoors: {
    bg: "#EBF8F1",
    shapes: ["#22c55e", "#FEE882", "#A2EFF0", "#FFD3EA"],
  },
  sustainability: {
    bg: "#EBF8F1",
    shapes: ["#15803d", "#A2EFF0", "#FEE882", "#FFD3EA"],
  },
  wellness: {
    bg: "#FFF8EB",
    shapes: ["#f59e0b", "#FFD3EA", "#A2EFF0", "#FEE882"],
  },
  entrepreneurship: {
    bg: "#FDF4FF",
    shapes: ["#c026d3", "#FFD3EA", "#A2EFF0", "#FEE882"],
  },
  literature: {
    bg: "#FFFBEB",
    shapes: ["#92400e", "#FEE882", "#FFD3EA", "#A2EFF0"],
  },
  stem: {
    bg: "#ECFEFF",
    shapes: ["#155e75", "#A2EFF0", "#FEE882", "#FFD3EA"],
  },
  "speaker event": {
    bg: "#ECFEFF",
    shapes: ["#0891b2", "#A2EFF0", "#FEE882", "#FFD3EA"],
  },
  "community service": {
    bg: "#EBFAF8",
    shapes: ["#0d9488", "#FEE882", "#A2EFF0", "#FFD3EA"],
  },
  default: {
    bg: "#F0F8FF",
    shapes: ["#A2EFF0", "#FFD3EA", "#FEE882", "#FF7151"],
  },
};

/* ── Simple hash from string → stable number ── */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/* ── Seeded pseudo-random (deterministic per title) ── */
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function EventCoverArt({ title, tags, className = "" }: EventCoverArtProps) {
  const category = tags[0]?.toLowerCase() ?? "default";
  const palette = PALETTES[category] ?? PALETTES.default;
  const seed = hash(title);

  /* Generate shape parameters from seed — use integer hash to avoid floating-point hydration mismatch */
  const r = (i: number) => {
    // Pure integer PRNG — no Math.sin, no floats
    let h = (seed + i * 2654435761) | 0;
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (h >> 16) ^ h;
    return (Math.abs(h) % 1000) / 1000;
  };

  /* Pick a layout variant (0-3) */
  const variant = seed % 4;

  return (
    <svg
      viewBox="0 0 280 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background */}
      <rect width="280" height="300" rx="14" fill={palette.bg} />

      {variant === 0 && (
        <>
          {/* Large circle */}
          <circle
            cx={80 + r(0) * 60}
            cy={80 + r(1) * 40}
            r={60 + r(2) * 30}
            fill={palette.shapes[0]}
            opacity={0.6}
          />
          {/* Triangle */}
          <polygon
            points={`${160 + r(3) * 40},${40 + r(4) * 20} ${220 + r(5) * 40},${180 + r(6) * 40} ${100 + r(7) * 30},${160 + r(8) * 40}`}
            fill={palette.shapes[1]}
            opacity={0.4}
          />
          {/* Small circle */}
          <circle
            cx={200 + r(9) * 50}
            cy={220 + r(10) * 40}
            r={25 + r(11) * 20}
            fill={palette.shapes[2]}
            opacity={0.5}
          />
          {/* Rectangle */}
          <rect
            x={20 + r(12) * 30}
            y={200 + r(13) * 40}
            width={60 + r(14) * 40}
            height={30 + r(15) * 20}
            rx="8"
            fill={palette.shapes[3]}
            opacity={0.35}
            transform={`rotate(${-15 + r(16) * 30}, ${50 + r(12) * 30}, ${215 + r(13) * 40})`}
          />
        </>
      )}

      {variant === 1 && (
        <>
          {/* Overlapping circles */}
          <circle cx={100} cy={120} r={80 + r(0) * 20} fill={palette.shapes[0]} opacity={0.45} />
          <circle
            cx={170 + r(1) * 20}
            cy={160 + r(2) * 20}
            r={65 + r(3) * 20}
            fill={palette.shapes[1]}
            opacity={0.4}
          />
          <circle
            cx={60 + r(4) * 30}
            cy={230}
            r={40 + r(5) * 15}
            fill={palette.shapes[2]}
            opacity={0.5}
          />
          {/* Triangle accent */}
          <polygon
            points={`${200 + r(6) * 30},${50} ${250},${130 + r(7) * 30} ${170},${110 + r(8) * 20}`}
            fill={palette.shapes[3]}
            opacity={0.35}
          />
        </>
      )}

      {variant === 2 && (
        <>
          {/* Diagonal rectangles */}
          <rect
            x={30}
            y={40}
            width={120 + r(0) * 40}
            height={40 + r(1) * 20}
            rx="10"
            fill={palette.shapes[0]}
            opacity={0.5}
            transform={`rotate(${-20 + r(2) * 15}, 90, 60)`}
          />
          <rect
            x={100}
            y={120}
            width={130 + r(3) * 30}
            height={35 + r(4) * 15}
            rx="10"
            fill={palette.shapes[1]}
            opacity={0.4}
            transform={`rotate(${10 + r(5) * 15}, 165, 137)`}
          />
          <rect
            x={20}
            y={200}
            width={100 + r(6) * 30}
            height={35 + r(7) * 15}
            rx="10"
            fill={palette.shapes[2]}
            opacity={0.45}
            transform={`rotate(${-10 + r(8) * 20}, 70, 217)`}
          />
          {/* Circle accent */}
          <circle
            cx={220 + r(9) * 20}
            cy={60 + r(10) * 30}
            r={30 + r(11) * 15}
            fill={palette.shapes[3]}
            opacity={0.4}
          />
          <circle cx={200} cy={250} r={35 + r(12) * 15} fill={palette.shapes[0]} opacity={0.3} />
        </>
      )}

      {variant === 3 && (
        <>
          {/* Big triangle */}
          <polygon
            points={`${140},${30 + r(0) * 20} ${250 + r(1) * 20},${220 + r(2) * 30} ${30 + r(3) * 20},${200 + r(4) * 30}`}
            fill={palette.shapes[0]}
            opacity={0.35}
          />
          {/* Circles */}
          <circle
            cx={80 + r(5) * 40}
            cy={80 + r(6) * 30}
            r={35 + r(7) * 20}
            fill={palette.shapes[1]}
            opacity={0.5}
          />
          <circle
            cx={200 + r(8) * 30}
            cy={100 + r(9) * 30}
            r={25 + r(10) * 15}
            fill={palette.shapes[2]}
            opacity={0.45}
          />
          {/* Small rectangles */}
          <rect
            x={160}
            y={230}
            width={70 + r(11) * 30}
            height={25 + r(12) * 15}
            rx="8"
            fill={palette.shapes[3]}
            opacity={0.4}
            transform={`rotate(${r(13) * 25}, 195, 242)`}
          />
          <rect
            x={30}
            y={240}
            width={50 + r(14) * 25}
            height={20 + r(15) * 10}
            rx="6"
            fill={palette.shapes[1]}
            opacity={0.3}
          />
        </>
      )}
    </svg>
  );
}
