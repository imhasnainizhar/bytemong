"use client";

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Hand, Maximize, Minus, Plus, X } from "lucide-react";
import { archById, ArchGraph, ComponentGrid, GRAPH_H, GRAPH_W, NodeDetails } from "./ArchGraph";
import { LogoMark } from "../Logo";
import { useIsClient, useMediaQuery } from "@/lib/useMediaQuery";

type View = { x: number; y: number; k: number };
const MIN_K = 0.35;
const MAX_K = 3;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

/**
 * Fullscreen, pannable/zoomable VM graph. Tap a node to open its details:
 * a floating side panel on desktop, a bottom drawer on mobile.
 * Rendered in a portal so transformed ancestors (float/reveal animations) can't trap it.
 */
export function VmCanvas({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(<AnimatePresence>{open && <CanvasOverlay key="vm-canvas" onClose={onClose} />}</AnimatePresence>, document.body);
}

function CanvasOverlay({ onClose }: { onClose: () => void }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [dragging, setDragging] = useState(false);
  const node = selected ? archById[selected] : null;

  const fitFor = useCallback((w: number, h: number): View => {
    const padX = w < 768 ? 16 : 64;
    const padTop = 76;
    const padBottom = 56;
    const k = clampK(Math.min((w - padX * 2) / GRAPH_W, (h - padTop - padBottom) / GRAPH_H, 1.5));
    return { k, x: (w - GRAPH_W * k) / 2, y: padTop + (h - padTop - padBottom - GRAPH_H * k) / 2 };
  }, []);

  // Measure the viewport and fit the graph whenever it resizes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setSize({ w, h });
      setView(fitFor(w, h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitFor]);

  // Lock page scroll while the canvas is up.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const k = clampK(v.k * factor);
      const r = k / v.k;
      return { k, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
    });
  }, []);

  // Wheel zoom (non-passive so we can stop the page from scrolling).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  /** Select a node and nudge the view so the panel/drawer doesn't cover it. */
  const select = useCallback(
    (id: string | null) => {
      setSelected(id);
      setShowList(false);
      if (!id) return;
      const n = archById[id];
      setView((v) => {
        const sx = n.x * v.k + v.x;
        const sy = n.y * v.k + v.y;
        if (isDesktop) {
          const visibleRight = size.w - 440;
          return sx > visibleRight - 60 || sx < 60 ? { ...v, x: v.x + (visibleRight / 2 - sx) } : v;
        }
        const targetY = size.h * 0.24;
        return Math.abs(sy - targetY) > 40 || sx < 40 || sx > size.w - 40 ? { ...v, x: v.x + (size.w / 2 - sx), y: v.y + (targetY - sy) } : v;
      });
    },
    [isDesktop, size],
  );

  // Esc closes the details first, then the canvas. Keyboard activation of nodes comes in as a custom event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selected || showList) {
        setSelected(null);
        setShowList(false);
      } else onClose();
    };
    const el = containerRef.current;
    const onActivate = (e: Event) => select((e as CustomEvent<string>).detail);
    window.addEventListener("keydown", onKey);
    el?.addEventListener("node-activate", onActivate);
    return () => {
      window.removeEventListener("keydown", onKey);
      el?.removeEventListener("node-activate", onActivate);
    };
  }, [selected, showList, onClose, select]);

  // --- Pointer gestures: drag to pan, pinch to zoom, tap to select ---------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: false, sx: 0, sy: 0, nodeId: null as string | null });

  const local = (e: RPointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // keep receiving moves while dragging off-element
    } catch {
      /* pointer not capturable (already released / synthetic); panning still works without it */
    }
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      const nodeEl = (e.target as Element).closest("[data-node]");
      gesture.current = { moved: false, sx: p.x, sy: p.y, nodeId: nodeEl?.getAttribute("data-node") ?? null };
    } else {
      gesture.current.moved = true; // second finger means pinch, never a tap
    }
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const before = [...pointers.current.values()];
    const p = local(e);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 1) {
      const g = gesture.current;
      if (!g.moved && Math.hypot(p.x - g.sx, p.y - g.sy) > 5) {
        g.moved = true;
        setDragging(true);
      }
      if (g.moved) setView((v) => ({ ...v, x: v.x + p.x - prev.x, y: v.y + p.y - prev.y }));
    } else if (pointers.current.size === 2 && before.length === 2) {
      const after = [...pointers.current.values()];
      const dist = (a: typeof p, b: typeof p) => Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = (a: typeof p, b: typeof p) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const f = dist(after[0], after[1]) / dist(before[0], before[1]);
      const m0 = mid(before[0], before[1]);
      const m1 = mid(after[0], after[1]);
      setView((v) => {
        const k = clampK(v.k * f);
        const r = k / v.k;
        return { k, x: m1.x - (m0.x - v.x) * r, y: m1.y - (m0.y - v.y) * r };
      });
    }
  };

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setDragging(false);
      // A tap (no drag): select the node under the finger, or clear the selection on empty canvas.
      if (!gesture.current.moved) select(gesture.current.nodeId);
    }
  };

  const zoomButton = (f: number) => zoomAt(f, isDesktop && node ? (size.w - 440) / 2 : size.w / 2, size.h / 2);

  return (
    <motion.div
      className="fixed inset-0 z-[80] bg-[#020203]"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label="Interactive VM canvas"
    >
      {/* Canvas surface */}
      <div
        ref={containerRef}
        className={`absolute inset-0 touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg className="block h-full w-full">
          <defs>
            <pattern id="canvas-grid" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              <circle cx="1" cy="1" r="0.9" fill="rgba(255,255,255,0.07)" />
            </pattern>
            <radialGradient id="canvas-glow" cx="50%" cy="40%" r="60%">
              <stop offset="0" stopColor="rgba(109,92,246,0.10)" />
              <stop offset="1" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#canvas-glow)" />
          <rect width="100%" height="100%" fill="url(#canvas-grid)" />
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <ArchGraph selected={selected} hover={hover} onHover={isDesktop ? setHover : undefined} background={false} />
          </g>
        </svg>
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent px-3 pb-8 pt-3 sm:px-5 sm:pt-4">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-black/60 px-3 py-2 backdrop-blur-md">
          <LogoMark size={22} id="canvas-logo" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-ink">Wisp VM canvas</div>
            <div className="hidden truncate text-[11px] text-faint sm:block">Drag to pan · scroll or pinch to zoom · click a component</div>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <div className="flex items-center rounded-xl border border-line bg-black/60 backdrop-blur-md">
            <CanvasBtn label="Zoom out" onClick={() => zoomButton(1 / 1.25)}>
              <Minus className="h-4 w-4" />
            </CanvasBtn>
            <span className="hidden w-11 text-center font-mono text-[11px] text-faint sm:block">{Math.round(view.k * 100)}%</span>
            <CanvasBtn label="Zoom in" onClick={() => zoomButton(1.25)}>
              <Plus className="h-4 w-4" />
            </CanvasBtn>
            <CanvasBtn label="Fit to screen" onClick={() => setView(fitFor(size.w, size.h))}>
              <Maximize className="h-4 w-4" />
            </CanvasBtn>
          </div>
          <button
            onClick={onClose}
            aria-label="Close canvas"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-black/60 text-muted backdrop-blur-md transition hover:border-line-strong hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom-left: hint + components toggle (hidden while details are open on mobile) */}
      <AnimatePresence>
        {!(node && !isDesktop) && !showList && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-4 left-3 flex items-center gap-2 sm:left-5"
          >
            <button
              onClick={() => {
                setSelected(null);
                setShowList(true);
              }}
              className="rounded-xl border border-line bg-black/60 px-3 py-2 text-[12px] text-muted backdrop-blur-md transition hover:border-line-strong hover:text-ink"
            >
              All components
            </button>
            {!node && (
              <span className="flex items-center gap-1.5 rounded-xl border border-line bg-black/60 px-3 py-2 text-[11.5px] text-faint backdrop-blur-md">
                <Hand className="h-3.5 w-3.5" />
                {isDesktop ? "Click any component" : "Tap any component"}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details: floating side panel on desktop, bottom drawer on mobile */}
      <AnimatePresence>
        {(node || showList) &&
          (isDesktop ? (
            <motion.aside
              key="panel"
              initial={{ x: 460, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 460, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="absolute bottom-4 right-4 top-20 flex w-[400px] flex-col overflow-hidden rounded-2xl border border-line-strong bg-[#08080b]/95 shadow-[0_30px_80px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            >
              <PanelHeader
                title={node ? "Component" : "All components"}
                onClose={() => {
                  setSelected(null);
                  setShowList(false);
                }}
              />
              <div className="flex-1 overflow-y-auto p-5">
                <AnimatePresence mode="wait">
                  <motion.div key={node?.id ?? "list"} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                    {node ? <NodeDetails node={node} onNavigate={onClose} /> : <ComponentGrid onSelect={select} onHover={setHover} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.aside>
          ) : (
            <Drawer
              key="drawer"
              title={node ? "Component" : "All components"}
              onClose={() => {
                setSelected(null);
                setShowList(false);
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div key={node?.id ?? "list"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  {node ? <NodeDetails node={node} onNavigate={onClose} /> : <ComponentGrid onSelect={select} />}
                </motion.div>
              </AnimatePresence>
            </Drawer>
          ))}
      </AnimatePresence>
    </motion.div>
  );
}

function CanvasBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="flex h-10 w-10 items-center justify-center text-muted transition hover:text-ink">
      {children}
    </button>
  );
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-5 py-3">
      <span className="text-[11px] font-medium uppercase tracking-wider text-faint">{title}</span>
      <button onClick={onClose} aria-label="Close details" className="rounded-md p-1 text-faint transition hover:bg-white/5 hover:text-ink">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Bottom sheet. Drag the handle down (or tap ×) to dismiss; the body scrolls independently. */
function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const controls = useDragControls();
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      drag="y"
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.7 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 90 || info.velocity.y > 500) onClose();
      }}
      className="absolute inset-x-0 bottom-0 flex max-h-[68vh] flex-col rounded-t-2xl border-t border-line-strong bg-[#08080b]/97 shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl"
    >
      <div className="touch-none cursor-grab px-5 pb-2 pt-2.5 active:cursor-grabbing" onPointerDown={(e) => controls.start(e)}>
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        <div className="mt-2.5 flex items-center justify-between">
          <span className="truncate text-[11px] font-medium uppercase tracking-wider text-faint">{title}</span>
          <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Close details" className="rounded-md p-1 text-faint transition hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">{children}</div>
    </motion.div>
  );
}
