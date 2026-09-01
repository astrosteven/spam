import type { Metadata } from "next";
import "./globals.css";

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
        <div className="page-wrapper">
          {children}
        </div>
      </body>
    </html>
  );
}
