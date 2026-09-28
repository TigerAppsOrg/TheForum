import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "The Forum — Princeton campus events, curated.";

/**
 * Social preview card, shared by opengraph-image and twitter-image. Mirrors
 * the landing hero: warm cream ground, soft brand-colour blobs, the serif
 * wordmark and the coral "curated." accent. Uses the built-in font so the
 * build never needs to fetch one.
 */
export function renderOgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#fffdf3",
        overflow: "hidden",
        fontFamily: "serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -160,
          bottom: -220,
          width: 620,
          height: 620,
          borderRadius: 9999,
          background: "#F4A08E",
          opacity: 0.45,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -80,
          top: -140,
          width: 460,
          height: 460,
          borderRadius: 9999,
          background: "#FFD3EA",
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 120,
          bottom: -160,
          width: 360,
          height: 360,
          borderRadius: 9999,
          background: "#A2EFF0",
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 420,
          top: 60,
          width: 240,
          height: 240,
          borderRadius: 9999,
          background: "#FEE882",
          opacity: 0.45,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: "#000",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ width: 80, height: 3, background: "#000" }} />
          Campus Events Platform — Princeton
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 36,
            fontSize: 104,
            fontWeight: 600,
            lineHeight: 1.05,
            color: "#000",
          }}
        >
          <span>Campus events,</span>
          <span style={{ color: "#ff7151", fontWeight: 700 }}>curated.</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            marginTop: 48,
            fontSize: 40,
            color: "#000",
          }}
        >
          The Forum
          <span style={{ fontSize: 20, color: "#585858", fontFamily: "sans-serif" }}>
            by TigerApps
          </span>
        </div>
      </div>
    </div>,
    OG_SIZE,
  );
}
