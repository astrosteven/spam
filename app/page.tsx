"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The SPAM project's front page is the main SPAM website; this site is only the
// data/catalog area, so land visitors straight on the data Overview.
export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace("/data"); }, [router]);
  return (
    <main style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span className="mono" style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Loading…</span>
    </main>
  );
}
