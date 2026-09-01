"use client";
import Link from "next/link";

const VERSION = "0.98";

const FILTER_GROUPS = [
  { instr: "NIRCam", filters: ["F070W","F090W","F115W","F140M","F150W","F162M","F182M","F200W","F210M","F250M","F277W","F300M","F335M","F356W","F360M","F410M","F430M","F444W","F460M","F480M"] },
  { instr: "ACS",    filters: ["F435W","F606W","F814W"] },
  { instr: "WFC3",   filters: ["F105W","F125W","F140W","F160W"] },
];
const N_FILTERS = FILTER_GROUPS.reduce((n, g) => n + g.filters.length, 0);
const PROGRAMS = ["CEERS", "SPAM", "MINERVA", "CAPERS"];

const FIELD_META = [
  { label: "Field", value: "CEERS / EGS" },
  { label: "RA, Dec", value: "214.825°, 52.825°" },
  { label: "Area", value: "~100 arcmin²" },
  { label: "Imaging", value: "JWST NIRCam + HST ACS / WFC3" },
  { label: "Sources", value: "174,454" },
];

const CARDS = [
  { href: "/data/catalogs", color: "var(--wl-2)", title: "Download", body: "Download the photometry, photo-z variants, flags, PSFs, segmentation map, and templates." },
  { href: "/data/search",   color: "var(--wl-3)", title: "Query",    body: "Find sources by ID or position, run queries on redshift & magnitude, view bio plots, export subsets." },
];

export default function DataOverview() {
  return (
    <main style={{ padding: "3rem clamp(1.25rem, 4vw, 2rem)", maxWidth: "920px", margin: "0 auto" }}>

      <div style={{ marginBottom: "2rem" }}>
        <h1 className="page-title" style={{ fontSize: "2.2rem", color: "var(--text)", marginBottom: "12px" }}>
          Data Overview
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.98rem", maxWidth: "680px", lineHeight: 1.65 }}>
          These pages contain the photometric catalog released by the SPAM team, which includes
          multi-band photometry over the CEERS region in the EGS field. This contains primarily
          NIRCam data from the CEERS, SPAM and MINERVA teams, with additional parallel images that
          overlap, along with HST ACS and WFC3 imaging from AEGIS and CANDELS. Full details are
          available in <span style={{ color: "var(--text)", fontWeight: 500 }}>Larson &amp; Davis et al., 2026</span>.
        </p>
      </div>

      {/* Release banner */}
      <div className="card" style={{ padding: "1.5rem 1.75rem", marginBottom: "2rem", borderLeft: "4px solid var(--accent)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
          <span className="display" style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--navy)" }}>SPAM</span>
          <span className="mono" style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: "999px", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(47,125,209,0.25)" }}>v{VERSION}</span>
          <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>174,454 sources · {N_FILTERS} filters</span>
        </div>
      </div>

      {/* Section cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px", marginBottom: "2.75rem" }}>
        {CARDS.map(c => (
          <Link key={c.href} href={c.href} style={{ textDecoration: "none" }}>
            <div className="card" style={{ padding: "1.4rem 1.5rem", borderTop: `3px solid ${c.color}`, height: "100%" }}>
              <div className="display" style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>{c.title} →</div>
              <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{c.body}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Field info */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.25rem" }}>
        <div style={{ width: "28px", height: "3px", borderRadius: "2px", background: "var(--accent)" }} />
        <span className="eyebrow">The field</span>
      </div>
      <div className="card" style={{ padding: "1.5rem 1.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px 28px", fontSize: "0.9rem" }}>
          {FIELD_META.map(m => (
            <div key={m.label}>
              <div className="mono" style={{ fontSize: "0.68rem", color: "var(--text-dim)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "3px" }}>{m.label}</div>
              <div style={{ color: "var(--text)" }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Filters grouped by instrument */}
        <div style={{ marginTop: "1.5rem" }}>
          <div className="mono" style={{ fontSize: "0.68rem", color: "var(--text-dim)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>Filters ({N_FILTERS})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {FILTER_GROUPS.map(g => (
              <div key={g.instr} style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)", width: "58px", flexShrink: 0 }}>{g.instr}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {g.filters.map(f => (
                    <span key={f} className="mono" style={{ fontSize: "0.72rem", padding: "2px 9px", borderRadius: "4px", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(47,125,209,0.2)" }}>{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: "0.68rem", color: "var(--text-dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Programs included</span>
          {PROGRAMS.map(p => (
            <span key={p} className="mono" style={{ fontSize: "0.75rem", padding: "3px 11px", borderRadius: "999px", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(47,125,209,0.25)" }}>{p}</span>
          ))}
        </div>
      </div>

    </main>
  );
}
