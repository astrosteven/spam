"use client";
// LIVE grayscale postage-stamp montage. Reads RAW SCI cutout pixels from the PUBLIC fitsgl fpack
// tiles (fetchFitsglStamp — same tiles as the colour cutout/map, no Worker, no static PNGs) and
// renders a labelled grid of <canvas> cells client-side. A single "hardness" slider (k) re-stretches
// every cell INSTANTLY with no refetch — the raw Float32 pixels stay in state. If the tiles can't
// be read (missing field/bands) it shows a short notice rather than a stamp PNG.
import { useEffect, useRef, useState } from "react";
import { fetchFitsglStamp, fitsglStampAvailable, type StampResult } from "@/lib/fitsglStamp";

// Display cell size (px on screen). Cutouts are ~51px @ 30 mas ≈ 1.5″; upscaled nearest-neighbor.
const CELL_PX = 96;

// Stretch "hardness" persisted across objects + sessions. Symmetric about 0 (sky-subtracted):
// [-k·noise, +k·noise], inverted so sources are dark on white.
const STRETCH_KEY = "spam_stampStretch";
const DEFAULT_K = 2.5;
const K_MIN = 1, K_MAX = 12;

function loadK(): number {
  if (typeof window === "undefined") return DEFAULT_K;
  const raw = window.localStorage.getItem(STRETCH_KEY);
  const v = raw == null ? NaN : Number(raw);
  return Number.isFinite(v) && v >= K_MIN && v <= K_MAX ? v : DEFAULT_K;
}

export function LiveStampMontage({
  field, ra, dec, bands, aperSNR,
}: { field: string; ra: number; dec: number; bands: string[];
  /** Per-band 0.2" native-aperture S/N keyed by lowercase band — shown under each cell. */
  aperSNR?: Record<string, number> }) {
  const [stamp, setStamp] = useState<StampResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [k, setK] = useState<number>(DEFAULT_K);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);

  useEffect(() => { setK(loadK()); }, []);

  useEffect(() => {
    let live = true;
    setStamp(null); setFailed(false); setProgress(null);
    if (!(bands && bands.length && fitsglStampAvailable(field) && Number.isFinite(ra) && Number.isFinite(dec))) {
      setFailed(true);
      return;
    }
    const timer = setTimeout(() => { if (live) setFailed(true); }, 20000);
    const onProg = (loaded: number, total: number) => { if (live && total) setProgress({ loaded, total }); };
    fetchFitsglStamp(field, ra, dec, bands, 25, onProg)
      .then(s => { if (live) { clearTimeout(timer); setStamp(s); } })
      .catch(() => { if (live) { clearTimeout(timer); setFailed(true); } });
    return () => { live = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, ra, dec, bands ? bands.join(",") : ""]);

  const onK = (v: number) => {
    setK(v);
    try { window.localStorage.setItem(STRETCH_KEY, String(v)); } catch { /* private mode */ }
  };

  if (failed || (stamp && stamp.bands.length === 0)) {
    return (
      <div className="mono" style={{ marginTop: "1rem", fontSize: "0.72rem", color: "var(--text-dim)" }}>
        Cutouts unavailable for this source.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", marginTop: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "6px" }}>
        <div className="mono" style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
          CUTOUTS <span style={{ color: "var(--text-dim)" }}>(SCI · sky-subtracted · dark = flux · each ≈1.5″×1.5″)</span>
        </div>
        <label className="mono" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.68rem", color: "var(--text-muted)", marginLeft: "auto" }}>
          stretch
          <input type="range" min={K_MIN} max={K_MAX} step={0.25} value={k}
            onChange={e => onK(Number(e.target.value))} style={{ width: "120px" }} />
          <span style={{ color: "var(--text-dim)", width: "2.4em", textAlign: "right" }}>{k.toFixed(2)}σ</span>
        </label>
      </div>
      {stamp == null
        ? (
          <div style={{ padding: "1rem 0" }}>
            <div className="mono" style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginBottom: "6px" }}>
              loading cutouts…{progress ? ` ${progress.loaded}/${progress.total} bands` : ""}
            </div>
            <div style={{ maxWidth: "360px", height: "7px", borderRadius: "4px", background: "var(--bg)", border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "4px",
                background: "linear-gradient(90deg, var(--accent), var(--accent2))",
                width: progress && progress.total ? `${Math.round((progress.loaded / progress.total) * 100)}%` : "30%",
                transition: "width 200ms ease",
                animation: progress ? undefined : "spamStampIndet 1.1s ease-in-out infinite alternate",
              }} />
            </div>
            <style>{"@keyframes spamStampIndet { from { margin-left: 0; width: 22%; } to { margin-left: 78%; width: 22%; } }"}</style>
          </div>
        )
        : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {stamp.bands.map(b => (
                <StampCell key={b.band} band={b.band} w={b.w} h={b.h} noise={b.noise} pixels={b.pixels} k={k}
                  snr={aperSNR?.[b.band.toLowerCase()]} />
              ))}
            </div>
            {stamp.errors && stamp.errors.length > 0 && (
              <div className="mono" style={{ fontSize: "0.64rem", color: "var(--secondary)", marginTop: "8px" }}
                title={stamp.errors.map(e => `${e.band}: ${e.error}`).join("\n")}>
                {stamp.errors.length} band{stamp.errors.length === 1 ? "" : "s"} unavailable: {stamp.errors.map(e => e.band).join(", ")}
              </div>
            )}
          </>
        )}
    </div>
  );
}

// One band's cell: label above a <canvas> holding the grayscale-stretched cutout.
function StampCell({
  band, w, h, noise, pixels, k, snr,
}: { band: string; w: number; h: number; noise: number; pixels: Float32Array; k: number; snr?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const lo = -k * noise;
    const span = 2 * k * noise || 1;

    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < pixels.length; i++) {
      const v = pixels[i];
      let g: number;
      if (Number.isNaN(v)) {
        g = 255;
      } else {
        let t = (v - lo) / span;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        g = Math.round((1 - t) * 255);
      }
      const o = i * 4;
      d[o] = g; d[o + 1] = g; d[o + 2] = g; d[o + 3] = 255;
    }

    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    off.getContext("2d")!.putImageData(img, 0, 0);

    canvas.width = CELL_PX; canvas.height = CELL_PX;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CELL_PX, CELL_PX);
    ctx.drawImage(off, 0, 0, w, h, 0, 0, CELL_PX, CELL_PX);
  }, [w, h, noise, pixels, k]);

  return (
    <div style={{ textAlign: "center" }}>
      <div className="mono" style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginBottom: "2px", whiteSpace: "nowrap" }}>{band}</div>
      <canvas
        ref={canvasRef}
        style={{ width: `${CELL_PX}px`, height: `${CELL_PX}px`, background: "#fff", border: "1px solid var(--border)", borderRadius: "4px", display: "block", imageRendering: "pixelated" }}
      />
      {snr != null && Number.isFinite(snr) && (
        <div className="mono" title="0.2″-aperture S/N (native flux / empirical error)"
          style={{ fontSize: "0.58rem", marginTop: "2px", whiteSpace: "nowrap",
            color: snr >= 3 ? "var(--text-muted)" : "var(--secondary)" }}>
          S/N {snr.toFixed(1)}
        </div>
      )}
    </div>
  );
}
