"use client";

import Link from "next/link";
import { useId } from "react";
import { ArrowRight, Coffee, Hammer } from "lucide-react";
import { archEdges, archNodes, NODE_H, NODE_W, type ArchNode } from "@/content/architecture";
import { accentHex } from "@/content";
import { CodeBlock } from "../CodeBlock";

export const GRAPH_W = 760;
export const GRAPH_H = 600;
export const archById: Record<string, ArchNode> = Object.fromEntries(archNodes.map((n) => [n.id, n]));

export function edgePath(a: ArchNode, b: ArchNode) {
  if (Math.abs(a.y - b.y) < 4) {
    const dir = b.x > a.x ? 1 : -1;
    const x1 = a.x + (dir * NODE_W) / 2;
    const x2 = b.x - (dir * NODE_W) / 2;
    return `M${x1} ${a.y} L${x2} ${b.y}`;
  }
  const down = b.y > a.y;
  const y1 = a.y + ((down ? 1 : -1) * NODE_H) / 2;
  const y2 = b.y - ((down ? 1 : -1) * NODE_H) / 2;
  const my = (y1 + y2) / 2;
  return `M${a.x} ${y1} C${a.x} ${my}, ${b.x} ${my}, ${b.x} ${y2}`;
}

/**
 * The VM graph as SVG children (no <svg> wrapper), so it can be dropped into a
 * fixed viewBox (inline explorer) or a pan/zoom transform group (canvas).
 */
export function ArchGraph({
  selected,
  hover,
  onHover,
  onNodeClick,
  background = true,
}: {
  selected: string | null;
  hover: string | null;
  onHover?: (id: string | null) => void;
  /** Omit when the parent resolves clicks itself (the canvas does, to tell taps from drags). */
  onNodeClick?: (id: string) => void;
  background?: boolean;
}) {
  const patternId = `dots-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const focus = hover ?? selected;
  // With a focused (hovered or selected) node: it stays fully lit, its direct neighbours fade
  // a little so its own paths still read, and everything else goes dull.
  const isNeighbor = (id: string) => archEdges.some(([a, b]) => (a === focus && b === id) || (b === focus && a === id));
  const nodeOpacity = (id: string) => (!focus || id === focus ? 1 : isNeighbor(id) ? 0.55 : 0.18);

  return (
    <>
      {background && (
        <>
          <defs>
            <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.06)" />
            </pattern>
          </defs>
          <rect width={GRAPH_W} height={GRAPH_H} fill={`url(#${patternId})`} />
        </>
      )}
      <g style={{ opacity: focus ? 0.35 : 1, transition: "opacity .25s" }}>
        <rect x="14" y="326" width="732" height="70" rx="12" fill="rgba(79,140,255,0.025)" stroke="rgba(79,140,255,0.12)" strokeDasharray="4 4" />
        <text x="24" y="320" fontSize="9" fill="#55555f" fontFamily="var(--font-mono)" letterSpacing="1">
          RUNTIME DATA AREAS
        </text>
      </g>

      {archEdges.map(([from, to], i) => {
        const a = archById[from], b = archById[to];
        const d = edgePath(a, b);
        const on = focus ? from === focus || to === focus : false;
        const dim = focus && !on;
        const c = accentHex[a.accent];
        return (
          <g key={i} style={{ opacity: dim ? 0.08 : 1, transition: "opacity .25s" }}>
            <path d={d} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
            <path d={d} fill="none" stroke={c} strokeOpacity={on ? 0.95 : 0.45} strokeWidth={on ? 1.8 : 1.3} className="edge-flow" />
            <circle r={on ? 3 : 2.2} fill={c}>
              <animateMotion dur={`${2.2 + (i % 4) * 0.4}s`} repeatCount="indefinite" path={d} begin={`${(i * 0.37) % 2}s`} />
            </circle>
          </g>
        );
      })}

      {archNodes.map((n) => {
        const c = accentHex[n.accent];
        const isSel = selected === n.id;
        return (
          <g
            key={n.id}
            data-node={n.id}
            onClick={onNodeClick ? () => onNodeClick(n.id) : undefined}
            onMouseEnter={() => onHover?.(n.id)}
            onMouseLeave={() => onHover?.(null)}
            style={{ cursor: "pointer", opacity: nodeOpacity(n.id), transition: "opacity .25s", outline: "none" }}
            role="button"
            tabIndex={0}
            aria-label={n.label}
            aria-pressed={isSel}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNodeClick?.(n.id);
                (e.currentTarget as SVGGElement).dispatchEvent(new CustomEvent("node-activate", { bubbles: true, detail: n.id }));
              }
            }}
          >
            {isSel && (
              <rect x={n.x - NODE_W / 2 - 5} y={n.y - NODE_H / 2 - 5} width={NODE_W + 10} height={NODE_H + 10} rx="13" fill="none" stroke={c} strokeOpacity=".5" className="animate-pulse-soft" />
            )}
            <rect
              x={n.x - NODE_W / 2}
              y={n.y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx="10"
              fill={isSel ? `${c}2a` : `${c}12`}
              stroke={isSel || hover === n.id ? c : `${c}66`}
              strokeWidth={isSel ? 1.6 : 1}
              style={{ filter: isSel ? `drop-shadow(0 0 12px ${c}88)` : "none", transition: "all .25s" }}
            />
            <circle cx={n.x - NODE_W / 2} cy={n.y} r="2.5" fill={c} />
            <circle cx={n.x + NODE_W / 2} cy={n.y} r="2.5" fill={c} />
            <text x={n.x} y={n.y - 2} textAnchor="middle" fontSize="12" fontWeight="600" fill={isSel ? "#fff" : c}>
              {n.label}
            </text>
            <text x={n.x} y={n.y + 12} textAnchor="middle" fontSize="8.8" fill="#6b6b78" fontFamily="var(--font-mono)">
              {n.sub}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** Everything we know about one component: role, JVM lesson, build steps, code, lesson link. */
export function NodeDetails({ node, onNavigate }: { node: ArchNode; onNavigate?: () => void }) {
  const c = accentHex[node.accent];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border px-2 py-0.5 text-[10.5px]" style={{ borderColor: `${c}50`, color: c }}>
          {node.group}
        </span>
        <span className="font-mono text-[10.5px] text-faint">JVM ≈ {node.jvm}</span>
      </div>
      <h3 className="mt-3 text-xl font-semibold text-ink">{node.label}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[#b0b0ba]">{node.role}</p>

      <div className="mt-5 rounded-lg border border-amber/20 bg-amber/[0.04] p-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-amber">
          <Coffee className="h-3.5 w-3.5" /> From the JVM
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{node.jvmLesson}</p>
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-emerald">
          <Hammer className="h-3.5 w-3.5" /> Build your own
        </div>
        <ol className="mt-2.5 space-y-2">
          {node.build.map((b, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-[#b0b0ba]">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald/40 font-mono text-[9px] text-emerald">{i + 1}</span>
              {b}
            </li>
          ))}
        </ol>
      </div>
      {node.code && (
        <div className="mt-4">
          <CodeBlock code={node.code.code} lang={node.code.lang} />
        </div>
      )}
      {node.lesson && (
        <Link href={`/learn/${node.lesson}`} onClick={onNavigate} className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-violet-300 transition hover:text-violet-200">
          Go deeper in the lesson <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/**
 * Every component, selectable.
 * Mobile: small 2-up boxes with the JVM counterpart wrapped under the name.
 * md+: a compact single-row list (name left, JVM counterpart right).
 */
export function ComponentGrid({ onSelect, onHover }: { onSelect: (id: string) => void; onHover?: (id: string | null) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-1 md:gap-1">
      {archNodes.map((n) => {
        const c = accentHex[n.accent];
        return (
          <button
            key={n.id}
            onClick={() => onSelect(n.id)}
            onMouseEnter={() => onHover?.(n.id)}
            onMouseLeave={() => onHover?.(null)}
            className="group flex flex-col items-start justify-start rounded-lg border border-line bg-white/[0.02] p-2.5 text-left transition hover:border-line-strong hover:bg-white/[0.04] md:flex-row md:items-center md:gap-3 md:rounded-md md:border-transparent md:bg-transparent md:px-2 md:py-1.5 md:hover:border-transparent md:hover:bg-white/[0.03]"
          >
            <span className="flex shrink-0 items-center gap-2 text-[12.5px] font-medium text-[#cfcfd8] group-hover:text-ink md:gap-3 md:text-[13px] md:font-normal md:text-muted">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full md:h-2 md:w-2" style={{ background: c }} />
              {n.label}
            </span>
            <span className="mt-1 block font-mono text-[10px] leading-snug text-faint md:ml-auto md:mt-0 md:min-w-0 md:truncate md:pl-2">{n.jvm}</span>
          </button>
        );
      })}
    </div>
  );
}
