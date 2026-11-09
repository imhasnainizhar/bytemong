"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Note, SimButton } from "./ui";

type Color = "white" | "gray" | "black";
type Node = { id: string; x: number; y: number; label: string };

const ROOTS = [
  { id: "stack", x: 70, y: 40, label: "stack" },
  { id: "globals", x: 230, y: 40, label: "globals" },
  { id: "upvals", x: 390, y: 40, label: "upvalues" },
];

const baseNodes: Node[] = [
  { id: "A", x: 60, y: 130, label: "A" },
  { id: "B", x: 170, y: 130, label: "B" },
  { id: "C", x: 290, y: 130, label: "C" },
  { id: "D", x: 410, y: 130, label: "D" },
  { id: "E", x: 110, y: 220, label: "E" },
  { id: "F", x: 230, y: 220, label: "F" },
  { id: "G", x: 350, y: 220, label: "G" },
  { id: "H", x: 460, y: 220, label: "H" },
];

const baseEdges: [string, string][] = [
  ["stack", "A"],
  ["globals", "C"],
  ["upvals", "D"],
  ["A", "B"],
  ["A", "E"],
  ["B", "F"],
  ["F", "E"],
  ["G", "H"],
  ["H", "G"], // a cycle that refcounting could never free
];

const colorStyle: Record<Color, { fill: string; stroke: string; text: string }> = {
  white: { fill: "rgba(255,255,255,0.03)", stroke: "rgba(255,255,255,0.25)", text: "#8a8a96" },
  gray: { fill: "rgba(245,158,11,0.18)", stroke: "#f59e0b", text: "#fcd34d" },
  black: { fill: "rgba(16,185,129,0.2)", stroke: "#10b981", text: "#6ee7b7" },
};

type Phase = "idle" | "marking" | "marked" | "swept";

export function GcSim() {
  const [nodes, setNodes] = useState<Node[]>(baseNodes);
  const [edges, setEdges] = useState(baseEdges);
  const [color, setColor] = useState<Record<string, Color>>({});
  const [gray, setGray] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>(["Heap ready: 8 objects. Start by marking the roots."]);
  const [freed, setFreed] = useState<string[]>([]);
  const [nextId, setNextId] = useState(0);

  const push = (m: string) => setLog((l) => [m, ...l].slice(0, 6));
  const children = (id: string) => edges.filter(([a]) => a === id).map(([, b]) => b);

  const reset = () => {
    setNodes(baseNodes);
    setEdges(baseEdges);
    setColor({});
    setGray([]);
    setPhase("idle");
    setFreed([]);
    setNextId(0);
    setLog(["Heap reset."]);
  };

  const markRoots = () => {
    const c: Record<string, Color> = {};
    nodes.forEach((n) => (c[n.id] = "white"));
    const g: string[] = [];
    ROOTS.forEach((r) =>
      children(r.id).forEach((ch) => {
        if (c[ch] === "white") {
          c[ch] = "gray";
          g.push(ch);
        }
      }),
    );
    setColor(c);
    setGray(g);
    setPhase("marking");
    push(`Roots scanned → gray: ${g.join(", ")}. Everything else starts white.`);
  };

  const stepMark = () => {
    if (!gray.length) return;
    const [cur, ...rest] = gray;
    const c = { ...color };
    const newly: string[] = [];
    children(cur).forEach((ch) => {
      if (c[ch] === "white") {
        c[ch] = "gray";
        newly.push(ch);
      }
    });
    c[cur] = "black";
    const g = [...rest, ...newly];
    setColor(c);
    setGray(g);
    push(`Blacken ${cur}${newly.length ? `; gray its children ${newly.join(", ")}` : "; no white children"}.`);
    if (!g.length) {
      setPhase("marked");
      push("Gray set empty, marking complete. White objects are unreachable.");
    }
  };

  const sweep = () => {
    const dead = nodes.filter((n) => color[n.id] === "white").map((n) => n.id);
    setFreed(dead);
    setTimeout(() => {
      setNodes((ns) => ns.filter((n) => !dead.includes(n.id)));
      setEdges((es) => es.filter(([a, b]) => !dead.includes(a) && !dead.includes(b)));
      setColor({});
      setFreed([]);
    }, 650);
    setPhase("swept");
    push(dead.length ? `Swept ${dead.join(", ")}. Note that G↔H was a cycle: tracing frees it, refcounting can't.` : "Nothing to sweep.");
  };

  const allocate = () => {
    if (phase === "marking") return;
    const id = `N${nextId + 1}`;
    const spots = [
      [170, 290],
      [300, 290],
      [420, 290],
      [60, 290],
    ];
    const [x, y] = spots[nextId % spots.length];
    const reachable = nextId % 2 === 0;
    setNodes((ns) => [...ns, { id, x, y, label: id }]);
    if (reachable) setEdges((es) => [...es, [nodes[0]?.id ?? "A", id]]);
    setNextId((n) => n + 1);
    setColor({});
    setPhase("idle");
    push(reachable ? `Allocated ${id}, stored into ${nodes[0]?.id ?? "A"} (reachable).` : `Allocated ${id}, a temporary that's already dropped (garbage).`);
  };

  const pos = (id: string) => ROOTS.find((r) => r.id === id) ?? nodes.find((n) => n.id === id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SimButton variant="primary" onClick={markRoots} disabled={phase === "marking"}>
          1 · Mark roots
        </SimButton>
        <SimButton variant="primary" onClick={stepMark} disabled={phase !== "marking"}>
          2 · Trace one gray
        </SimButton>
        <SimButton variant="primary" onClick={sweep} disabled={phase !== "marked"}>
          3 · Sweep
        </SimButton>
        <SimButton onClick={allocate} disabled={phase === "marking"}>
          + Allocate
        </SimButton>
        <SimButton onClick={reset}>Reset</SimButton>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-faint">
          {(["white", "gray", "black"] as Color[]).map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border" style={{ background: colorStyle[c].fill, borderColor: colorStyle[c].stroke }} />
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-black/40">
        <svg viewBox="0 0 520 330" className="block w-full">
          <defs>
            <marker id="gc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10z" fill="rgba(255,255,255,0.35)" />
            </marker>
          </defs>
          <rect x="10" y="18" width="500" height="46" rx="10" fill="rgba(79,140,255,0.05)" stroke="rgba(79,140,255,0.25)" strokeDasharray="4 4" />
          <text x="20" y="14" fontSize="9" fill="#55555f" fontFamily="var(--font-mono)">
            GC ROOTS
          </text>
          {edges.map(([a, b], i) => {
            const p = pos(a), q = pos(b);
            if (!p || !q) return null;
            const dx = q.x - p.x, dy = q.y - p.y;
            const len = Math.hypot(dx, dy) || 1;
            const r = 20;
            const isCycleBack = a === "H" && b === "G";
            const off = isCycleBack ? 8 : a === "G" && b === "H" ? -8 : 0;
            return (
              <line
                key={i}
                x1={p.x + (dx / len) * r}
                y1={p.y + (dy / len) * r + off}
                x2={q.x - (dx / len) * r}
                y2={q.y - (dy / len) * r + off}
                stroke={color[b] === "black" || color[b] === "gray" ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.18)"}
                strokeWidth="1.4"
                markerEnd="url(#gc-arrow)"
              />
            );
          })}
          {ROOTS.map((r) => (
            <g key={r.id}>
              <rect x={r.x - 38} y={r.y - 12} width="76" height="24" rx="6" fill="rgba(79,140,255,0.12)" stroke="#4f8cff" />
              <text x={r.x} y={r.y + 4} textAnchor="middle" fontSize="10.5" fill="#bfdbfe" fontFamily="var(--font-mono)">
                {r.label}
              </text>
            </g>
          ))}
          {nodes.map((n) => {
            const c = colorStyle[color[n.id] ?? "white"];
            const dying = freed.includes(n.id);
            return (
              <motion.g key={n.id} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: dying ? 0 : 1, scale: dying ? 0.3 : 1 }} transition={{ duration: 0.45 }} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
                <circle cx={n.x} cy={n.y} r="20" fill={c.fill} stroke={c.stroke} strokeWidth="1.5" style={{ transition: "all .35s" }} />
                {gray[0] === n.id && <circle cx={n.x} cy={n.y} r="25" fill="none" stroke="#f59e0b" strokeOpacity=".5" className="animate-pulse-soft" />}
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill={c.text} fontFamily="var(--font-mono)">
                  {n.label}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
        <Note>
          <span className="text-ink">Gray worklist:</span> <span className="font-mono text-amber-300">{gray.length ? gray.join(" → ") : "∅"}</span>
          <br />
          Invariant: a black object never points directly to a white one. Concurrent collectors use write barriers to keep this true while your code keeps running.
        </Note>
        <div className="rounded-lg border border-line bg-black/40 p-3 font-mono text-[11.5px]">
          {log.map((l, i) => (
            <motion.div key={l + i} initial={{ opacity: 0 }} animate={{ opacity: 1 - i * 0.14 }} className={i === 0 ? "text-ink" : "text-faint"}>
              › {l}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
