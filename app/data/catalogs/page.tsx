"use client";
import { Fragment } from "react";

const VERSION = "0.98";
const BASE_URL = "https://web.corral.tacc.utexas.edu/unicorn/spam";  // public Corral HTTPS root (catalog data)

// Photo-z variants. The FITS filename is identical in every variant dir
// (<prefix>_photz_v<ver>.fits); only the Corral SUBDIRECTORY changes.
const PZ_VARIANTS = [
  { key: "fiducial", label: "Photo-z — Fiducial",  dir: "Photoz",         desc: "Fiducial photometric redshifts (LAZY, SFHZ + Larson22 templates)" },
  { key: "eelg",     label: "Photo-z — EELG",      dir: "Photoz_eelg",    desc: "Photo-z with extreme-emission-line-galaxy template set" },
  { key: "circles",  label: "Photo-z — Circles",   dir: "Photoz_Circles", desc: "Photo-z using circular-aperture photometry" },
  { key: "bbonly",   label: "Photo-z — Broadband", dir: "Photoz_BBonly",  desc: "Photo-z using broad-band filters only (medium bands excluded)" },
  { key: "wfc3",     label: "Photo-z — WFC3",      dir: "Photoz_WFC3",    desc: "Photo-z including HST WFC3 aperture photometry" },
];
const ALL_PZ = PZ_VARIANTS.map(v => v.key);
const NO_WFC3 = ALL_PZ.filter(k => k !== "wfc3");

type Field = {
  id: string;
  name: string;
  dir: string;         // Corral subdirectory
  prefix: string;      // filename prefix
  available: boolean;  // true once files are live on Corral
  variants: string[];  // PZ_VARIANTS keys present for this field
  programs?: string[]; // JWST programs whose imaging is included
};

// SPAM single-field site: data lives flat under Corral .../unicorn/spam/ (dir=""),
// filenames keep the ceers_ prefix, shown as the "SPAM" field.
const FIELDS: Field[] = [
  { id: "spam", name: "SPAM", dir: "", prefix: "ceers", available: true, variants: ALL_PZ, programs: ["CEERS", "SPAM", "MINERVA", "CAPERS"] },
];

// Real file sizes for the live v0.98 release, keyed by row key.
const CEERS_SIZES: Record<string, string> = {
  readme: "24 KB",
  photom: "2.4 GB",
  selected: "4.7 MB",
  detflags: "5.3 MB",
  selflags: "21 MB",
  segmap: "13 MB",
  psfs: "2.0 MB",
  depths: "4 KB",
  area: "4 KB",
  completeness: "32 KB",
  pz_fiducial: "2.6 GB",
  pz_eelg: "2.6 GB",
  pz_circles: "2.6 GB",
  pz_bbonly: "2.6 GB",
  pz_wfc3: "2.6 GB",
};

// Project-wide files. Templates currently live inside the CEERS-SPAM directory on
// Corral (unversioned filenames); repoint if a shared location is created later.
const PROJECT_FILES = [
  {
    label: "Tutorial Notebook",
    desc: "Jupyter notebook: reading catalogs, plotting photometry, SED reconstruction, P(z)",
    href: `/spam/unicorn_example.ipynb`,
    size: "~36 KB",
  },
  {
    label: "Templates — Fiducial",
    desc: "LAZY SED template library used for fiducial photo-z fits",
    href: `${BASE_URL}/unicorn_templates_fiducial.fits`,
    size: "1.2 GB",
  },
  {
    label: "Templates — EELG",
    desc: "LAZY SED template library for the EELG photo-z variant",
    href: `${BASE_URL}/unicorn_templates_eelg.fits`,
    size: "1.3 GB",
  },
  {
    label: "Templates — LRD",
    desc: "LAZY SED template library for the LRD photo-z variant",
    href: `${BASE_URL}/unicorn_templates_lrd.fits`,
    size: "1.4 GB",
  },
];

type FileRow = {
  label: string;
  desc: string;
  file: string;      // display filename
  href: string;      // download URL (only used when the field is available)
  size: string;
  ext?: number;      // number of FITS extensions, if applicable
};

function fieldFiles(field: Field): FileRow[] {
  const { dir, prefix: f, available } = field;
  const v = VERSION;
  const base = dir ? `${BASE_URL}/${dir}` : BASE_URL;   // dir="" -> flat under BASE_URL
  const size = (key: string) => (available ? CEERS_SIZES[key] ?? "—" : "—");

  const files: FileRow[] = [
    {
      label: "README",
      desc: "Column descriptions, data model, selection criteria, and version history",
      file: `${f}_unicorn.readme`,
      href: `${base}/${f}_unicorn.readme`,
      size: size("readme"),
    },
    {
      label: "Photometry",
      desc: "Source positions, morphology, fluxes in all filters (Kron + 12 circular apertures; ext 2 lists aperture diameters)",
      file: `${f}_photom_v${v}.fits`,
      href: `${base}/${f}_photom_v${v}.fits`,
      size: size("photom"),
      ext: 2,
    },
  ];

  for (const key of field.variants) {
    const variant = PZ_VARIANTS.find(pv => pv.key === key)!;
    files.push({
      label: variant.label,
      desc: variant.desc,
      file: `${variant.dir}/${f}_photz_v${v}.fits`,
      href: `${base}/${variant.dir}/${f}_photz_v${v}.fits`,
      size: size(`pz_${key}`),
      ext: 4,
    });
  }

  files.push(
    {
      label: "Selected Sample",
      desc: "High-confidence galaxy sample with inspection flags and redshift assignments",
      file: `${f}_selected_v${v}.fits`,
      href: `${base}/${f}_selected_v${v}.fits`,
      size: size("selected"),
      ext: 1,
    },
    {
      label: "Detection Flags",
      desc: "Per-source detection criteria (SNR, Lyman-break, error-map, edge)",
      file: `Flags/${f}_detectionflags_v${v}.fits`,
      href: `${base}/Flags/${f}_detectionflags_v${v}.fits`,
      size: size("detflags"),
      ext: 1,
    },
    {
      label: "Selection Flags",
      desc: "Per-source photo-z selection criteria (int P(z), za, chi², dchi², sample)",
      file: `Flags/${f}_selectionflags_v${v}.fits`,
      href: `${base}/Flags/${f}_selectionflags_v${v}.fits`,
      size: size("selflags"),
      ext: 1,
    },
    {
      label: "Segmentation Map",
      desc: "Source-Extractor segmentation map (gzipped FITS image)",
      file: `segmap_${f}_v${v}.fits.gz`,
      href: `${base}/segmap_${f}_v${v}.fits.gz`,
      size: size("segmap"),
    },
    {
      label: "PSFs",
      desc: "Empirical point-spread functions per filter (tar.gz)",
      file: `${f}_psfs_v${v}.tar.gz`,
      href: `${base}/${f}_psfs_v${v}.tar.gz`,
      size: size("psfs"),
    },
    {
      label: "5σ Depths",
      desc: "Per-filter 5σ point-source depths",
      file: `${f}_5sig-depths_v${v}.txt`,
      href: `${base}/${f}_5sig-depths_v${v}.txt`,
      size: size("depths"),
    },
    {
      label: "Survey Area",
      desc: "Effective survey area per filter (arcmin²)",
      file: `${f}_area.txt`,
      href: `${base}/${f}_area.txt`,
      size: size("area"),
    },
    {
      label: "Completeness",
      desc: "Point-source completeness vs. magnitude, per depth tier",
      file: `${f}_pointsource_completeness_v${v}.txt`,
      href: `${base}/${f}_pointsource_completeness_v${v}.txt`,
      size: size("completeness"),
    },
  );
  return files;
}

function DownloadButton({ href, available }: { href: string; available: boolean }) {
  if (!available) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "transparent",
          color: "var(--text-dim)",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          padding: "5px 12px",
          fontSize: "0.75rem",
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: "nowrap",
        }}
      >
        soon
      </span>
    );
  }
  return (
    <a
      href={href}
      download
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "var(--accent-dim)",
        color: "var(--accent)",
        border: "1px solid rgba(47,125,209,0.3)",
        borderRadius: "4px",
        padding: "5px 12px",
        fontSize: "0.75rem",
        fontFamily: "'JetBrains Mono', monospace",
        textDecoration: "none",
        whiteSpace: "nowrap",
        transition: "background 0.15s",
      }}
    >
      ↓ Download
    </a>
  );
}

// Templates (all PROJECT_FILES except the notebook, which is shown separately).
const NOTEBOOK = PROJECT_FILES[0];
const TEMPLATES: FileRow[] = PROJECT_FILES.slice(1).map(f => ({
  label: f.label, desc: f.desc, file: f.href.split("/").pop()!, href: f.href, size: f.size,
}));

export default function CatalogsPage() {
  const field = FIELDS[0];
  const files: FileRow[] = [...fieldFiles(field), ...TEMPLATES];

  function downloadScript() {
    const lines = [
      "#!/bin/bash",
      `# SPAM v${VERSION} catalog download script`,
      "# Preserves the Photoz*/ and Flags/ subdirectory layout.",
      "set -e", "",
    ];
    for (const f of files) lines.push(`curl -fL --create-dirs -o "${f.file}" "${f.href}"`);
    lines.push("");
    const blob = new Blob([lines.join("\n")], { type: "text/x-shellscript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `download_spam_v${VERSION}.sh`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <main style={{ padding: "3rem clamp(1.25rem, 4vw, 2rem)", maxWidth: "960px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 className="page-title" style={{ fontSize: "2rem", color: "var(--text)", marginBottom: "6px" }}>
          Download
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", maxWidth: "640px" }}>
          All SPAM data products are FITS binary tables with embedded column descriptions
          and units. Version <span className="mono" style={{ color: "var(--accent)" }}>{VERSION}</span>.
          See the README for full documentation.
        </p>
      </div>

      {/* Citation notice */}
      <div className="card" style={{
        padding: "1rem 1.25rem", marginBottom: "2rem",
        borderLeft: "3px solid var(--accent)", background: "var(--accent-dim)",
        fontSize: "0.85rem", color: "var(--text-muted)",
      }}>
        <span style={{ color: "var(--accent)", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem" }}>CITATION</span>
        <span style={{ marginLeft: "12px" }}>
          If you use SPAM data products, please cite{" "}
          <span style={{ color: "var(--text)" }}>Larson &amp; Davis et al. 2026</span>.
        </span>
      </div>

      {/* Notebook + download-script row */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "2rem" }}>
        <a href={NOTEBOOK.href} download className="btn btn-ghost" style={{ padding: "10px 18px", fontSize: "0.8rem" }}>
          ↓ Tutorial notebook
        </a>
        <button onClick={downloadScript} className="btn btn-primary" style={{ padding: "10px 18px", fontSize: "0.8rem" }}>
          ↓ Download script (all files)
        </button>
      </div>

      {/* Programs included */}
      {field.programs && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "1.25rem" }}>
          <span className="mono" style={{ fontSize: "0.68rem", color: "var(--text-dim)", letterSpacing: "0.1em" }}>PROGRAMS INCLUDED</span>
          {field.programs.map(p => (
            <span key={p} className="mono" style={{ fontSize: "0.72rem", padding: "2px 9px", borderRadius: "999px", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(47,125,209,0.25)" }}>{p}</span>
          ))}
        </div>
      )}

      {/* Combined file list */}
      <div className="card" style={{ overflow: "hidden" }}>
        {files.map((f, idx) => (
          <div key={f.file} style={{
            padding: "0.7rem 1.25rem",
            display: "grid",
            gridTemplateColumns: "190px 1fr 80px auto",
            alignItems: "center",
            gap: "1rem",
            borderTop: idx > 0 ? "1px solid var(--border)" : "none",
            background: idx % 2 === 0 ? "transparent" : "rgba(20,22,26,0.02)",
          }}>
            <span className="mono" style={{ fontSize: "0.82rem", color: "var(--accent-bright)", fontWeight: 700 }}>{f.label}</span>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{f.desc}</div>
              <div className="mono" style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "2px" }}>
                {f.file}
                {f.ext && <span style={{ color: "var(--accent)", marginLeft: "8px" }}>{f.ext} ext</span>}
              </div>
            </div>
            <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-dim)", textAlign: "right" }}>{f.size}</span>
            <DownloadButton href={f.href} available={field.available} />
          </div>
        ))}
      </div>

      {/* FITS structure note */}
      <div className="card" style={{
        marginTop: "3rem",
        padding: "1.25rem",
        borderLeft: "3px solid var(--purple)",
        background: "rgba(47,125,209,0.05)",
      }}>
        <p className="mono" style={{ fontSize: "0.75rem", color: "var(--accent)", marginBottom: "8px", letterSpacing: "0.08em" }}>
          PHOTO-Z FILE STRUCTURE
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "4px 16px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
          {[
            ["Ext 1", "Single-value quantities: ZA, ZM, confidence intervals, integrated P(z), COEFFS"],
            ["Ext 2", "Best-fit model fluxes per filter (nJy) from Lazy.jl at z_a"],
            ["Ext 3", "Full P(z): ZGRID (1751 pts), PZ, CHI2"],
            ["Ext 4", "Low-z P(z): ZGRID_LOWZ (351 pts, z<7), PZ_LOWZ"],
          ].map(([ext, desc]) => (
            <Fragment key={ext}>
              <span className="mono" style={{ color: "var(--accent)", fontWeight: 700 }}>{ext}</span>
              <span>{desc}</span>
            </Fragment>
          ))}
        </div>
      </div>

    </main>
  );
}
