"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const NAV_LINKS = [
  { href: "/data",          label: "Overview" },
  { href: "/data/catalogs", label: "Catalogs" },
  { href: "/data/search",   label: "Search" },
];

export default function DataLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{
        borderBottom: "1px solid var(--border)",
        padding: "0 clamp(1.25rem, 4vw, 2.5rem)",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(239,240,242,0.8)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <Link href="/data" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
            <Image src="/spam/logo.png" alt="SPAM" width={30} height={30} style={{ objectFit: "contain" }} />
            <span className="display" style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "0.01em", color: "var(--navy)" }}>
              SPAM
            </span>
          </Link>
          <div style={{ display: "flex", gap: "4px" }}>
            {NAV_LINKS.map(link => {
              const active = pathname === link.href ||
                (link.href !== "/data" && pathname.startsWith(link.href));
              return (
                <Link key={link.href} href={link.href} className={active ? "navlink active" : "navlink"}>
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <Link href="/" className="navlink">← Home</Link>
      </nav>

      <div style={{ flex: 1 }}>{children}</div>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "1.5rem 2rem", textAlign: "center", background: "#fff" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
          SPAM — Finkelstein et al. — UT Austin
        </p>
      </footer>
    </div>
  );
}
