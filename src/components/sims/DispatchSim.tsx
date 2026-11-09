"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Note, SimButton } from "./ui";

type Op = { op: string; quick?: string; arg?: string };
const loop: Op[] = [
  { op: "GET_LOCAL", arg: "i" },
  { op: "CONST", arg: "1" },
  { op: "ADD", quick: "ADD_NUM" },
  { op: "SET_LOCAL", arg: "i" },
  { op: "GET_LOCAL", arg: "i" },
  { op: "CONST", arg: "100" },
  { op: "LT", quick: "LT_NUM" },
  { op: "JUMP_IF_FALSE", arg: "+2" },
  { op: "LOOP", arg: "-9" },
];
const phases = ["fetch", "decode", "execute"] as const;
const phaseText = {
  fetch: "op = code[ip]; ip += 1",
  decode: "jump to handler for op",
  execute: "run the handler body",
};
const phaseColor = { fetch: "#4f8cff", decode: "#8b5cf6", execute: "#10b981" };

export function DispatchSim() {
  const [ip, setIp] = useState(0);
  const [phase, setPhase] = useState(0);
  const [running, setRunning] = useState(true);
  const [quicken, setQuicken] = useState(true);
  const [seen, setSeen] = useState<Record<number, number>>({});
  const [quickened, setQuickened] = useState<Record<number, boolean>>({});
  const [flash, setFlash] = useState<number | null>(null);
  const [stats, setStats] = useState({ dispatched: 0, slow: 0, fast: 0 });
  const [speed, setSpeed] = useState(380);
  const state = useRef({ ip, phase, seen, quickened, quicken });
  useEffect(() => {
    state.current = { ip, phase, seen, quickened, quicken };
  });

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const s = state.current;
      if (s.phase < 2) {
        setPhase(s.phase + 1);
        return;
      }
      // execute completed
      const ins = loop[s.ip];
      if (ins.quick) {
        const isQuick = s.quickened[s.ip];
        setStats((st) => ({ ...st, dispatched: st.dispatched + 1, slow: st.slow + (isQuick ? 0 : 1), fast: st.fast + (isQuick ? 1 : 0) }));
        const n = (s.seen[s.ip] ?? 0) + 1;
        setSeen({ ...s.seen, [s.ip]: n });
        if (s.quicken && !isQuick && n >= 2) {
          setQuickened({ ...s.quickened, [s.ip]: true });
          setFlash(s.ip);
          setTimeout(() => setFlash(null), 900);
        }
      } else setStats((st) => ({ ...st, dispatched: st.dispatched + 1 }));
      setPhase(0);
      setIp((s.ip + 1) % loop.length);
    }, speed);
    return () => clearInterval(t);
  }, [running, speed]);

  const reset = () => {
    setIp(0);
    setPhase(0);
    setSeen({});
    setQuickened({});
    setStats({ dispatched: 0, slow: 0, fast: 0 });
  };

  const cur = phases[phase];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* The loop ring */}
        <div className="relative mx-auto aspect-square w-full max-w-[280px]">
          <svg viewBox="0 0 200 200" className="absolute inset-0">
            <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            <motion.circle
              cx="100"
              cy="100"
              r="78"
              fill="none"
              stroke={phaseColor[cur]}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(2 * Math.PI * 78) / 3 - 6} ${2 * Math.PI * 78}`}
              animate={{ rotate: phase * 120 - 90 }}
              transition={{ type: "spring", stiffness: 140, damping: 18 }}
              style={{ transformOrigin: "100px 100px", filter: `drop-shadow(0 0 6px ${phaseColor[cur]})` }}
            />
          </svg>
          {phases.map((p, i) => {
            const a = (i * 120 + 60 - 90) * (Math.PI / 180);
            return (
              <div
                key={p}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors"
                style={{
                  left: `${50 + Math.cos(a) * 47}%`,
                  top: `${50 + Math.sin(a) * 47}%`,
                  color: i === phase ? "#fff" : "#55555f",
                  background: i === phase ? `${phaseColor[p]}33` : "#030304",
                }}
              >
                {p}
              </div>
            );
          })}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="font-mono text-[10px] text-faint">ip = {ip}</div>
            <motion.div key={ip + String(quickened[ip])} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`mt-1 font-mono text-[15px] font-semibold ${quickened[ip] ? "text-emerald-300" : "text-ink"}`}>
              {quickened[ip] ? loop[ip].quick : loop[ip].op}
            </motion.div>
            <div className="mt-1 max-w-[130px] font-mono text-[9.5px] leading-tight text-muted">{phaseText[cur]}</div>
          </div>
        </div>

        {/* The bytecode tape */}
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-black/40 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-faint">
              <span>loop body · while i &lt; 100 {"{ i = i + 1 }"}</span>
              <span className="font-mono">bytecode</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {loop.map((ins, i) => {
                const q = quickened[i];
                return (
                  <motion.div
                    key={i}
                    animate={{ y: i === ip ? -3 : 0, scale: flash === i ? [1, 1.15, 1] : 1 }}
                    className="relative rounded-md border px-2 py-1.5 font-mono text-[11px]"
                    style={{
                      borderColor: i === ip ? phaseColor[cur] : q ? "rgba(16,185,129,.4)" : "rgba(255,255,255,.08)",
                      background: i === ip ? `${phaseColor[cur]}1c` : q ? "rgba(16,185,129,.08)" : "rgba(255,255,255,.02)",
                      color: q ? "#6ee7b7" : i === ip ? "#fff" : "#a1a1aa",
                    }}
                  >
                    {q ? ins.quick : ins.op}
                    {ins.arg && <span className="ml-1 text-amber-300/80">{ins.arg}</span>}
                    {flash === i && (
                      <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: -18 }} className="absolute -top-1 left-0 whitespace-nowrap text-[9px] text-emerald-300">
                        rewritten!
                      </motion.span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["dispatches", stats.dispatched, "#e8e8ee"],
              ["slow-path type checks", stats.slow, "#f59e0b"],
              ["fast-path (quickened)", stats.fast, "#10b981"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-lg border border-line bg-white/[0.02] p-2.5">
                <div className="font-mono text-[18px] font-semibold" style={{ color: c as string }}>
                  {v}
                </div>
                <div className="text-[10.5px] text-faint">{l}</div>
              </div>
            ))}
          </div>
          <Note>
            A generic <span className="font-mono text-ink">ADD</span> must check whether its operands are numbers, strings or something else. With quickening on, after it
            has seen numbers twice the interpreter rewrites the opcode byte in place to <span className="font-mono text-emerald-300">ADD_NUM</span>, which skips those checks. HotSpot
            does the same with its &quot;fast&quot; bytecodes.
          </Note>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SimButton variant="primary" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : "Run"}
        </SimButton>
        <SimButton variant={quicken ? "active" : "ghost"} onClick={() => setQuicken((q) => !q)}>
          Quickening: {quicken ? "on" : "off"}
        </SimButton>
        <SimButton onClick={reset}>Reset</SimButton>
        <label className="ml-auto flex items-center gap-2 text-[11px] text-faint">
          speed
          <input type="range" min={120} max={800} step={20} value={920 - speed} onChange={(e) => setSpeed(920 - Number(e.target.value))} className="accent-violet" />
        </label>
      </div>
    </div>
  );
}
