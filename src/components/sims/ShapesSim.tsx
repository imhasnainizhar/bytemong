"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Note, SimButton } from "./ui";

type Shape = { id: number; props: string[]; parent: number | null; transitions: Record<string, number> };
type Obj = { name: string; shape: number; color: string };

const COLORS = ["#4f8cff", "#ec4899", "#f59e0b", "#10b981", "#22d3ee", "#8b5cf6"];
const PROPS = ["x", "y", "z", "name"];

const initShapes = (): Record<number, Shape> => ({ 0: { id: 0, props: [], parent: null, transitions: {} } });

export function ShapesSim() {
  const [shapes, setShapes] = useState<Record<number, Shape>>(initShapes);
  const [objs, setObjs] = useState<Obj[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [nextShape, setNextShape] = useState(1);
  const [ic, setIc] = useState<{ seen: number[]; hits: number; misses: number; last: string }>({ seen: [], hits: 0, misses: 0, last: "" });
  const [flashShape, setFlashShape] = useState<number | null>(null);

  const newObj = () => {
    const i = objs.length;
    if (i >= 6) return;
    setObjs((o) => [...o, { name: String.fromCharCode(97 + i), shape: 0, color: COLORS[i] }]);
    setSel(i);
  };

  const addProp = (p: string) => {
    if (sel === null) return;
    const o = objs[sel];
    const sh = shapes[o.shape];
    if (sh.props.includes(p)) return;
    let target = sh.transitions[p];
    const next = { ...shapes };
    if (target === undefined) {
      target = nextShape;
      next[target] = { id: target, props: [...sh.props, p], parent: sh.id, transitions: {} };
      next[sh.id] = { ...sh, transitions: { ...sh.transitions, [p]: target } };
      setNextShape((n) => n + 1);
    }
    setShapes(next);
    setFlashShape(target);
    setTimeout(() => setFlashShape(null), 800);
    setObjs((os) => os.map((x, k) => (k === sel ? { ...x, shape: target! } : x)));
  };

  const runIc = () => {
    let { seen, hits, misses } = ic;
    const log: string[] = [];
    objs.forEach((o) => {
      if (!shapes[o.shape].props.includes("x")) {
        log.push(`${o.name}: no x`);
        return;
      }
      if (seen.includes(o.shape)) {
        hits++;
        log.push(`${o.name}: hit`);
      } else {
        misses++;
        seen = seen.length < 4 ? [...seen, o.shape] : seen;
        log.push(`${o.name}: miss`);
      }
    });
    setIc({ seen, hits, misses, last: log.join(" · ") });
  };

  const reset = () => {
    setShapes(initShapes());
    setObjs([]);
    setSel(null);
    setNextShape(1);
    setIc({ seen: [], hits: 0, misses: 0, last: "" });
  };

  const icState = ic.seen.length === 0 ? "uninitialized" : ic.seen.length === 1 ? "monomorphic" : ic.seen.length <= 3 ? "polymorphic" : "megamorphic";
  const icColor = { uninitialized: "#55555f", monomorphic: "#10b981", polymorphic: "#f59e0b", megamorphic: "#f43f5e" }[icState];

  // Render the shape tree recursively.
  const renderShape = (id: number, depth: number): ReactNode => {
    const s = shapes[id];
    const users = objs.filter((o) => o.shape === id);
    return (
      <div key={id} className={depth ? "ml-4 border-l border-line pl-3" : ""}>
        <motion.div
          layout
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0, scale: flashShape === id ? [1, 1.05, 1] : 1 }}
          className="my-1 inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[11px]"
          style={{
            borderColor: flashShape === id ? "#10b981" : ic.seen.includes(id) ? `${icColor}88` : "rgba(255,255,255,.1)",
            background: "rgba(255,255,255,.02)",
          }}
        >
          <span className="text-faint">S{id}</span>
          <span className="text-ink">{"{" + s.props.map((p, i) => `${p}:${i}`).join(", ") + "}"}</span>
          <span className="flex gap-0.5">
            {users.map((u) => (
              <span key={u.name} className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-black" style={{ background: u.color }}>
                {u.name}
              </span>
            ))}
          </span>
        </motion.div>
        {Object.entries(s.transitions).map(([p, t]) => (
          <div key={t}>
            <div className="ml-4 font-mono text-[9.5px] text-faint">+{p}</div>
            {renderShape(t, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SimButton variant="primary" onClick={newObj} disabled={objs.length >= 6}>
          + new object {"{}"}
        </SimButton>
        <span className="text-[11px] text-faint">add to {sel !== null ? <span style={{ color: objs[sel]?.color }}>{objs[sel]?.name}</span> : "—"}:</span>
        {PROPS.map((p) => (
          <SimButton key={p} onClick={() => addProp(p)} disabled={sel === null || shapes[objs[sel!]?.shape]?.props.includes(p)}>
            .{p}
          </SimButton>
        ))}
        <SimButton onClick={reset} className="ml-auto">
          Reset
        </SimButton>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
        <div className="rounded-xl border border-line bg-black/40 p-3">
          <div className="mb-2 text-[12px] text-muted">Objects · click to select</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <AnimatePresence>
              {objs.map((o, i) => (
                <motion.button
                  key={o.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setSel(i)}
                  className="rounded-lg border p-2 text-left"
                  style={{ borderColor: sel === i ? o.color : "rgba(255,255,255,.08)", background: sel === i ? `${o.color}14` : "rgba(255,255,255,.02)" }}
                >
                  <div className="flex items-center justify-between font-mono text-[11.5px]">
                    <span style={{ color: o.color }}>{o.name}</span>
                    <span className="text-faint">shape S{o.shape}</span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    {shapes[o.shape].props.map((p, k) => (
                      <span key={p} className="rounded border border-line bg-black/40 px-1.5 font-mono text-[10px] text-muted">
                        [{k}] {p}
                      </span>
                    ))}
                    {shapes[o.shape].props.length === 0 && <span className="text-[10px] text-faint">no slots</span>}
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
            {objs.length === 0 && <div className="col-span-2 py-6 text-center text-[11px] text-faint">Create an object to begin.</div>}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-black/40 p-3">
          <div className="mb-1 flex items-center justify-between text-[12px] text-muted">
            <span>Shape transition tree</span>
            <span className="font-mono text-[10px] text-faint">{Object.keys(shapes).length} shapes</span>
          </div>
          <div className="max-h-[260px] overflow-auto">{renderShape(0, 0)}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-black/40 p-3">
          <div className="font-mono text-[11px] text-muted">
            call site: <span className="text-ink">GET_PROP o.x</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: icColor }} />
            <span className="font-mono text-[12px]" style={{ color: icColor }}>
              {icState}
            </span>
            <span className="font-mono text-[10.5px] text-faint">
              hits {ic.hits} · misses {ic.misses}
            </span>
          </div>
          <SimButton onClick={runIc} disabled={!objs.length}>
            Read .x on every object
          </SimButton>
        </div>
        <Note>
          Build two objects by adding <span className="font-mono text-ink">x</span> then <span className="font-mono text-ink">y</span> in the same order and they share one shape. Add them in a
          different order and you get a sibling branch, which is a second shape the inline cache has to remember. {ic.last && <span className="mt-1 block font-mono text-[11px] text-faint">{ic.last}</span>}
        </Note>
      </div>
    </div>
  );
}
