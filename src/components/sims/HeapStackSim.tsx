"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Note, Panel, SimButton, StepControls } from "./ui";
import { Rich } from "../Rich";

type Slot = { name: string; val: string; ref?: string };
type Frame = { fn: string; slots: Slot[] };
type Obj = { id: string; kind: string; body: string; bytes: number; refs?: string[]; garbage?: boolean };
type Snap = { line: number; frames: Frame[]; heap: Obj[]; note: string };
type Scenario = { name: string; source: string[]; snaps: Snap[] };

const scenarios: Scenario[] = [
  {
    name: "Allocation",
    source: ['let user = { name: "ada", age: 36 }', 'let tags = ["vm", "gc"]', "let n = 42"],
    snaps: [
      { line: -1, frames: [{ fn: "<script>", slots: [] }], heap: [], note: "The script's top-level frame is on the stack. The heap is empty." },
      {
        line: 0,
        frames: [{ fn: "<script>", slots: [{ name: "user", val: "→ #1", ref: "h1" }] }],
        heap: [
          { id: "h1", kind: "Object", body: "shape{name,age}  age: 36", bytes: 40, refs: ["h2"] },
          { id: "h2", kind: "String", body: '"ada"', bytes: 27 },
        ],
        note: "The object goes on the heap. `age: 36` is a number and sits inline in a slot. The string is its own heap object. The stack slot holds only a reference.",
      },
      {
        line: 1,
        frames: [{ fn: "<script>", slots: [{ name: "user", val: "→ #1", ref: "h1" }, { name: "tags", val: "→ #3", ref: "h3" }] }],
        heap: [
          { id: "h1", kind: "Object", body: "shape{name,age}  age: 36", bytes: 40, refs: ["h2"] },
          { id: "h2", kind: "String", body: '"ada"', bytes: 27 },
          { id: "h3", kind: "Array", body: "len 2", bytes: 48, refs: ["h4", "h5"] },
          { id: "h4", kind: "String", body: '"vm"', bytes: 26 },
          { id: "h5", kind: "String", body: '"gc"', bytes: 26 },
        ],
        note: "An array of strings means three allocations: the array, then each element. A compiler that interns string literals could share them.",
      },
      {
        line: 2,
        frames: [{ fn: "<script>", slots: [{ name: "user", val: "→ #1", ref: "h1" }, { name: "tags", val: "→ #3", ref: "h3" }, { name: "n", val: "42" }] }],
        heap: [
          { id: "h1", kind: "Object", body: "shape{name,age}  age: 36", bytes: 40, refs: ["h2"] },
          { id: "h2", kind: "String", body: '"ada"', bytes: 27 },
          { id: "h3", kind: "Array", body: "len 2", bytes: 48, refs: ["h4", "h5"] },
          { id: "h4", kind: "String", body: '"vm"', bytes: 26 },
          { id: "h5", kind: "String", body: '"gc"', bytes: 26 },
        ],
        note: "`n = 42` allocates nothing. Numbers are immediate values stored directly in the stack slot, like a Java `int`.",
      },
    ],
  },
  {
    name: "Function calls",
    source: ["fn area(w, h) {", "  let a = w * h", "  return a", "}", "let r = area(3, 4)"],
    snaps: [
      { line: 4, frames: [{ fn: "<script>", slots: [{ name: "area", val: "→ fn", ref: "f" }] }], heap: [{ id: "f", kind: "Closure", body: "area/2", bytes: 32 }], note: "Functions are heap objects (closures). The global slot points to one." },
      {
        line: 0,
        frames: [
          { fn: "<script>", slots: [{ name: "area", val: "→ fn", ref: "f" }] },
          { fn: "area", slots: [{ name: "w", val: "3" }, { name: "h", val: "4" }] },
        ],
        heap: [{ id: "f", kind: "Closure", body: "area/2", bytes: 32 }],
        note: "CALL pushes a new frame. The arguments the caller pushed become the callee's first locals, with no copy needed. The frame is a window over the shared value stack.",
      },
      {
        line: 1,
        frames: [
          { fn: "<script>", slots: [{ name: "area", val: "→ fn", ref: "f" }] },
          { fn: "area", slots: [{ name: "w", val: "3" }, { name: "h", val: "4" }, { name: "a", val: "12" }] },
        ],
        heap: [{ id: "f", kind: "Closure", body: "area/2", bytes: 32 }],
        note: "Locals are claimed on the stack as they're declared. Still nothing on the heap.",
      },
      {
        line: 4,
        frames: [{ fn: "<script>", slots: [{ name: "area", val: "→ fn", ref: "f" }, { name: "r", val: "12" }] }],
        heap: [{ id: "f", kind: "Closure", body: "area/2", bytes: 32 }],
        note: "RETURN pops the whole frame at once. Locals never need garbage collection, because the stack cleans up after itself.",
      },
    ],
  },
  {
    name: "Garbage",
    source: ["let a = { v: 1 }", "let b = { v: 2 }", "a = b", "gc()"],
    snaps: [
      { line: 0, frames: [{ fn: "<script>", slots: [{ name: "a", val: "→ #1", ref: "o1" }] }], heap: [{ id: "o1", kind: "Object", body: "v: 1", bytes: 32 }], note: "`a` references object #1." },
      {
        line: 1,
        frames: [{ fn: "<script>", slots: [{ name: "a", val: "→ #1", ref: "o1" }, { name: "b", val: "→ #2", ref: "o2" }] }],
        heap: [
          { id: "o1", kind: "Object", body: "v: 1", bytes: 32 },
          { id: "o2", kind: "Object", body: "v: 2", bytes: 32 },
        ],
        note: "Two objects, each reachable from a root.",
      },
      {
        line: 2,
        frames: [{ fn: "<script>", slots: [{ name: "a", val: "→ #2", ref: "o2" }, { name: "b", val: "→ #2", ref: "o2" }] }],
        heap: [
          { id: "o1", kind: "Object", body: "v: 1", bytes: 32, garbage: true },
          { id: "o2", kind: "Object", body: "v: 2", bytes: 32 },
        ],
        note: "Now nothing points to #1. It's unreachable, so it's garbage, but it still takes memory until the GC runs.",
      },
      {
        line: 3,
        frames: [{ fn: "<script>", slots: [{ name: "a", val: "→ #2", ref: "o2" }, { name: "b", val: "→ #2", ref: "o2" }] }],
        heap: [{ id: "o2", kind: "Object", body: "v: 2", bytes: 32 }],
        note: "The GC traces from the roots (stack slots), finds only #2, and frees #1.",
      },
    ],
  },
];

const kindColor: Record<string, string> = { Object: "#ec4899", String: "#10b981", Array: "#f59e0b", Closure: "#8b5cf6" };

export function HeapStackSim() {
  const [si, setSi] = useState(0);
  const [step, setStep] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const sc = scenarios[si];
  const snap = sc.snaps[step];
  const used = snap.heap.reduce((n, o) => n + o.bytes, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-faint">Scenario:</span>
        {scenarios.map((s, i) => (
          <SimButton
            key={s.name}
            variant={i === si ? "active" : "ghost"}
            onClick={() => {
              setSi(i);
              setStep(0);
            }}
          >
            {s.name}
          </SimButton>
        ))}
      </div>

      <Panel title="Wisp">
        <pre className="font-mono text-[12.5px] leading-6">
          {sc.source.map((l, i) => (
            <div key={i} className={`rounded px-2 ${i === snap.line ? "bg-violet/15 text-ink" : "text-muted"}`}>
              {l}
            </div>
          ))}
        </pre>
      </Panel>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
        <Panel title={<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue" />Value stack <span className="text-faint">· per fiber</span></span>}>
          <div className="flex min-h-[220px] flex-col-reverse gap-2">
            <AnimatePresence initial={false}>
              {snap.frames.map((f, fi) => (
                <motion.div
                  key={`${f.fn}-${fi}`}
                  layout
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  className={`rounded-lg border p-2 ${fi === snap.frames.length - 1 ? "border-blue/40 bg-blue/[0.06]" : "border-line bg-white/[0.02]"}`}
                >
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-blue-200">{f.fn}()</span>
                    {fi === snap.frames.length - 1 && <span className="text-[10px] text-faint">current frame</span>}
                  </div>
                  <div className="grid gap-1">
                    <AnimatePresence initial={false}>
                      {f.slots.map((s) => (
                        <motion.div
                          key={s.name}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          onMouseEnter={() => setHover(s.ref ?? null)}
                          onMouseLeave={() => setHover(null)}
                          className="flex items-center justify-between rounded border border-line bg-black/30 px-2 py-1 font-mono text-[11.5px]"
                        >
                          <span className="text-muted">{s.name}</span>
                          <span className={s.ref ? "text-pink-300" : "text-amber-300"}>{s.val}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {f.slots.length === 0 && <div className="text-[11px] text-faint">no locals yet</div>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Panel>

        <div className="hidden flex-col items-center justify-center gap-1 text-faint md:flex">
          <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
            →
          </motion.span>
          <span className="text-center font-mono text-[9.5px] leading-tight">
            refs
            <br />
            point
            <br />
            to heap
          </span>
        </div>

        <Panel
          title={<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pink" />Heap <span className="text-faint">· shared, GC-managed</span></span>}
          right={<span className="font-mono text-[10px] text-faint">{used} B</span>}
        >
          <div className="grid min-h-[220px] content-start gap-2 sm:grid-cols-2">
            <AnimatePresence>
              {snap.heap.map((o) => {
                const c = kindColor[o.kind];
                const hi = hover === o.id;
                return (
                  <motion.div
                    key={o.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: o.garbage ? 0.45 : 1, scale: hi ? 1.04 : 1 }}
                    exit={{ opacity: 0, scale: 0.6, filter: "blur(4px)" }}
                    transition={{ duration: 0.3 }}
                    className="rounded-lg border p-2"
                    style={{
                      borderColor: o.garbage ? "rgba(244,63,94,.5)" : hi ? c : `${c}55`,
                      background: o.garbage ? "rgba(244,63,94,.06)" : `${c}10`,
                      borderStyle: o.garbage ? "dashed" : "solid",
                    }}
                  >
                    <div className="flex items-center justify-between font-mono text-[10.5px]">
                      <span style={{ color: c }}>{o.kind}</span>
                      <span className="text-faint">#{o.id.replace(/\D/g, "") || "fn"} · {o.bytes}B</span>
                    </div>
                    <div className="mt-1 truncate font-mono text-[11.5px] text-ink">{o.body}</div>
                    {o.refs && <div className="mt-1 font-mono text-[10px] text-faint">refs → {o.refs.map((r) => "#" + r.replace(/\D/g, "")).join(", ")}</div>}
                    {o.garbage && <div className="mt-1 text-[10px] text-rose">unreachable</div>}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Panel>
      </div>

      <Note>
        <Rich text={snap.note} />
      </Note>
      <StepControls step={step} total={sc.snaps.length} onPrev={() => setStep((s) => s - 1)} onNext={() => setStep((s) => s + 1)} onReset={() => setStep(0)} />
    </div>
  );
}
