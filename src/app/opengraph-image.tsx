import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Complyze — AI Regulatory Intelligence Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#0a0e17",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "22px",
            }}
          >
            ✓
          </div>
          <span
            style={{
              fontSize: "20px",
              color: "#64748b",
              letterSpacing: "0.15em",
            }}
          >
            COMPLYZE
          </span>
        </div>

        <div
          style={{
            fontSize: "52px",
            fontWeight: 700,
            color: "#f8fafc",
            lineHeight: 1.2,
            marginBottom: "24px",
          }}
        >
          AI Regulatory Intelligence Platform
        </div>

        <div
          style={{
            display: "flex",
            gap: "20px",
            fontSize: "18px",
            color: "#94a3b8",
          }}
        >
          <span style={{ color: "#e2e8f0", fontWeight: 600 }}>42+</span>
          <span>Regulations</span>
          <span style={{ color: "#334155" }}>|</span>
          <span style={{ color: "#e2e8f0", fontWeight: 600 }}>24</span>
          <span>Jurisdictions</span>
          <span style={{ color: "#334155" }}>|</span>
          <span style={{ color: "#22c55e" }}>Open Source</span>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "40px",
            right: "80px",
            fontSize: "16px",
            color: "#3b82f6",
            letterSpacing: "0.08em",
          }}
        >
          complyze.dev
        </div>
      </div>
    ),
    { ...size }
  );
}
