import Link from "next/link";
import Image from "next/image";

// The SPAM catalog is a single CEERS/EGS field release with medium bands.
const STATS = [
  { label: "Field", value: "CEERS" },
  { label: "Sources", value: "174k" },
  { label: "Filters", value: "27" },
  { label: "Redshift", value: "0 – 12+" },
  { label: "Telescope", value: "JWST" },
];

const FEATURES = [
  { color: "var(--wl-2)", title: "Photometric catalog", body: "PSF-matched fluxes across all HST + JWST filters, including the SPAM medium bands." },
  { color: "var(--wl-4)", title: "Photometric redshifts", body: "LAZY photo-z with P(z), best-fit SEDs, and fiducial / EELG / circular / broadband variants." },
  { color: "var(--wl-3)", title: "Interactive search", body: "Look up sources by ID or position, run SQL-style queries, and export CSV / FITS subsets." },
  { color: "var(--wl-1)", title: "Cutout montages", body: "Per-object filter cutouts with the detection image and Kron ellipse, alongside SED + P(z)." },
];

const PROGRAMS = ["CEERS", "SPAM", "MINERVA", "CAPERS"];

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--border)",
        padding: "0 clamp(1.25rem, 4vw, 2.5rem)",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(239,240,242,0.8)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Image src="/spam/logo.png" alt="SPAM" width={30} height={30} style={{ objectFit: "contain" }} />
          <span className="display" style={{ color: "var(--navy)", fontSize: "1.25rem", fontWeight: 800, letterSpacing: "0.01em" }}>
            SPAM
          </span>
        </div>
        <Link href="/data" className="btn btn-primary" style={{ padding: "7px 18px", fontSize: "0.78rem" }}>
          Access Data →
        </Link>
      </nav>

      {/* Hero */}
      <section style={{ padding: "clamp(3rem, 8vw, 6rem) clamp(1.25rem, 4vw, 2.5rem) 4rem", maxWidth: "960px", margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(1.5rem, 4vw, 3rem)", flexWrap: "wrap", marginBottom: "1rem" }}>
          <Image src="/spam/logo.png" alt="SPAM logo" width={150} height={150} style={{ objectFit: "contain", flexShrink: 0 }} />
          <div>
            <h1 className="display" style={{
              fontSize: "clamp(3rem, 10vw, 6rem)", fontWeight: 800, lineHeight: 0.95,
              color: "var(--navy)", margin: 0,
            }}>
              SPAM
            </h1>
            <p className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)", letterSpacing: "0.06em", marginTop: "10px" }}>
              Medium-band JWST imaging of the CEERS / EGS field
            </p>
          </div>
        </div>

        <p style={{ fontSize: "1.15rem", color: "var(--text-muted)", maxWidth: "640px", lineHeight: 1.7, margin: "1.5rem 0 2.25rem" }}>
          SPAM adds deep JWST/NIRCam medium-band imaging across the CEERS field, powering a
          robust photometric catalog and photometric redshifts. This release combines imaging
          from <span style={{ color: "var(--text)", fontWeight: 500 }}>CEERS, SPAM, MINERVA</span> and{" "}
          <span style={{ color: "var(--text)", fontWeight: 500 }}>CAPERS</span> into one uniform reduction.
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/data" className="btn btn-primary" style={{ padding: "12px 28px", fontSize: "0.9rem" }}>
            Access Catalog
          </Link>
          <a href="#about" className="btn btn-ghost" style={{ padding: "12px 28px", fontSize: "0.9rem" }}>
            What&apos;s inside ↓
          </a>
        </div>
      </section>

      {/* Stats */}
      <section style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "2.25rem clamp(1.25rem, 4vw, 2.5rem)", background: "#fff" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1.5rem" }}>
          {STATS.map(s => (
            <div key={s.label}>
              <div className="display" style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1, color: "var(--accent)" }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What's inside */}
      <section id="about" style={{ padding: "clamp(3rem, 7vw, 5rem) clamp(1.25rem, 4vw, 2.5rem)", maxWidth: "960px", margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "2rem" }}>
          <div style={{ width: "28px", height: "3px", borderRadius: "2px", background: "var(--accent)" }} />
          <span className="eyebrow">What&apos;s inside</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px", marginBottom: "3rem" }}>
          {FEATURES.map(f => (
            <div key={f.title} className="card" style={{ padding: "1.4rem 1.5rem", borderTop: `3px solid ${f.color}` }}>
              <div className="display" style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>{f.title}</div>
              <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{f.body}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)", letterSpacing: "0.1em" }}>PROGRAMS INCLUDED</span>
          {PROGRAMS.map(p => (
            <span key={p} className="mono" style={{ fontSize: "0.78rem", padding: "3px 12px", borderRadius: "999px", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(47,125,209,0.25)" }}>{p}</span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: "auto", borderTop: "1px solid var(--border)", padding: "2rem", textAlign: "center", background: "#fff" }}>
        <p className="mono" style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
          Finkelstein et al. — University of Texas at Austin — Cosmic Frontier Center
        </p>
      </footer>

    </main>
  );
}
