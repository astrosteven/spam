"use client";
// On-the-fly color cutout rendered from a field's fitsgl tile pyramid — the SAME
// WebGL trilogy color the /map viewer shows, generated client-side at the object's
// sky position with NO pre-baked PNG. SPAM is CEERS-only, and the CEERS fitsgl tiles
// are the shared ones already live on Corral at unicorn/fitsgl/ceers.
//
// How it works (all frozen @fitsgl/core public API — see node_modules/@fitsgl/core):
//  - loadFitsglConfig(base + "/fitsgl.json") fetches + validates + URL-resolves the
//    producer config (bands with precomputed trilogy stats + a weighted default view).
//  - We derive the controlled ViewerConfig exactly as <FitsExplorer> does, via the
//    exported pure helpers, then mount a bare <FitsViewer>, apply the CAMPFIRE trilogy
//    over the producer's per-band stats, and center/zoom to the target FOV.
//
// MUST be client-only (WebGL2 + window): consumers dynamic-import it with { ssr:false }.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FitsViewer, type FitsViewerHandle } from "@fitsgl/core/react";
import {
  loadFitsglConfig,
  type FitsglConfig,
  type ViewerConfig,
  skyToPix,
  DEFAULT_TRILOGY_PARAMS,
  type TrilogyParams,
  type TrilogyStats,
} from "@fitsgl/core";
import {
  explorerBandsFromConfig,
  defaultViewFromConfig,
  defaultExplorerState,
  deriveViewerConfig,
} from "@fitsgl/core/react";

// Trilogy scaling knobs matched to campfire (campfire.hollisakins.com / COSMOS-Web
// defaults). Applied over the field's own per-band stats, so it recomputes the same
// stretch campfire uses — no tile rebuild needed. Shared by the map (MapViewer) too.
export const CAMPFIRE_TRILOGY = { noiselum: 0.12, satpercent: 0.01, noisesig: 2.0, noisesig0: 2.0 };

// Per-field fitsgl base URL. SPAM is CEERS-only; the CEERS tiles are the shared ones
// under unicorn/fitsgl/ceers on Corral. Keys match SEARCH_FIELDS[].field ("SPAM").
const FITSGL_ROOT = "https://web.corral.tacc.utexas.edu/unicorn/fitsgl";
export const FITSGL_BASE: Record<string, string> = {
  "SPAM": `${FITSGL_ROOT}/ceers`,
};

// The default cutout field of view, arcsec (matches the retired static RGB stamp).
const DEFAULT_FOV_ARCSEC = 2.4;
// Rendered pixel size of the cutout (CSS px; the GL backing store is × devicePixelRatio).
const CUTOUT_PX = 200;

// Resolve `?data=<mirror>` for local testing: if a fitsgl mirror lives under the
// override at /fitsgl/<slug>, point there; else use the live Corral base.
function resolveBase(field: string): string | null {
  const live = FITSGL_BASE[field];
  if (!live) return null;
  if (typeof window !== "undefined") {
    const o = new URLSearchParams(window.location.search).get("data");
    if (o) {
      const slug = live.replace(/\/$/, "").split("/").pop();
      return `${o.replace(/\/$/, "")}/fitsgl/${slug}`;
    }
  }
  return live;
}

// Module-scoped cache: a field's resolved FitsglConfig + derived ViewerConfig +
// per-band trilogy stats are built at most once per session (a card reopen is instant).
type Prepared = {
  fitsgl: FitsglConfig;
  viewer: ViewerConfig;
  params: TrilogyParams;
  single: boolean;
  stats: TrilogyStats[] | null;
};
const _prepCache: Record<string, Prepared> = {};
const _prepPromise: Record<string, Promise<Prepared>> = {};

async function prepare(base: string): Promise<Prepared> {
  if (base in _prepCache) return _prepCache[base];
  if (base in _prepPromise) return _prepPromise[base];
  _prepPromise[base] = (async () => {
    const fitsgl = await loadFitsglConfig(`${base}/fitsgl.json`);
    const eb = explorerBandsFromConfig(fitsgl);
    const state = defaultExplorerState(eb, defaultViewFromConfig(fitsgl));
    const viewer = deriveViewerConfig(eb, state);
    const params: TrilogyParams = { ...DEFAULT_TRILOGY_PARAMS, ...state.trilogyParams, ...CAMPFIRE_TRILOGY };
    const v = viewer.view;
    const names =
      v.mode === "single" ? [v.band] : v.mode === "rgb" ? [v.r, v.g, v.b] : v.bands.map((b) => b.band);
    const raw = names.map((n) => eb.find((b) => b.name === n)?.trilogy);
    const stats = raw.every((s) => s !== undefined) ? (raw as TrilogyStats[]) : null;
    const prep: Prepared = { fitsgl, viewer, params, single: v.mode === "single", stats };
    _prepCache[base] = prep;
    return prep;
  })();
  try {
    return await _prepPromise[base];
  } catch (e) {
    delete _prepPromise[base]; // allow retry
    throw e;
  }
}

// Reproduce <FitsExplorer>'s `applyTrilogyFromStats`: drive the faithful, color-
// preserving trilogy from the producer's precomputed global per-band stats (no tile
// rescan), so the color matches the /map viewer exactly. Returns false if the viewer
// mode hasn't settled or a band lacks stats.
function applyTrilogy(viewer: any, prep: Prepared): boolean {
  if (prep.stats === null) return false;
  const expectedMode = prep.single ? "single" : "multiband";
  if (viewer.sourceMode !== expectedMode) return false;
  viewer.applyTrilogy(prep.single ? prep.stats[0] : prep.stats, prep.params);
  viewer.setStretchMode("trilogy");
  return true;
}

type Status = "loading" | "ready" | "empty";

export function FitsglCutout({
  field,
  ra,
  dec,
  fovArcsec = DEFAULT_FOV_ARCSEC,
}: {
  field: string;
  ra: number;
  dec: number;
  fovArcsec?: number;
}) {
  const base = useMemo(() => resolveBase(field), [field]);
  const [status, setStatus] = useState<Status>(base ? "loading" : "empty");
  const [prep, setPrep] = useState<Prepared | null>(null);
  const handleRef = useRef<FitsViewerHandle | null>(null);
  const targetRef = useRef({ ra, dec, fovArcsec });
  targetRef.current = { ra, dec, fovArcsec };
  const placedRef = useRef(false);

  useEffect(() => {
    if (!base) {
      setStatus("empty");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setPrep(null);
    placedRef.current = false;
    prepare(base)
      .then((p) => {
        if (cancelled) return;
        setPrep(p);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(`[cutout] ${field}: failed to load fitsgl config:`, err);
        setStatus("empty");
      });
    return () => {
      cancelled = true;
    };
  }, [base, field]);

  const pixelScale = useMemo(() => {
    const g = prep?.fitsgl.dataset.bands[0]?.grid?.pixelScaleArcsec;
    return g && g > 0 ? g : 0.03;
  }, [prep]);

  const placeCamera = useCallback(() => {
    const h = handleRef.current;
    if (!h || !prep) return false;
    const viewer = h.getViewer();
    if (!viewer) return false;
    const wcs = viewer.getWcs();
    if (!wcs) return false;
    const t = targetRef.current;
    const px = skyToPix(wcs, t.ra, t.dec);
    if (!Number.isFinite(px.x) || !Number.isFinite(px.y)) return false;
    h.setCenter(px.x, px.y);
    const nativeAcross = t.fovArcsec / pixelScale;
    if (nativeAcross > 0) h.setZoom(CUTOUT_PX / nativeAcross);
    return true;
  }, [prep, pixelScale]);

  const onReady = useCallback(
    (h: FitsViewerHandle) => {
      handleRef.current = h;
      const viewer = h.getViewer();
      if (viewer && prep) applyTrilogy(viewer, prep);
      placeCamera();
    },
    [prep, placeCamera]
  );

  const onFrame = useCallback(() => {
    if (!placedRef.current) {
      const viewer = handleRef.current?.getViewer();
      if (viewer && prep) applyTrilogy(viewer, prep);
      const ok = placeCamera();
      if (ok) {
        placedRef.current = true;
        setStatus("ready");
      }
    }
  }, [prep, placeCamera]);

  if (!base || status === "empty") return null;

  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>
        COLOR <span style={{ color: "var(--text-dim)" }}>(fitsgl · ~{fovArcsec.toFixed(1)}″)</span>
      </div>
      <div
        style={{
          position: "relative",
          width: CUTOUT_PX,
          height: CUTOUT_PX,
          border: "1px solid var(--border)",
          borderRadius: "6px",
          overflow: "hidden",
          background: "#0d0a1a",
        }}
      >
        {prep && (
          <FitsViewer
            ref={handleRef}
            config={prep.viewer}
            onReady={onReady}
            onFrame={onFrame}
            onError={(err) => {
              console.error(`[cutout] ${field}: FitsViewer error:`, err);
              setStatus("empty");
            }}
            style={{
              width: "100%",
              height: "100%",
              opacity: status === "ready" ? 1 : 0,
              transition: "opacity 0.15s ease",
              pointerEvents: "none",
            }}
          />
        )}
        {status === "loading" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: "3px solid rgba(47,125,209,0.25)",
                borderTopColor: "var(--accent)",
                animation: "spam-spin 0.9s linear infinite",
              }}
            />
          </div>
        )}
      </div>
      <style>{`@keyframes spam-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default FitsglCutout;
