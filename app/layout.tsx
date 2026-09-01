import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "./SiteNav";

export const metadata: Metadata = {
  title: "SPAM",
  description: "SPAM — JWST medium-band catalog of the CEERS field",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="page-wrapper" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <SiteNav />
          <div style={{ flex: 1 }}>{children}</div>
          <footer style={{ borderTop: "1px solid var(--border)", padding: "1.5rem 2rem", textAlign: "center", background: "#fff" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
              SPAM — Finkelstein et al. — UT Austin
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
