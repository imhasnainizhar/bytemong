"use client";

import { useEffect, useRef, useState } from "react";
import { Note, SimButton } from "./ui";

type Th = { name: string; polls: number[]; color: string; note: string };

// Each thread's code is a 0..100 loop; polls are positions where it checks the safepoint flag.
const baseThreads: Th[] = [
  { name: "worker-1", polls: [10, 30, 50, 70, 90], color: "#4f8cff", note: "call-heavy code: polls on every CALL" },
  { name: "worker-2", polls: [5, 25, 45, 65, 85], color: "#8b5cf6", note: "loop with back-edge polls" },
  { name: "worker-3", polls: [20, 60], color: "#22d3ee", note: "few calls" },
  { name: "hot-loop", polls: [99], color: "#f59e0b", note: "counted loop, poll elided by the JIT" },
];

type Phase = "running" | "requested" | "stopped";

export function SafepointsSim() {
  const [stripMining, setStripMining] = useState(false);
  const threads = baseThreads.map((t) => (t.name === "hot-loop" && stripMining ? { ...t, polls: [15, 35, 55, 75, 95], note: "strip-mined loop: poll every N iterations" } : t));
  const [pos, setPos] = useState([0, 37, 72, 4]);
  const [parked, setParked] = useState<boolean[]>([false, false, false, false]);
  const [phase, setPhase] = useState<Phase>("running");
  const [ttsp, setTtsp] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const ref = useRef({ pos, parked, phase, threads, ttsp });
  useEffect(() => {
    ref.current = { pos, parked, phase, threads, ttsp };
  });

  useEffect(() => {
    const t = setInterval(() => {
      const { pos: p0, parked: pk0, phase: ph, threads: ths, ttsp: tt } = ref.current;
      if (ph === "stopped") return;
      const speeds = [1.4, 1.1, 0.9, 1.6];
      const pos2 = [...p0];
      const pk = [...pk0];
      ths.forEach((th, i) => {
        if (pk[i]) return;
        const before = pos2[i];
        let after = before + speeds[i];
        if (ph === "requested") {
          const poll = th.polls.find((q) => q > before && q <= after) ?? (after >= 100 ? th.polls.find((q) => q <= after - 100) : undefined);
          if (poll !== undefined) {
            pos2[i] = poll;
            pk[i] = true;
            return;
          }
        }
        if (after >= 100) after -= 100;
        pos2[i] = after;
      });
      setPos(pos2);
      setParked(pk);
      if (ph === "requested") {
        setTtsp(tt + 1);
        if (pk.every(Boolean)) {
          setPhase("stopped");
          setHistory((h) => [tt + 1, ...h].slice(0, 5));
          setTimeout(() => {
            setParked([false, false, false, false]);
            setPhase("running");
          }, 1500);
        }
      }
    }, 60);
    return () => clearInterval(t);
  }, []);

  const request = () => {
    setTtsp(0);
    setPhase("requested");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-black/40 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted">
            SAFEPOINT flag:{" "}
            <span className={phase === "running" ? "text-faint" : "text-amber-300"}>{phase === "running" ? "false" : "true"}</span>
          </span>
          <span className={`rounded-md px-2 py-0.5 text-[11px] ${phase === "stopped" ? "bg-rose/15 text-rose" : phase === "requested" ? "bg-amber/15 text-amber-300" : "bg-emerald/10 text-emerald-300"}`}>
            {phase === "stopped" ? "STOP-THE-WORLD · GC running" : phase === "requested" ? `waiting for threads… ${(ttsp * 6).toFixed(0)} ms` : "mutators running"}
          </span>
        </div>
        <div className="space-y-3">
          {threads.map((th, i) => (
            <div key={th.name}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-mono" style={{ color: th.color }}>
                  {th.name}
                </span>
                <span className="text-faint">{parked[i] ? <span className="text-emerald-300">parked at safepoint</span> : th.note}</span>
              </div>
              <div className="relative h-6 rounded-md bg-white/[0.04]">
                {th.polls.map((q) => (
                  <span key={q} className="absolute top-0 h-full w-px bg-white/30" style={{ left: `${q}%` }} title="safepoint poll">
                    <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/50" />
                  </span>
                ))}
                <span
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-[left] duration-75 ease-linear"
                  style={{
                    left: `${pos[i]}%`,
                    borderColor: th.color,
                    background: parked[i] ? th.color : `${th.color}33`,
                    boxShadow: `0 0 10px ${th.color}`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Note>
          Ticks mark <span className="text-ink">safepoint polls</span>: CALL, RETURN and loop back-edges. When the VM requests a safepoint, each thread keeps running until its
          next poll, then parks. The pause can&apos;t begin until the <span className="text-amber-300">slowest</span> thread arrives. That wait is called time-to-safepoint.
        </Note>
        <div className="rounded-lg border border-line bg-black/40 p-3 font-mono text-[11px]">
          <div className="text-muted">recent TTSP</div>
          {history.length === 0 && <div className="text-faint">—</div>}
          {history.map((h, i) => (
            <div key={i} className={i === 0 ? "text-ink" : "text-faint"}>
              {(h * 6).toFixed(0)} ms
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SimButton variant="primary" onClick={request} disabled={phase !== "running"}>
          Request safepoint (GC)
        </SimButton>
        <SimButton variant={stripMining ? "active" : "ghost"} onClick={() => setStripMining((s) => !s)} disabled={phase !== "running"}>
          Loop strip mining: {stripMining ? "on" : "off"}
        </SimButton>
      </div>
    </div>
  );
}
