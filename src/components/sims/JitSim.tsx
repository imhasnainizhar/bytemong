"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Note, SimButton } from "./ui";

const TIERS = [
  { name: "Interpreter", short: "T0", color: "#8a8a96", cost: 100, at: 0 },
  { name: "Baseline JIT", short: "T1", color: "#4f8cff", cost: 30, at: 50 },
  { name: "Optimizing JIT", short: "T2", color: "#10b981", cost: 6, at: 300 },
];

type Fn = { name: string; sig: string; calls: number; tier: number; compiling: boolean; deopts: number; spec?: string };

const initFns = (): Fn[] => [
  { name: "add", sig: "fn(a, b) { a + b }", calls: 0, tier: 0, compiling: false, deopts: 0 },
  { name: "fib", sig: "fn(n) { … fib(n-1) + fib(n-2) }", calls: 0, tier: 0, compiling: false, deopts: 0 },
  { name: "main", sig: "fn() { setup(); run() }", calls: 0, tier: 0, compiling: false, deopts: 0 },
];

export function JitSim() {
  const [fns, setFns] = useState<Fn[]>(initFns);
  const [log, setLog] = useState<string[]>(["All functions start in the interpreter, which counts every call."]);
  const [timeUnits, setTimeUnits] = useState(0);
  const push = (m: string) => setLog((l) => [m, ...l].slice(0, 5));

  const call = (idx: number, n: number) => {
    const f = fns[idx];
    if (f.compiling) return;
    const calls = f.calls + n;
    const nextTier = TIERS[f.tier + 1];
    const compiling = !!nextTier && calls >= nextTier.at;
    setTimeUnits((t) => t + n * TIERS[f.tier].cost);
    setFns((all) => all.map((g, i) => (i === idx ? { ...g, calls, compiling } : g)));
    if (compiling) {
      const target = f.tier + 1;
      setTimeout(() => {
        setFns((cur) => cur.map((g, k) => (k === idx ? { ...g, tier: target, compiling: false, spec: target === 2 && g.name === "add" ? "a, b are numbers" : g.spec } : g)));
        push(`${f.name} reached ${TIERS[target].at} calls → compiled at ${TIERS[target].name}${target === 2 ? ", speculating on observed types" : ""}.`);
      }, 700);
    }
  };

  const deopt = (idx: number) => {
    const f = fns[idx];
    if (f.tier < 2) return;
    setFns((all) => all.map((g, i) => (i === idx ? { ...g, tier: 1, deopts: g.deopts + 1, calls: TIERS[1].at, spec: undefined } : g)));
    push(`${f.name}("a", "b"): guard failed (string, not number). Deoptimized to ${TIERS[1].name}; it will re-profile and recompile.`);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {fns.map((f, i) => {
          const t = TIERS[f.tier];
          const next = TIERS[f.tier + 1];
          const pct = next ? Math.min(100, ((f.calls - t.at) / (next.at - t.at)) * 100) : 100;
          return (
            <div key={f.name} className="rounded-xl border border-line bg-black/40 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[160px] flex-1">
                  <div className="font-mono text-[13px] text-ink">{f.name}</div>
                  <div className="truncate font-mono text-[10.5px] text-faint">{f.sig}</div>
                </div>
                <div className="flex gap-1">
                  {TIERS.map((tt, k) => (
                    <motion.span
                      key={tt.short}
                      animate={{ scale: k === f.tier ? 1.08 : 1 }}
                      className="rounded-md border px-2 py-0.5 font-mono text-[10.5px]"
                      style={{
                        borderColor: k === f.tier ? tt.color : "rgba(255,255,255,.08)",
                        color: k <= f.tier ? tt.color : "#55555f",
                        background: k === f.tier ? `${tt.color}1a` : "transparent",
                      }}
                    >
                      {tt.short}
                    </motion.span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <SimButton onClick={() => call(i, 1)} disabled={f.compiling}>
                    call
                  </SimButton>
                  <SimButton variant="primary" onClick={() => call(i, 25)} disabled={f.compiling}>
                    ×25
                  </SimButton>
                  {f.name === "add" && (
                    <SimButton onClick={() => deopt(i)} disabled={f.tier < 2} className="border-rose/40 text-rose hover:text-rose">
                      add(&quot;a&quot;,&quot;b&quot;)
                    </SimButton>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div className="h-full rounded-full" style={{ background: next?.color ?? t.color }} animate={{ width: `${pct}%` }} />
                </div>
                <span className="w-44 text-right font-mono text-[10.5px] text-faint">
                  {f.compiling ? (
                    <span className="text-amber-300">compiling…</span>
                  ) : next ? (
                    `${f.calls}/${next.at} calls → ${next.short}`
                  ) : (
                    <span className="text-emerald-300">{f.calls} calls · peak tier</span>
                  )}
                </span>
              </div>
              <AnimatePresence>
                {(f.spec || f.deopts > 0) && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 flex gap-3 font-mono text-[10.5px]">
                    {f.spec && <span className="text-emerald-300/80">guard: {f.spec}</span>}
                    {f.deopts > 0 && <span className="text-rose">deopts: {f.deopts}</span>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
        <Note>
          Cost per call: <span className="text-ink">interpreter 100</span> · <span className="text-blue-300">baseline 30</span> · <span className="text-emerald-300">optimized 6</span> time units.
          Total spent: <span className="font-mono text-ink">{timeUnits.toLocaleString()}</span>. Compiling isn&apos;t free, which is why the thresholds exist. Cold code would never repay the
          compile time.
        </Note>
        <div className="rounded-lg border border-line bg-black/40 p-3 font-mono text-[11.5px]">
          {log.map((l, i) => (
            <div key={l + i} className={i === 0 ? "text-ink" : "text-faint"}>
              › {l}
            </div>
          ))}
        </div>
      </div>
      <div className="flex">
        <SimButton
          onClick={() => {
            setFns(initFns());
            setTimeUnits(0);
            setLog(["Reset."]);
          }}
        >
          Reset
        </SimButton>
      </div>
    </div>
  );
}
