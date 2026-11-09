"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Note, SimButton } from "./ui";

type FState = "ready" | "running" | "parked" | "done";
type Fiber = { id: number; color: string; work: number; io: number; rounds: number; state: FState; carrier: number | null };

const COLORS = ["#4f8cff", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#22d3ee", "#f43f5e", "#a3e635"];
const CARRIERS = 2;

function Chip({ f }: { f: Fiber }) {
  return (
    <motion.div
      layout
      layoutId={`fiber-${f.id}`}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-[11px] font-semibold"
      style={{ borderColor: f.color, background: `${f.color}22`, color: f.color }}
    >
      F{f.id}
    </motion.div>
  );
}

const makeFibers = (): Fiber[] =>
  COLORS.map((c, i) => ({ id: i + 1, color: c, work: 2 + (i % 3), io: 0, rounds: 3, state: "ready", carrier: null }));

export function FibersSim() {
  const [fibers, setFibers] = useState<Fiber[]>(makeFibers);
  const [running, setRunning] = useState(true);
  const [pinning, setPinning] = useState(false);
  const [tick, setTick] = useState(0);
  const [blocked, setBlocked] = useState<Record<number, number>>({}); // carrier -> ticks left blocked (pinning)
  const ref = useRef({ fibers, blocked, pinning });
  useEffect(() => {
    ref.current = { fibers, blocked, pinning };
  });

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const { fibers: fs0, blocked: bl0, pinning: pin } = ref.current;
      const fs = fs0.map((f) => ({ ...f }));
      const bl = { ...bl0 };

      // I/O completion for parked fibers
      fs.forEach((f) => {
        if (f.state === "parked") {
          f.io -= 1;
          if (f.io <= 0) {
            if (pin && f.carrier !== null) {
              // pinned: it resumes on the same carrier it never left
              f.state = "running";
              f.work = 2 + (f.id % 3);
              delete bl[f.carrier];
            } else {
              f.state = "ready";
              f.carrier = null;
              f.work = 2 + (f.id % 3);
            }
          }
        }
      });

      // run fibers on carriers
      fs.forEach((f) => {
        if (f.state !== "running") return;
        f.work -= 1;
        if (f.work <= 0) {
          f.rounds -= 1;
          if (f.rounds <= 0) {
            f.state = "done";
            f.carrier = null;
          } else {
            f.state = "parked";
            f.io = 4;
            if (pin) bl[f.carrier!] = 4; // carrier stuck waiting on blocking I/O
            else f.carrier = null; // unmount: carrier is free
          }
        }
      });

      // schedule ready fibers onto free carriers
      for (let c = 0; c < CARRIERS; c++) {
        const busy = fs.some((f) => f.carrier === c && (f.state === "running" || (f.state === "parked" && pin)));
        if (busy || bl[c]) continue;
        const next = fs.find((f) => f.state === "ready");
        if (next) {
          next.state = "running";
          next.carrier = c;
        }
      }
      setFibers(fs);
      setBlocked(bl);
      setTick((x) => x + 1);
      if (fs.every((f) => f.state === "done")) setRunning(false);
    }, 520);
    return () => clearInterval(t);
  }, [running]);

  const reset = () => {
    setFibers(makeFibers());
    setBlocked({});
    setTick(0);
    setRunning(true);
  };

  const lane = (state: FState) => fibers.filter((f) => f.state === state);
  const doneCount = lane("done").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-black/40 p-3">
            <div className="mb-2 flex justify-between text-[11.5px] text-muted">
              <span>Ready queue</span>
              <span className="font-mono text-faint">{lane("ready").length}</span>
            </div>
            <div className="flex min-h-[36px] flex-wrap gap-1.5">
              {lane("ready").map((f) => (
                <Chip key={f.id} f={f} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-line bg-black/20 p-3">
            <div className="mb-2 flex justify-between text-[11.5px] text-muted">
              <span>{pinning ? "Blocked in I/O (still holding carrier)" : "Parked on I/O (heap, no carrier)"}</span>
              <span className="font-mono text-faint">{lane("parked").length}</span>
            </div>
            <div className="flex min-h-[36px] flex-wrap gap-1.5">
              {lane("parked")
                .filter((f) => !pinning || f.carrier === null)
                .map((f) => (
                  <Chip key={f.id} f={f} />
                ))}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-black/20 p-3">
            <div className="mb-2 flex justify-between text-[11.5px] text-muted">
              <span>Done</span>
              <span className="font-mono text-faint">
                {doneCount}/{fibers.length}
              </span>
            </div>
            <div className="flex min-h-[36px] flex-wrap gap-1.5 opacity-60">
              {lane("done").map((f) => (
                <Chip key={f.id} f={f} />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: CARRIERS }, (_, c) => {
            const on = fibers.find((f) => f.carrier === c && (f.state === "running" || (pinning && f.state === "parked")));
            const isBlocked = pinning && on?.state === "parked";
            return (
              <div key={c} className="rounded-xl border p-3 transition-colors" style={{ borderColor: isBlocked ? "rgba(244,63,94,.5)" : on ? "rgba(16,185,129,.4)" : "rgba(255,255,255,.08)", background: isBlocked ? "rgba(244,63,94,.06)" : "rgba(0,0,0,.4)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] text-ink">carrier-{c}</span>
                  <span className={`text-[10.5px] ${isBlocked ? "text-rose" : on ? "text-emerald-300" : "text-faint"}`}>{isBlocked ? "PINNED · idle CPU" : on ? "running" : "idle"}</span>
                </div>
                <div className="mt-3 flex h-12 items-center gap-3">
                  {on ? <Chip f={on} /> : <span className="text-[11px] text-faint">waiting for a ready fiber…</span>}
                  {on && !isBlocked && (
                    <div className="flex gap-1">
                      {Array.from({ length: on.work }, (_, k) => (
                        <motion.span key={k} className="h-2 w-2 rounded-full" style={{ background: on.color }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 0.8, delay: k * 0.1 }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-1 font-mono text-[10px] text-faint">OS thread {c}</div>
              </div>
            );
          })}
          <Note>
            {pinning
              ? "Pinned: a fiber blocked in native I/O can't unmount, so its carrier sits idle while ready fibers wait. This is what happened to Loom virtual threads inside synchronized blocks before JDK 24."
              : "Each fiber runs a little work, then waits on I/O. Instead of blocking the OS thread, it parks and the carrier picks up the next ready fiber. Eight fibers share two threads."}
          </Note>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SimButton variant="primary" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : "Run"}
        </SimButton>
        <SimButton variant={pinning ? "active" : "ghost"} onClick={() => {
            if (pinning) {
              setBlocked({});
              setFibers((fs) => fs.map((f) => (f.state === "parked" ? { ...f, carrier: null } : f)));
            }
            setPinning((p) => !p);
          }}>
          Blocking I/O (pinning): {pinning ? "on" : "off"}
        </SimButton>
        <SimButton onClick={reset}>Reset</SimButton>
        <span className="ml-auto font-mono text-[11px] text-faint">tick {tick}</span>
      </div>
    </div>
  );
}
