"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Note, SimButton } from "./ui";

const PHASES = ["Locate", "Load", "Verify", "Link", "Init"] as const;
type Mod = { name: string; from: string };

type Ev =
  | { kind: "phase"; mod: string; phase: number; msg: string }
  | { kind: "hit"; mod: string; msg: string }
  | { kind: "done"; mod: string; msg: string };

const mods: Mod[] = [
  { name: "main", from: "./main.wisp" },
  { name: "std/io", from: "<builtin>" },
  { name: "util", from: "./util.wisp" },
];

const events: Ev[] = [
  { kind: "phase", mod: "main", phase: 0, msg: "Run `wisp main.wisp`: locate the entry module." },
  { kind: "phase", mod: "main", phase: 1, msg: "No fresh main.wispc cache, so compile the source to bytecode." },
  { kind: "phase", mod: "main", phase: 2, msg: "Trusted compiler output, so only cheap checks run (header, constant counts)." },
  { kind: "phase", mod: "main", phase: 3, msg: "Mark the module Loading in the cache. Names stay symbolic until first use." },
  { kind: "phase", mod: "main", phase: 4, msg: 'Run the body. First line: import "std/io".' },
  { kind: "phase", mod: "std/io", phase: 0, msg: "std/* resolves to built-ins first (parent delegation). A local io.wisp can't shadow it." },
  { kind: "phase", mod: "std/io", phase: 1, msg: "Load the native module table: print, read, write." },
  { kind: "phase", mod: "std/io", phase: 2, msg: "Built-ins are trusted, nothing to verify." },
  { kind: "phase", mod: "std/io", phase: 3, msg: "Bind native functions into the exports object." },
  { kind: "phase", mod: "std/io", phase: 4, msg: "Initialize once and mark Loaded." },
  { kind: "done", mod: "std/io", msg: "std/io ready. Back in main: import \"util\"." },
  { kind: "phase", mod: "util", phase: 0, msg: "Search ./ for util.wisp." },
  { kind: "phase", mod: "util", phase: 1, msg: "Found util.wispc newer than its source, so load the cached bytecode." },
  { kind: "phase", mod: "util", phase: 2, msg: "Bytecode from disk is untrusted: check magic, version, jump targets and stack depth." },
  { kind: "phase", mod: "util", phase: 3, msg: "Mark util Loading." },
  { kind: "phase", mod: "util", phase: 4, msg: 'Run util\'s body. It also does import "std/io"…' },
  { kind: "hit", mod: "std/io", msg: "Cache hit: std/io is already Loaded, so the same module object is returned. No second init." },
  { kind: "done", mod: "util", msg: "util Loaded. Its exports go back to main." },
  { kind: "done", mod: "main", msg: "main finishes initializing. On first call, GET_GLOBAL \"print\" resolves and is rewritten to a direct slot access." },
];

export function ModulesSim() {
  const [i, setI] = useState(-1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || i >= events.length - 1) return;
    const t = setTimeout(() => setI((x) => x + 1), 1100);
    return () => clearTimeout(t);
  }, [playing, i]);

  const progress: Record<string, number> = {};
  const done: Record<string, boolean> = {};
  let hit: string | null = null;
  events.slice(0, i + 1).forEach((e, k) => {
    if (e.kind === "phase") progress[e.mod] = e.phase;
    if (e.kind === "done") done[e.mod] = true;
    if (e.kind === "hit" && k === i) hit = e.mod;
  });
  const current = i >= 0 ? events[i] : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {mods.map((m) => {
          const p = progress[m.name];
          const active = current?.mod === m.name;
          const isDone = !!done[m.name];
          return (
            <motion.div
              key={m.name}
              animate={{ scale: hit === m.name ? [1, 1.04, 1] : 1 }}
              className="rounded-xl border p-3 transition-colors"
              style={{
                borderColor: hit === m.name ? "#22d3ee" : active ? "rgba(139,92,246,.5)" : "rgba(255,255,255,.08)",
                background: active ? "rgba(139,92,246,.06)" : "rgba(0,0,0,.3)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[13px] text-ink">{m.name}</span>
                <span
                  className={`rounded px-1.5 py-px text-[10px] ${
                    isDone ? "bg-emerald/15 text-emerald-300" : p !== undefined ? "bg-amber/15 text-amber-300" : "bg-white/5 text-faint"
                  }`}
                >
                  {isDone ? "Loaded" : p !== undefined ? "Loading" : "—"}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-faint">{m.from}</div>
              <div className="mt-3 grid grid-cols-5 gap-1">
                {PHASES.map((ph, k) => {
                  const reached = p !== undefined && k <= p;
                  const now = active && current?.kind === "phase" && k === p;
                  return (
                    <div key={ph}>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div className="h-full bg-gradient-to-r from-violet to-blue" initial={false} animate={{ width: reached ? "100%" : "0%" }} transition={{ duration: 0.4 }} />
                      </div>
                      <div className={`mt-1 text-center text-[9.5px] ${now ? "text-ink" : reached ? "text-muted" : "text-faint"}`}>{ph}</div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <div className="min-h-[86px] rounded-lg border border-line bg-black/40 p-3">
          <AnimatePresence mode="wait">
            <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] leading-relaxed text-muted">
              {current ? (
                <>
                  <span className="font-mono text-violet-300">[{current.mod}]</span> {current.msg}
                </>
              ) : (
                "Press Play to follow `wisp main.wisp`, which imports std/io and util, and util also imports std/io."
              )}
            </motion.p>
          </AnimatePresence>
        </div>
        <Note>
          <span className="text-ink">Module cache</span>
          <div className="mt-1.5 grid gap-1 font-mono text-[11px]">
            {mods.map((m) => (
              <div key={m.name} className="flex justify-between">
                <span>{m.name}</span>
                <span className={done[m.name] ? "text-emerald-300" : progress[m.name] !== undefined ? "text-amber-300" : "text-faint"}>
                  {done[m.name] ? "Loaded" : progress[m.name] !== undefined ? "Loading" : "absent"}
                </span>
              </div>
            ))}
          </div>
        </Note>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SimButton onClick={() => setI((x) => Math.max(-1, x - 1))} disabled={i < 0}>
          ← Back
        </SimButton>
        <SimButton variant="primary" onClick={() => setI((x) => Math.min(events.length - 1, x + 1))} disabled={i >= events.length - 1}>
          Step →
        </SimButton>
        <SimButton onClick={() => setPlaying((p) => !p)} disabled={i >= events.length - 1}>
          {playing ? "Pause" : "Play"}
        </SimButton>
        <SimButton
          onClick={() => {
            setI(-1);
            setPlaying(false);
          }}
        >
          Reset
        </SimButton>
        <span className="ml-auto font-mono text-[11px] text-faint">
          event {i + 1}/{events.length}
        </span>
      </div>
    </div>
  );
}
