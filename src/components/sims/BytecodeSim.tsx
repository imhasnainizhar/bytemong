"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Note, Panel, SimButton } from "./ui";

type Ins = { op: string; arg?: number; jvm: string; desc: string };
type Program = { name: string; source: string[]; locals: string[]; code: Ins[]; lineOf: number[] };

const programs: Program[] = [
  {
    name: "Arithmetic",
    source: ["let a = 2", "let b = 3", "print a * b + 1"],
    locals: ["a", "b"],
    code: [
      { op: "PUSH", arg: 2, jvm: "iconst_2", desc: "Push the constant 2 onto the operand stack." },
      { op: "STORE", arg: 0, jvm: "istore_0", desc: "Pop the top value into local slot 0 (a)." },
      { op: "PUSH", arg: 3, jvm: "iconst_3", desc: "Push the constant 3." },
      { op: "STORE", arg: 1, jvm: "istore_1", desc: "Pop into local slot 1 (b)." },
      { op: "LOAD", arg: 0, jvm: "iload_0", desc: "Copy local 0 (a) onto the stack. Locals are read, not consumed." },
      { op: "LOAD", arg: 1, jvm: "iload_1", desc: "Copy local 1 (b) onto the stack." },
      { op: "MUL", jvm: "imul", desc: "Pop two values, push their product. The instruction needs no operands because the stack supplies them." },
      { op: "PUSH", arg: 1, jvm: "iconst_1", desc: "Push 1." },
      { op: "ADD", jvm: "iadd", desc: "Pop two, push the sum." },
      { op: "PRINT", jvm: "invokevirtual println", desc: "Pop and print. In Java this is a method call on System.out." },
      { op: "HALT", jvm: "return", desc: "Done. The frame is discarded along with its stack and locals." },
    ],
    lineOf: [0, 0, 1, 1, 2, 2, 2, 2, 2, 2, 2],
  },
  {
    name: "While loop",
    source: ["let sum = 0", "let i = 1", "while i < 4 {", "  sum = sum + i", "  i = i + 1", "}", "print sum"],
    locals: ["sum", "i"],
    code: [
      { op: "PUSH", arg: 0, jvm: "iconst_0", desc: "Push 0 for sum." },
      { op: "STORE", arg: 0, jvm: "istore_0", desc: "sum = 0" },
      { op: "PUSH", arg: 1, jvm: "iconst_1", desc: "Push 1 for i." },
      { op: "STORE", arg: 1, jvm: "istore_1", desc: "i = 1" },
      { op: "LOAD", arg: 1, jvm: "iload_1", desc: "Loop header: load i." },
      { op: "PUSH", arg: 4, jvm: "iconst_4", desc: "Push 4." },
      { op: "LT", jvm: "if_icmpge …", desc: "Pop two, push i < 4 as a boolean. (The JVM fuses compare-and-branch into one opcode.)" },
      { op: "JMP_IF_FALSE", arg: 17, jvm: "(fused above)", desc: "Pop the condition. If false, jump past the loop to 17." },
      { op: "LOAD", arg: 0, jvm: "iload_0", desc: "Load sum." },
      { op: "LOAD", arg: 1, jvm: "iload_1", desc: "Load i." },
      { op: "ADD", jvm: "iadd", desc: "sum + i" },
      { op: "STORE", arg: 0, jvm: "istore_0", desc: "Store back into sum." },
      { op: "LOAD", arg: 1, jvm: "iload_1", desc: "Load i." },
      { op: "PUSH", arg: 1, jvm: "iconst_1", desc: "Push 1." },
      { op: "ADD", jvm: "iadd", desc: "i + 1 (the JVM has a dedicated iinc for this exact pattern)." },
      { op: "STORE", arg: 1, jvm: "istore_1", desc: "Store into i." },
      { op: "LOOP", arg: 4, jvm: "goto 4", desc: "Jump backwards to the loop header. Back-edges like this are where VMs count hotness and poll for safepoints." },
      { op: "LOAD", arg: 0, jvm: "iload_0", desc: "Load sum." },
      { op: "PRINT", jvm: "invokevirtual println", desc: "Print it." },
      { op: "HALT", jvm: "return", desc: "Done." },
    ],
    lineOf: [0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 6, 6, 6],
  },
];

type State = { ip: number; stack: number[]; locals: (number | null)[]; out: string[]; halted: boolean; steps: number };

function exec(p: Program, s: State): State {
  if (s.halted) return s;
  const ins = p.code[s.ip];
  const stack = [...s.stack];
  const locals = [...s.locals];
  const out = [...s.out];
  let ip = s.ip + 1;
  let halted = false;
  switch (ins.op) {
    case "PUSH":
      stack.push(ins.arg!);
      break;
    case "STORE":
      locals[ins.arg!] = stack.pop()!;
      break;
    case "LOAD":
      stack.push(locals[ins.arg!] ?? 0);
      break;
    case "ADD": {
      const b = stack.pop()!, a = stack.pop()!;
      stack.push(a + b);
      break;
    }
    case "MUL": {
      const b = stack.pop()!, a = stack.pop()!;
      stack.push(a * b);
      break;
    }
    case "LT": {
      const b = stack.pop()!, a = stack.pop()!;
      stack.push(a < b ? 1 : 0);
      break;
    }
    case "JMP_IF_FALSE":
      if (!stack.pop()) ip = ins.arg!;
      break;
    case "LOOP":
      ip = ins.arg!;
      break;
    case "PRINT":
      out.push(String(stack.pop()));
      break;
    case "HALT":
      halted = true;
      ip = s.ip;
      break;
  }
  return { ip, stack, locals, out, halted, steps: s.steps + 1 };
}

const init = (p: Program): State => ({ ip: 0, stack: [], locals: p.locals.map(() => null), out: [], halted: false, steps: 0 });

export function BytecodeSim() {
  const [pi, setPi] = useState(0);
  const p = programs[pi];
  const [history, setHistory] = useState<State[]>([init(p)]);
  const [playing, setPlaying] = useState(false);
  const s = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const lastIns = prev ? p.code[prev.ip] : null;

  const step = () => setHistory((h) => (h[h.length - 1].halted ? h : [...h, exec(p, h[h.length - 1])]));

  useEffect(() => {
    if (!playing || s.halted) return;
    const t = setTimeout(step, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, s]);

  const switchProgram = (i: number) => {
    setPi(i);
    setHistory([init(programs[i])]);
    setPlaying(false);
  };

  const line = useMemo(() => p.lineOf[s.ip], [p, s.ip]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-faint">Program:</span>
        {programs.map((pr, i) => (
          <SimButton key={pr.name} variant={i === pi ? "active" : "ghost"} onClick={() => switchProgram(i)}>
            {pr.name}
          </SimButton>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.25fr_0.9fr]">
        <Panel title="Wisp source">
          <pre className="font-mono text-[12.5px] leading-6">
            {p.source.map((l, i) => (
              <div key={i} className={`rounded px-2 transition-colors ${i === line && !s.halted ? "bg-violet/15 text-ink" : "text-muted"}`}>
                {l}
              </div>
            ))}
          </pre>
        </Panel>

        <Panel title="Bytecode" right={<span className="font-mono text-[10px] text-faint">ip = {s.ip}</span>}>
          <div className="max-h-[300px] overflow-y-auto font-mono text-[12px]">
            {p.code.map((ins, i) => {
              const on = i === s.ip;
              return (
                <div key={i} className={`relative flex items-center gap-3 rounded px-2 py-[3px] transition-colors ${on ? "bg-cyan/12 text-ink" : "text-muted"}`}>
                  {on && <motion.span layoutId="ip" className="absolute left-0 top-0 h-full w-0.5 rounded bg-cyan" />}
                  <span className="w-5 text-right text-faint">{i}</span>
                  <span className={`w-28 ${on ? "text-cyan-300" : ""}`}>{ins.op}</span>
                  <span className="w-6 text-amber-300/90">{ins.arg ?? ""}</span>
                  <span className="hidden truncate text-[10.5px] text-faint sm:inline">{ins.jvm}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="grid gap-3">
          <Panel title="Operand stack">
            <div className="flex min-h-[120px] flex-col-reverse justify-start gap-1">
              <AnimatePresence initial={false}>
                {s.stack.map((v, i) => (
                  <motion.div
                    key={`${i}-${v}-${s.steps}`}
                    layout
                    initial={{ opacity: 0, y: -14, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.22 }}
                    className={`rounded-md border py-1.5 text-center font-mono text-[12.5px] ${i === s.stack.length - 1 ? "border-emerald/50 bg-emerald/12 text-emerald-200" : "border-line bg-white/[0.03] text-ink"}`}
                  >
                    {v}
                    {i === s.stack.length - 1 && <span className="ml-2 text-[9px] text-emerald/70">← top</span>}
                  </motion.div>
                ))}
              </AnimatePresence>
              {s.stack.length === 0 && <div className="py-6 text-center text-[11px] text-faint">empty</div>}
            </div>
          </Panel>
          <Panel title="Locals">
            <div className="grid gap-1 font-mono text-[12px]">
              {p.locals.map((n, i) => (
                <div key={n} className="flex items-center justify-between rounded border border-line bg-white/[0.02] px-2 py-1">
                  <span className="text-faint">
                    [{i}] <span className="text-muted">{n}</span>
                  </span>
                  <motion.span key={String(s.locals[i])} initial={{ scale: 1.4, color: "#fbbf24" }} animate={{ scale: 1, color: "#e8e8ee" }}>
                    {s.locals[i] ?? "—"}
                  </motion.span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Note>
          {lastIns ? (
            <>
              <span className="font-mono text-cyan-300">{lastIns.op}</span> <span className="text-faint">·</span> {lastIns.desc}
            </>
          ) : (
            "Press Step to execute one instruction at a time and watch the stack. Each instruction only ever touches the top of the stack."
          )}
        </Note>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-black/40 px-3 font-mono text-[12px]">
          <span className="text-faint">stdout ›</span>
          <span className="text-emerald-300">{s.out.join(" ") || " "}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SimButton onClick={() => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h))} disabled={history.length <= 1}>
          ← Back
        </SimButton>
        <SimButton variant="primary" onClick={step} disabled={s.halted}>
          Step →
        </SimButton>
        <SimButton onClick={() => setPlaying((x) => !x)} disabled={s.halted}>
          {playing ? "Pause" : "Run"}
        </SimButton>
        <SimButton onClick={() => switchProgram(pi)}>Reset</SimButton>
        <span className="ml-auto font-mono text-[11px] text-faint">{s.steps} instructions dispatched</span>
      </div>
    </div>
  );
}
