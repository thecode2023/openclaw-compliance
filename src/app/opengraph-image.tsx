import { ImageResponse } from "next/og";

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
          alignItems: "flex-start",
          width: 1200,
          height: 630,
          backgroundColor: "#0a0e17",
          padding: 80,
          color: "white",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, color: "#64748b", letterSpacing: 3, marginBottom: 24 }}>
          COMPLYZE
        </div>
        <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: "#f8fafc", marginBottom: 16, lineHeight: 1.2 }}>
          AI Regulatory Intelligence Platform
        </div>
        <div style={{ display: "flex", fontSize: 20, color: "#94a3b8", gap: 12 }}>
          42+ Regulations · 24 Jurisdictions · Open Source
        </div>
        <div style={{ display: "flex", position: "absolute", bottom: 40, right: 80, fontSize: 16, color: "#3b82f6" }}>
          complyze.dev
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
