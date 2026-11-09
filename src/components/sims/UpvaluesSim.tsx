"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Note, Panel, StepControls } from "./ui";
import { Rich } from "../Rich";

const source = [
  "let counter = fn() {",
  "  let n = 0",
  "  let inc = fn() { n = n + 1; return n }",
  "  return inc",
  "}",
  "let next = counter()",
  "next()   // 1",
  "next()   // 2",
];

type Snap = {
  line: number;
  frames: { fn: string; slots: { name: string; val: string; captured?: boolean }[] }[];
  upvalue: null | { state: "open" | "closed"; value: string };
  closure: boolean;
  note: string;
};

const snaps: Snap[] = [
  {
    line: 5,
    frames: [{ fn: "<script>", slots: [{ name: "counter", val: "fn" }] }],
    upvalue: null,
    closure: false,
    note: "The script calls `counter()`. Nothing has been captured yet.",
  },
  {
    line: 1,
    frames: [
      { fn: "<script>", slots: [{ name: "counter", val: "fn" }] },
      { fn: "counter", slots: [{ name: "n", val: "0", captured: true }] },
    ],
    upvalue: null,
    closure: false,
    note: "`n` is an ordinary local in counter's frame, living on the stack. The resolver already knows an inner function captures it.",
  },
  {
    line: 2,
    frames: [
      { fn: "<script>", slots: [{ name: "counter", val: "fn" }] },
      { fn: "counter", slots: [{ name: "n", val: "0", captured: true }, { name: "inc", val: "closure" }] },
    ],
    upvalue: { state: "open", value: "→ stack[n]" },
    closure: true,
    note: "CLOSURE creates `inc` along with an open upvalue that points at n's stack slot. The value isn't copied. Writes through either path hit the same slot.",
  },
  {
    line: 3,
    frames: [{ fn: "<script>", slots: [{ name: "counter", val: "fn" }, { name: "next", val: "closure" }] }],
    upvalue: { state: "closed", value: "0" },
    closure: true,
    note: "RETURN is about to pop the frame, so the upvalue is closed first: the value 0 moves into the upvalue box on the heap. The stack slot is gone, but `n` survives.",
  },
  {
    line: 6,
    frames: [
      { fn: "<script>", slots: [{ name: "counter", val: "fn" }, { name: "next", val: "closure" }] },
      { fn: "inc", slots: [] },
    ],
    upvalue: { state: "closed", value: "1" },
    closure: true,
    note: "`next()` runs inc. GET_UPVALUE and SET_UPVALUE go through the closed box: n becomes 1.",
  },
  {
    line: 7,
    frames: [{ fn: "<script>", slots: [{ name: "counter", val: "fn" }, { name: "next", val: "closure" }] }],
    upvalue: { state: "closed", value: "2" },
    closure: true,
    note: "Called again, n becomes 2. The state persists across calls, which is how closures stand in for objects in a language without classes.",
  },
];

export function UpvaluesSim() {
  const [step, setStep] = useState(0);
  const s = snaps[step];
  const open = s.upvalue?.state === "open";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
        <Panel title="Wisp">
          <pre className="font-mono text-[12px] leading-6">
            {source.map((l, i) => (
              <div key={i} className={`rounded px-2 ${i === s.line ? "bg-pink/15 text-ink" : "text-muted"}`}>
                {l}
              </div>
            ))}
          </pre>
        </Panel>

        <Panel title="Value stack">
          <div className="flex min-h-[200px] flex-col-reverse gap-2">
            <AnimatePresence initial={false}>
              {s.frames.map((f, fi) => (
                <motion.div key={f.fn + fi} layout initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="rounded-lg border border-line bg-white/[0.02] p-2">
                  <div className="mb-1 font-mono text-[11px] text-blue-200">{f.fn}()</div>
                  {f.slots.map((sl) => {
                    const linked = sl.captured && open;
                    return (
                      <div
                        key={sl.name}
                        className="mb-1 flex items-center justify-between rounded border px-2 py-1 font-mono text-[11.5px] transition-colors"
                        style={{ borderColor: linked ? "#ec4899" : "rgba(255,255,255,.08)", background: linked ? "rgba(236,72,153,.1)" : "rgba(0,0,0,.3)" }}
                      >
                        <span className="text-muted">{sl.name}</span>
                        <span className="text-amber-300">{sl.val}</span>
                      </div>
                    );
                  })}
                  {f.slots.length === 0 && <div className="text-[10.5px] text-faint">(reads n via upvalue)</div>}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Panel>

        <Panel title="Heap">
          <div className="grid min-h-[200px] content-start gap-2">
            <AnimatePresence>
              {s.closure && (
                <motion.div key="closure" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="rounded-lg border border-violet/40 bg-violet/10 p-2">
                  <div className="font-mono text-[11px] text-violet-300">Closure · inc</div>
                  <div className="mt-1 font-mono text-[10.5px] text-faint">proto: fn inc/0 · upvalues[0] ↓</div>
                </motion.div>
              )}
              {s.upvalue && (
                <motion.div
                  key="up"
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border p-2"
                  style={{ borderColor: open ? "rgba(236,72,153,.6)" : "rgba(16,185,129,.5)", background: open ? "rgba(236,72,153,.08)" : "rgba(16,185,129,.08)" }}
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className={open ? "text-pink-300" : "text-emerald-300"}>Upvalue · n</span>
                    <span className={`rounded px-1.5 text-[9.5px] ${open ? "bg-pink/20 text-pink-200" : "bg-emerald/20 text-emerald-200"}`}>{s.upvalue.state.toUpperCase()}</span>
                  </div>
                  <motion.div key={s.upvalue.value} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="mt-1.5 font-mono text-[13px] text-ink">
                    {s.upvalue.value}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            {!s.closure && <div className="py-8 text-center text-[11px] text-faint">no closures yet</div>}
          </div>
        </Panel>
      </div>
      <Note>
        <Rich text={s.note} />
      </Note>
      <StepControls step={step} total={snaps.length} onPrev={() => setStep((x) => x - 1)} onNext={() => setStep((x) => x + 1)} onReset={() => setStep(0)} />
    </div>
  );
}
