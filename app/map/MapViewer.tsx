"use client";
// Client-only WebGL viewer wrapper around @fitsgl/core's bare <FitsViewer>. Renders
// the CEERS tile pyramid color map, then draws OUR OWN source overlay as an SVG layer
// positioned over the viewer canvas: every catalog source (from the site search index)
// is a Kron ELLIPSE — semi-axes A_IMAGE*KRON_RADIUS / B_IMAGE*KRON_RADIUS, PA =
// THETA_IMAGE — drawn GREEN if SELECTED and YELLOW if not, and clickable to open the
// shared ResultCard. Sources with no theta in the index fall back to colored circles.
//
// CEERS is a single-mosaic field (index x,y are already world px), so the overlay uses
// them directly; the ra/dec→WCS path is kept for robustness but not needed here.
//
// MUST stay client-only (WebGL2 + window): the route dynamic-imports it with { ssr:false }.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FitsViewer,
  type FitsViewerHandle,
  deriveViewerConfig,
  explorerBandsFromConfig,
  defaultViewFromConfig,
  defaultExplorerState,
} from "@fitsgl/core/react";
import {
  loadFitsglConfig,
  skyToPix,
  pixToSky,
  DEFAULT_TRILOGY_PARAMS,
  type FitsglConfig,
  type ViewerConfig,
  type TrilogyParams,
  type TrilogyStats,
} from "@fitsgl/core";
import {
  loadField,
  loadFilters,
  loadSpecz,
  loadIntPz,
  angSep,
  type FieldConfig,
  type FieldIndex,
  type NumCol,
} from "@/app/_card/objectCard";
import { makePredicate } from "@/app/search/page";   // reuse the Search query language on the map

type LoadState = "loading" | "ready" | "error";

// Overlay colors (3-way): GREEN = has a campfire spec-z, YELLOW = selected (no spec-z),
// RED = not selected. Spec-z takes priority so confirmed sources stand out.
const GREEN = "#43d17a";
const YELLOW = "#f2d43a";
const RED = "#e8664d";

// ---- scale bar -------------------------------------------------------------
const SCALEBAR_TARGET_PX = 90;   // aim for a bar ~this many CSS px wide
const NICE_ARCSEC = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
function niceScaleBar(arcsecPerCssPx: number): { px: number; label: string } | null {
  if (!(arcsecPerCssPx > 0) || !Number.isFinite(arcsecPerCssPx)) return null;
  const target = SCALEBAR_TARGET_PX * arcsecPerCssPx;
  let chosen = NICE_ARCSEC[0];
  for (const a of NICE_ARCSEC) { if (a <= target) chosen = a; else break; }
  const px = chosen / arcsecPerCssPx;
  const label = chosen >= 60
    ? `${(chosen / 60) % 1 === 0 ? (chosen / 60).toFixed(0) : (chosen / 60).toFixed(1)}′`
    : `${chosen % 1 === 0 ? chosen.toFixed(0) : chosen.toFixed(1)}″`;
  return { px, label };
}

// Default trilogy scaling — the CAMPFIRE values (campfire.hollisakins.com) the map ships
// with; the scaling panel starts here and "Reset to default" returns here. Same knobs
// FitsglCutout's CAMPFIRE_TRILOGY uses so the map matches the card cutouts.
const CAMPFIRE_TRILOGY: TrilogyParams = {
  ...DEFAULT_TRILOGY_PARAMS,
  noiselum: 0.12,
  satpercent: 0.01,
  noisesig: 2.0,
  noisesig0: 2.0,
};

// The scaling knobs surfaced in the panel, with drag range + step.
type Knob = {
  key: keyof TrilogyParams;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  log?: boolean; // slider position is log10-spaced across [min,max]
};
const SCALING_KNOBS: Knob[] = [
  { key: "noiselum", label: "Noise floor", hint: "brightness of the sky/noise", min: 0, max: 0.4, step: 0.005 },
  { key: "noisesig", label: "Contrast", hint: "noise anchor · mean + n·σ", min: 0.5, max: 4, step: 0.05 },
  { key: "satpercent", label: "White point", hint: "% pixels saturated", min: 0.001, max: 1, step: 0.001, log: true },
  { key: "noisesig0", label: "Black point", hint: "sky floor · mean − n·σ", min: 1, max: 3, step: 0.05 },
];

// Cap on drawn overlay glyphs per frame — the viewport cull keeps only what's visible,
// and this bounds the SVG node count so pan/zoom stays smooth even zoomed all the way out.
const MAX_GLYPHS = 4000;
// Ellipse polygon resolution (vertices). 16 is smooth on-screen and cheap.
const ELLIPSE_SEGMENTS = 16;
// Below this many drawing-buffer px per world px, draw a small dot instead of a Kron ellipse.
const DOT_ZOOM = 0.5;

// ---- Filter model ----------------------------------------------------------
export type MapFilters = {
  selectedOnly: boolean;
  zMin: number | null;
  zMax: number | null;
  magMin: number | null;
  magMax: number | null;
  magFilter: string;
  query: string;
};
export const DEFAULT_FILTERS: MapFilters = {
  selectedOnly: false, zMin: null, zMax: null, magMin: null, magMax: null, magFilter: "F277W", query: "",
};

// One query-evaluable row from the base index at position i. Base built-ins come from the index;
// per-band mag/snr/flux/colors, campfire czspec/czqual, and int_pz come from the lazy sidecars,
// passed in `extra` (each a position-aligned column). Keys match the Search column names so
// makePredicate/colGetter read them — so the map evaluates the SAME query language as Search.
type QRow = Record<string, number | null>;
function idxQueryRow(idx: FieldIndex, i: number, extra?: Record<string, NumCol>): QRow {
  const g = (c: NumCol | undefined) => (c ? (c[i] ?? null) : null);
  const row: QRow = {
    za: g(idx.za), zspec: g(idx.zspec), m277: g(idx.m277), m444: g(idx.m444),
    m1500: g(idx.m1500), m1300: g(idx.m1300), mabs: g(idx.mabs), beta: g(idx.beta),
    chia: g(idx.chia), chia_lowz: g(idx.chia_lowz), z_lowz: g(idx.z_lowz), zl68: g(idx.zl68), zu68: g(idx.zu68),
    selected: g(idx.selected), inspected: g(idx.inspected), sample: g(idx.sample),
  };
  if (extra) for (const k in extra) { const c = extra[k]; row[k] = c ? (c[i] ?? null) : null; }
  return row;
}

// A source that passed the active filters, with the geometry needed to draw it.
type Src = {
  i: number; id: number; sel: boolean;
  x: number; y: number;               // world-pixel centre (from index x/y)
  ra: number; dec: number;            // sky position — used to resolve world px on tiled fields
  semiA: number; semiB: number; th: number;  // ellipse semi-axes (px) + PA (rad); th=NaN → circle
};

// Precompute the filtered source list (positions + ellipse params).
function filterSources(idx: FieldIndex, magCol: NumCol, f: MapFilters, pred: ((r: QRow) => boolean) | null, qExtra?: Record<string, NumCol>): Src[] {
  const n = idx.n;
  const sel = idx.selected, za = idx.za;
  const a = idx.a_image, b = idx.b_image, kr = idx.kron_radius, theta = idx.theta ?? null;
  const x = idx.x, y = idx.y;
  const haveXY = x != null && y != null;
  const { zMin, zMax, magMin: mMin, magMax: mMax, selectedOnly } = f;
  const out: Src[] = [];
  if (!haveXY) return out;
  for (let i = 0; i < n; i++) {
    const isSel = sel?.[i] === 1;
    if (selectedOnly && !isSel) continue;
    const z = za?.[i];
    if (zMin != null && (z == null || z < zMin)) continue;
    if (zMax != null && (z == null || z > zMax)) continue;
    if (mMin != null || mMax != null) {
      const m = magCol?.[i];
      if (m == null) continue;
      if (mMin != null && m < mMin) continue;
      if (mMax != null && m > mMax) continue;
    }
    // Free-form query (same language as Search) — applied last, after the cheap range filters.
    if (pred && !pred(idxQueryRow(idx, i, qExtra))) continue;
    const xi = x![i], yi = y![i];
    if (xi == null || yi == null) continue;
    // Ellipse params (Kron): semi-axes a*kron, b*kron; PA theta deg CCW from +x.
    let semiA = 0, semiB = 0, th = NaN;
    const av = a?.[i], bv = b?.[i], kv = kr?.[i], tv = theta?.[i];
    if (av != null && bv != null && kv != null && kv > 0 && tv != null) {
      semiA = av * kv; semiB = bv * kv; th = (tv * Math.PI) / 180;
    }
    out.push({ i, id: idx.id[i], sel: isSel, x: xi, y: yi, ra: idx.ra[i], dec: idx.dec[i], semiA, semiB, th });
  }
  return out;
}

// One drawable glyph in SCREEN space.
type Glyph = { id: number; sel: boolean; sz?: boolean; poly?: string; cx?: number; cy?: number; r?: number };

export default function MapViewer({
  field,
  configUrl,
  filters,
  onSourceClick,
  onCount,
  onReadyHandle,
  onQueryError,
}: {
  field: FieldConfig;
  configUrl: string;
  filters: MapFilters;
  onSourceClick: (id: number) => void;
  onCount?: (n: number) => void;
  onReadyHandle?: (h: FitsViewerHandle, idx: FieldIndex) => void;
  onQueryError?: (e: string) => void;
}) {
  const [state, setState] = useState<LoadState>("loading");
  const [config, setConfig] = useState<FitsglConfig | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");
  const [idx, setIdx] = useState<FieldIndex | null>(null);
  const [magCol, setMagCol] = useState<NumCol>(null);
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);
  const [showSources, setShowSources] = useState(true);   // hide to screenshot a clean colour image
  const [scaleBar, setScaleBar] = useState<{ px: number; label: string } | null>(null);
  // Ids with a campfire spec-z (→ drawn green). Loaded once per field; project() reads the ref.
  const zspecIdsRef = useRef<Set<number> | null>(null);
  const [trilogy, setTrilogy] = useState<TrilogyParams>(CAMPFIRE_TRILOGY);
  const [panelOpen, setPanelOpen] = useState(true);

  const clickRef = useRef(onSourceClick);
  useEffect(() => { clickRef.current = onSourceClick; }, [onSourceClick]);
  const countRef = useRef(onCount);
  useEffect(() => { countRef.current = onCount; }, [onCount]);
  const readyHandleRef = useRef(onReadyHandle);
  useEffect(() => { readyHandleRef.current = onReadyHandle; }, [onReadyHandle]);

  const handleRef = useRef<FitsViewerHandle | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<Src[]>([]);
  const tiledRef = useRef(false);
  const resolvedRef = useRef(false);
  const statsRef = useRef<{ stats: TrilogyStats[] | null; single: boolean }>({ stats: null, single: false });

  // Load the tile config.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) { setState("loading"); setConfig(null); } });
    loadFitsglConfig(configUrl)
      .then(cfg => { if (!cancelled) { setConfig(cfg); setState("ready"); } })
      .catch(err => {
        if (cancelled) return;
        console.error("[map] failed to load fitsgl config:", err);
        setErrMsg(err instanceof Error ? err.message : String(err));
        setState("error");
      });
    return () => { cancelled = true; };
  }, [configUrl]);

  const prep = useMemo<{ viewer: ViewerConfig; stats: TrilogyStats[] | null; single: boolean } | null>(() => {
    if (!config) return null;
    const bands = explorerBandsFromConfig(config);
    const st = defaultExplorerState(bands, defaultViewFromConfig(config));
    st.trilogyParams = { ...st.trilogyParams, ...CAMPFIRE_TRILOGY };
    const viewer = deriveViewerConfig(bands, st);
    const v = viewer.view;
    const names =
      v.mode === "single" ? [v.band] : v.mode === "rgb" ? [v.r, v.g, v.b] : v.bands.map(b => b.band);
    const raw = names.map(n => bands.find(b => b.name === n)?.trilogy);
    const stats = raw.every(s => s !== undefined) ? (raw as TrilogyStats[]) : null;
    return { viewer, stats, single: v.mode === "single" };
  }, [config]);
  const viewerConfig = prep?.viewer ?? null;
  useEffect(() => {
    statsRef.current = { stats: prep?.stats ?? null, single: prep?.single ?? false };
  }, [prep]);

  // Re-derive + apply the trilogy stretch on the LIVE viewer from the given params.
  const applyScaling = useCallback((params: TrilogyParams) => {
    const h = handleRef.current;
    const viewer = h?.getViewer();
    const { stats, single } = statsRef.current;
    if (!viewer || !stats) return;
    const expectedMode = single ? "single" : "multiband";
    if (viewer.sourceMode !== expectedMode) return;
    viewer.applyTrilogy(single ? stats[0] : stats, params);
    viewer.setStretchMode("trilogy");
  }, []);

  useEffect(() => { applyScaling(trilogy); }, [trilogy, applyScaling]);

  // Load our search index (positions, selected, za, geometry) once.
  useEffect(() => {
    let cancelled = false;
    loadField(field)
      .then(({ idx }) => { if (!cancelled) { tiledRef.current = idx.tile != null; setIdx(idx); } })
      .catch(err => console.error("[map] failed to load search index:", err));
    return () => { cancelled = true; };
  }, []);

  // Resolve the mag column for the active band when a mag range is set.
  const magBand = filters.magFilter;
  const magRangeActive = filters.magMin != null || filters.magMax != null;
  useEffect(() => {
    if (!idx || !magRangeActive) { setMagCol(null); return; }
    let cancelled = false;
    if (magBand === "F277W" && idx.m277) { setMagCol(idx.m277); return; }
    if (magBand === "F444W" && idx.m444) { setMagCol(idx.m444); return; }
    (async () => {
      const fx = await loadFilters(field);
      if (cancelled || !fx) { setMagCol(null); return; }
      const flux = fx[`flux_${magBand.toLowerCase()}`];
      if (!flux) { setMagCol(null); return; }
      const col = flux.map(v => (v != null && v > 0 ? 31.4 - 2.5 * Math.log10(v) : null));
      if (!cancelled) setMagCol(col as NumCol);
    })();
    return () => { cancelled = true; };
  }, [idx, magBand, magRangeActive]);

  // Sidecar columns the free-form query needs beyond the base index (per-band flux for
  // mag/snr/color, campfire czspec/czqual, int_pz). Loaded lazily when the query references
  // them, attached position-aligned so the map evaluates the SAME query language as Search.
  const [qExtra, setQExtra] = useState<Record<string, NumCol> | null>(null);
  useEffect(() => {
    const q = filters.query.toLowerCase();
    if (!q.trim() || !idx) { setQExtra(null); return; }
    let cancelled = false;
    (async () => {
      const needFilt = /\b(?:mag|snr|flux|fluxerr)_[a-z0-9]+\b/.test(q) || /\b[a-z][a-z0-9]*-[a-z][a-z0-9]*\b/.test(q);
      const needSpecz = /\bcz(spec|qual)\b/.test(q);
      const needIp = /\bint_(pz|zgt|cen)/.test(q);
      const [fx, sz, ip] = await Promise.all([
        needFilt ? loadFilters(field) : Promise.resolve(null),
        needSpecz ? loadSpecz(field) : Promise.resolve(null),
        needIp ? loadIntPz(field) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      const extra: Record<string, NumCol> = {};
      if (fx) for (const k in fx) if (k.startsWith("flux_") || k.startsWith("fluxerr_")) extra[k] = fx[k];
      if (ip) for (const k in ip) if (k.startsWith("int_")) extra[k] = ip[k];
      if (sz && idx) {
        const ids = idx.id ?? [];
        const cz: (number | null)[] = new Array(ids.length).fill(null);
        const cq: (number | null)[] = new Array(ids.length).fill(null);
        for (let i = 0; i < ids.length; i++) { const r = sz[String(ids[i])]; if (r) { cz[i] = r.z; cq[i] = r.q; } }
        extra["czspec"] = cz as NumCol; extra["czqual"] = cq as NumCol;
      }
      setQExtra(Object.keys(extra).length ? extra : null);
    })();
    return () => { cancelled = true; };
  }, [filters.query, field, idx]);

  // Compile the free-form query (same language as Search); blank = no-op. Error surfaced below.
  const queryPred = useMemo(() => {
    const q = filters.query.trim();
    if (!q) return { test: null as ((r: QRow) => boolean) | null, error: "" };
    const r = makePredicate(q);
    return "error" in r
      ? { test: null as ((r: QRow) => boolean) | null, error: r.error }
      : { test: r.test as (r: QRow) => boolean, error: "" };
  }, [filters.query]);

  useEffect(() => { onQueryError?.(queryPred.error); }, [queryPred, onQueryError]);

  // Rebuild the filtered source list when index / mag column / filters / query change.
  const sources = useMemo(
    () => (idx ? filterSources(idx, magRangeActive ? magCol : null, filters, queryPred.test, qExtra ?? undefined) : []),
    [idx, magCol, filters, magRangeActive, queryPred, qExtra],
  );
  useEffect(() => {
    sourcesRef.current = sources;
    resolvedRef.current = false;
    countRef.current?.(sources.length);
    project();
    const t1 = setTimeout(() => project(), 200);
    const t2 = setTimeout(() => project(), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  // Load the campfire spec-z ids once per field (→ green glyphs + the legend's spec-z row).
  useEffect(() => {
    let cancelled = false;
    zspecIdsRef.current = null;
    loadSpecz(field).then(map => {
      if (cancelled) return;
      const ids = new Set<number>();
      for (const k in map) if (map[k]?.z != null) ids.add(Number(k));
      zspecIdsRef.current = ids.size ? ids : null;
      project();
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field]);

  // Project the (culled) filtered sources to screen glyphs for the current frame.
  const project = useCallback(() => {
    const h = handleRef.current;
    const wrap = wrapRef.current;
    if (!h || !wrap) return;
    const cam = h.getCameraState();
    if (!cam) return;
    const rect = wrap.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const zoom = cam.zoom;
    const list = sourcesRef.current;
    const asDot = zoom < DOT_ZOOM;

    // Tiled fields: resolve world px from ra/dec via WCS (once). CEERS is single-mosaic
    // (tiledRef false), so this is a no-op there.
    if (tiledRef.current && !resolvedRef.current && list.length) {
      const wcs = h.getViewer()?.getWcs();
      if (wcs) {
        for (const s of list) {
          const p = skyToPix(wcs, s.ra, s.dec);
          if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) { s.x = p.x; s.y = p.y; }
        }
        resolvedRef.current = true;
      }
    }

    // Phase 1 — WORLD-space viewport cull.
    const halfW = (W / zoom) * 0.75 + 60;
    const halfH = (H / zoom) * 0.75 + 60;
    const x0 = cam.centerX - halfW, x1 = cam.centerX + halfW;
    const y0 = cam.centerY - halfH, y1 = cam.centerY + halfH;
    const visible: Src[] = [];
    for (let k = 0; k < list.length; k++) {
      const s = list[k];
      if (s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1) visible.push(s);
    }

    // Phase 2 — stride-sample the VISIBLE set uniformly if over the cap.
    const stride = Math.max(1, Math.ceil(visible.length / MAX_GLYPHS));
    const out: Glyph[] = [];
    for (let k = 0; k < visible.length && out.length < MAX_GLYPHS; k += stride) {
      const s = visible[k];
      const c = h.imageToScreen(s.x + 0.5, s.y + 0.5);
      if (!c) continue;
      const scx = c.x - rect.left, scy = c.y - rect.top;

      const sz = zspecIdsRef.current?.has(s.id) ?? false;
      if (asDot || !(s.semiA > 0 && s.semiB > 0) || Number.isNaN(s.th)) {
        out.push({ id: s.id, sel: s.sel, sz, cx: scx, cy: scy, r: asDot ? 1.6 : 4 });
        continue;
      }
      const ct = Math.cos(s.th), st = Math.sin(s.th);
      const pts: string[] = [];
      let bad = false;
      for (let j = 0; j < ELLIPSE_SEGMENTS; j++) {
        const phi = (2 * Math.PI * j) / ELLIPSE_SEGMENTS;
        const ex = s.semiA * Math.cos(phi), ey = s.semiB * Math.sin(phi);
        const wx = s.x + 0.5 + ex * ct - ey * st;
        const wy = s.y + 0.5 + ex * st + ey * ct;
        const p = h.imageToScreen(wx, wy);
        if (!p) { bad = true; break; }
        pts.push(`${(p.x - rect.left).toFixed(1)},${(p.y - rect.top).toFixed(1)}`);
      }
      if (bad) continue;
      out.push({ id: s.id, sel: s.sel, sz, poly: pts.join(" ") });
    }
    setGlyphs(out);

    // Scale bar: arcsec per CSS screen pixel at the current zoom, measured via the WCS over a
    // 50-image-px baseline at the view centre (accurate for any zoom / mosaic rotation).
    const wcs = h.getViewer()?.getWcs();
    if (wcs) {
      const a = h.imageToScreen(cam.centerX, cam.centerY);
      const b = h.imageToScreen(cam.centerX + 50, cam.centerY);
      const sa = pixToSky(wcs, cam.centerX, cam.centerY);
      const sb = pixToSky(wcs, cam.centerX + 50, cam.centerY);
      if (a && b && sa && sb && Number.isFinite(sa.ra) && Number.isFinite(sb.ra)) {
        const dScreen = Math.hypot(b.x - a.x, b.y - a.y);
        const dArcsec = angSep(sa.ra, sa.dec, sb.ra, sb.dec);
        if (dScreen > 0 && dArcsec > 0) setScaleBar(niceScaleBar(dArcsec / dScreen));
      }
    }
  }, []);

  const pokeProject = useCallback(() => {
    let tries = 0;
    const tick = () => {
      project();
      tries += 1;
      if (tries < 12) setTimeout(tick, 250);
    };
    requestAnimationFrame(tick);
  }, [project]);

  const onReady = useCallback((h: FitsViewerHandle) => {
    handleRef.current = h;
    if (idx) readyHandleRef.current?.(h, idx);
    pokeProject();
  }, [idx, pokeProject]);

  useEffect(() => {
    if (idx && handleRef.current) readyHandleRef.current?.(handleRef.current, idx);
  }, [idx]);

  if (state === "error") {
    return (
      <MapMessage
        title="Could not load the color map"
        body={
          <>
            The tile dataset (<code style={{ color: "var(--text-muted)" }}>fitsgl.json</code>) failed to load from<br />
            <code style={{ color: "var(--text-muted)", wordBreak: "break-all" }}>{configUrl}</code>
            {errMsg && <><br /><span style={{ color: "var(--text-dim)" }}>{errMsg}</span></>}
          </>
        }
      />
    );
  }

  if (state === "loading" || !config || !viewerConfig) {
    return <MapMessage title="Loading color map…" body="Fetching tile pyramid + source catalog." spin />;
  }

  const glyphSW = glyphs.length <= 40 ? 3 : glyphs.length <= 200 ? 2.3 : glyphs.length <= 1200 ? 1.7 : 1.3;

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <FitsViewer
        config={viewerConfig}
        onReady={onReady}
        onFrame={() => project()}
        onError={(err) => {
          console.error("[map] FitsViewer error:", err);
          setErrMsg(err instanceof Error ? err.message : String(err));
          setState("error");
        }}
        style={{ width: "100%", height: "100%" }}
      />
      {/* Overlay layer — pointer-events only on the glyphs, so panning the map still
          works everywhere between sources. Hidden via the toggle for clean colour screenshots. */}
      {showSources && (
      <svg
        data-overlay="sources"
        width="100%" height="100%"
        style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}
      >
        {glyphs.map((g, k) => {
          const color = g.sz ? GREEN : g.sel ? YELLOW : RED;
          const onClick = (e: React.MouseEvent) => { e.stopPropagation(); clickRef.current(g.id); };
          if (g.poly) {
            return (
              <polygon
                key={k} data-src-id={g.id} points={g.poly}
                fill="transparent" stroke={color} strokeWidth={glyphSW}
                style={{ pointerEvents: "visible", cursor: "pointer" }}
                onClick={onClick}
              >
                <title>ID {g.id}</title>
              </polygon>
            );
          }
          return (
            <circle
              key={k} data-src-id={g.id} cx={g.cx} cy={g.cy} r={g.r}
              fill={g.r! <= 2 ? color : "transparent"} stroke={color} strokeWidth={glyphSW}
              style={{ pointerEvents: "visible", cursor: "pointer" }}
              onClick={onClick}
            >
              <title>ID {g.id}</title>
            </circle>
          );
        })}
      </svg>
      )}

      {/* Sources on/off toggle — bottom-left. Off = clean colour image for screenshots. */}
      <button
        onClick={() => setShowSources(s => !s)}
        className="mono"
        title={showSources ? "Hide catalog sources" : "Show catalog sources"}
        style={{
          position: "absolute", left: 14, bottom: 14, zIndex: 16,
          background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-bright)", borderRadius: "5px",
          color: "var(--text)", cursor: "pointer", fontSize: "0.72rem", padding: "5px 9px",
        }}
      >
        {showSources ? "◉ sources" : "○ sources"}
      </button>

      {/* Scale bar — bottom-right. */}
      {scaleBar && (
        <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 16, textAlign: "center",
          color: "var(--text)", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem",
          textShadow: "0 1px 3px rgba(255,255,255,0.9)" }}>
          <div>{scaleBar.label}</div>
          <div style={{ width: `${scaleBar.px}px`, height: 3, background: "var(--text)", margin: "2px auto 0",
            borderLeft: "1px solid var(--text)", borderRight: "1px solid var(--text)" }} />
        </div>
      )}

      {/* SCALING panel — top-right. Drives the trilogy stretch live via applyScaling. */}
      <ScalingPanel
        params={trilogy}
        open={panelOpen}
        onToggle={() => setPanelOpen(o => !o)}
        onChange={patch => setTrilogy(p => ({ ...p, ...patch }))}
        onReset={() => setTrilogy(CAMPFIRE_TRILOGY)}
      />
    </div>
  );
}

// ---- SCALING control panel -------------------------------------------------
function ScalingPanel({
  params, open, onToggle, onChange, onReset,
}: {
  params: TrilogyParams;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<TrilogyParams>) => void;
  onReset: () => void;
}) {
  const isDefault = SCALING_KNOBS.every(k => params[k.key] === CAMPFIRE_TRILOGY[k.key]);
  return (
    <div
      style={{
        position: "absolute", top: 12, right: 12, zIndex: 15,
        width: open ? 224 : undefined,
        background: "rgba(20,22,26,0.82)", backdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8,
        boxShadow: "0 6px 24px rgba(0,0,0,0.4)", overflow: "hidden",
      }}
    >
      <button
        onClick={onToggle}
        className="mono"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          background: "none", border: "none", cursor: "pointer",
          color: "#7fb4ec", fontSize: "0.72rem", letterSpacing: "0.08em",
          padding: "9px 11px",
        }}
      >
        <span style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block", fontSize: "0.7rem" }}>▸</span>
        SCALING
      </button>

      {open && (
        <div style={{ padding: "2px 12px 12px" }}>
          {SCALING_KNOBS.map(k => {
            const val = params[k.key];
            const toPos = (v: number) =>
              k.log ? ((Math.log10(v) - Math.log10(k.min)) / (Math.log10(k.max) - Math.log10(k.min))) * 1000 : v;
            const fromPos = (p: number) =>
              k.log ? Math.pow(10, Math.log10(k.min) + (p / 1000) * (Math.log10(k.max) - Math.log10(k.min))) : p;
            return (
              <div key={k.key} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                  <span style={{ fontSize: "0.68rem", color: "#e8eaee", fontWeight: 600 }}>{k.label}</span>
                  <span className="mono" style={{ fontSize: "0.68rem", color: "#7fb4ec" }}>
                    {k.log ? val.toFixed(3) : val.toFixed(k.step < 0.01 ? 3 : 2)}
                  </span>
                </div>
                <input
                  type="range"
                  aria-label={k.label}
                  min={k.log ? 0 : k.min}
                  max={k.log ? 1000 : k.max}
                  step={k.log ? 1 : k.step}
                  value={toPos(val)}
                  onChange={e => onChange({ [k.key]: fromPos(Number(e.target.value)) } as Partial<TrilogyParams>)}
                  style={{ width: "100%", accentColor: "#2F7DD1", cursor: "pointer", height: 4 }}
                />
                <div style={{ fontSize: "0.58rem", color: "#9aa0aa", marginTop: 1 }}>{k.hint}</div>
              </div>
            );
          })}
          <button
            onClick={onReset}
            disabled={isDefault}
            className="mono"
            style={{
              width: "100%", marginTop: 2,
              background: "none", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 5,
              color: isDefault ? "#6b7078" : "#c9ccd2",
              cursor: isDefault ? "default" : "pointer", opacity: isDefault ? 0.55 : 1,
              fontSize: "0.68rem", padding: "6px 10px",
            }}
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}

function MapMessage({ title, body, spin }: { title: string; body: React.ReactNode; spin?: boolean }) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "12px", textAlign: "center",
      padding: "2rem", background: "#0d0a1a",
    }}>
      {spin && (
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          border: "3px solid rgba(127,180,236,0.25)", borderTopColor: "#7fb4ec",
          animation: "spam-map-spin 0.9s linear infinite",
        }} />
      )}
      <div className="mono" style={{ color: "#7fb4ec", fontSize: "0.95rem", fontWeight: 700 }}>{title}</div>
      <div style={{ color: "#c9ccd2", fontSize: "0.82rem", lineHeight: 1.7, maxWidth: "460px" }}>{body}</div>
      <style>{`@keyframes spam-map-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
