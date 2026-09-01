"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const NAV_LINKS = [
  { href: "/",         label: "Overview" },
  { href: "/catalogs", label: "Download" },
  { href: "/search",   label: "Query" },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
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
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
          <Image src="/spam/logo.png" alt="SPAM" width={30} height={30} style={{ objectFit: "contain" }} />
          <span className="display" style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "0.01em", color: "var(--navy)" }}>
            SPAM
          </span>
        </Link>
        <div style={{ display: "flex", gap: "4px" }}>
          {NAV_LINKS.map(link => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={active ? "navlink active" : "navlink"}>
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
      <a href="https://kelceydavis33.github.io/SPAM/" className="navlink">SPAM site ↗</a>
    </nav>
  );
}
