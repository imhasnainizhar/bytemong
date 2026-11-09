"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { SimButton } from "./ui";

const stages = [
  {
    name: "Source",
    color: "#8a8a96",
    who: "You",
    note: "Plain text. To the machine it's only characters, with no meaning yet.",
    render: () => (
      <pre className="font-mono text-[13px] leading-7 text-ink">
        <span className="text-violet-300">let</span> x = <span className="text-amber-300">2</span> * (<span className="text-amber-300">3</span> + <span className="text-amber-300">4</span>)
        {"\n"}
        <span className="text-sky-300">print</span> x
      </pre>
    ),
  },
  {
    name: "Tokens",
    color: "#4f8cff",
    who: "Lexer",
    note: "The lexer groups characters into tokens. Whitespace is gone, and each token remembers where it came from.",
    render: () => (
      <div className="flex flex-wrap gap-1.5">
        {["LET", "IDENT(x)", "EQ", "NUM(2)", "STAR", "LPAREN", "NUM(3)", "PLUS", "NUM(4)", "RPAREN", "NEWLINE", "PRINT", "IDENT(x)", "EOF"].map((t, i) => (
          <motion.span
            key={t + i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-md border border-blue/30 bg-blue/10 px-2 py-1 font-mono text-[11.5px] text-blue-200"
          >
            {t}
          </motion.span>
        ))}
      </div>
    ),
  },
  {
    name: "AST",
    color: "#8b5cf6",
    who: "Parser",
    note: "The parser builds a tree. Precedence is now structural: the + sits deeper than the *, so it is evaluated first.",
    render: () => (
      <svg viewBox="0 0 340 210" className="mx-auto w-full max-w-md">
        {[
          ["M180 23 L100 51", 0],
          ["M180 23 L280 51", 0.05],
          ["M280 69 L280 97", 0.1],
          ["M100 69 L100 97", 0.15],
          ["M100 115 L50 143", 0.2],
          ["M100 115 L150 143", 0.25],
          ["M150 161 L120 189", 0.3],
          ["M150 161 L180 189", 0.35],
        ].map(([d, del]) => (
          <motion.path key={d as string} d={d as string} stroke="rgba(139,92,246,.5)" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: del as number, duration: 0.4 }} />
        ))}
        {[
          [180, 14, "Program"],
          [100, 60, "Let x"],
          [280, 60, "Print"],
          [280, 106, "Var x"],
          [100, 106, "Mul"],
          [50, 152, "2"],
          [150, 152, "Add"],
          [120, 198, "3"],
          [180, 198, "4"],
        ].map(([x, y, l], i) => (
          <motion.g key={i} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}>
            <rect x={(x as number) - 26} y={(y as number) - 10} width="52" height="18" rx="5" fill="rgba(139,92,246,.14)" stroke="rgba(139,92,246,.45)" />
            <text x={x as number} y={(y as number) + 3} textAnchor="middle" fontSize="10" fill="#ddd6fe" fontFamily="var(--font-mono)">
              {l}
            </text>
          </motion.g>
        ))}
      </svg>
    ),
  },
  {
    name: "Bytecode",
    color: "#22d3ee",
    who: "Compiler",
    note: "The compiler flattens the tree in post-order: operands first, then the operator. This is what the VM actually runs.",
    render: () => (
      <div className="grid gap-1 font-mono text-[12px]">
        {[
          ["0000", "CONST", "2"],
          ["0003", "CONST", "3"],
          ["0006", "CONST", "4"],
          ["0009", "ADD", ""],
          ["000a", "MUL", ""],
          ["000b", "SET_GLOBAL", "'x'"],
          ["000e", "GET_GLOBAL", "'x'"],
          ["0011", "PRINT", ""],
        ].map(([o, op, a], i) => (
          <motion.div key={o} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-4">
            <span className="text-faint">{o}</span>
            <span className="w-28 text-cyan-300">{op}</span>
            <span className="text-amber-300">{a}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    name: "Execute",
    color: "#10b981",
    who: "VM",
    note: "The dispatch loop runs each instruction against the operand stack. 3 + 4 = 7, then 2 × 7 = 14.",
    render: () => (
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex flex-col-reverse gap-1">
          {["2", "7"].map((v, i) => (
            <motion.div key={v} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.3 }} className="w-20 rounded-md border border-emerald/40 bg-emerald/10 py-1.5 text-center font-mono text-[12px] text-emerald-200">
              {v}
            </motion.div>
          ))}
          <div className="text-center text-[10px] text-faint">stack before MUL</div>
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="rounded-lg border border-line bg-black/40 px-4 py-3 font-mono text-[13px]">
          <span className="text-faint">stdout › </span>
          <span className="text-emerald-300">14</span>
        </motion.div>
      </div>
    ),
  },
];

export function PipelineSim() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setI((x) => (x + 1) % stages.length), 3200);
    return () => clearInterval(t);
  }, [auto]);
  const s = stages[i];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-1.5">
        {stages.map((st, k) => (
          <button
            key={st.name}
            onClick={() => {
              setI(k);
              setAuto(false);
            }}
            className="group text-left"
          >
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div className="h-full" style={{ background: st.color }} initial={false} animate={{ width: k <= i ? "100%" : "0%" }} transition={{ duration: 0.5 }} />
            </div>
            <div className={`mt-2 text-[12px] font-medium ${k === i ? "text-ink" : "text-faint group-hover:text-muted"}`}>{st.name}</div>
            <div className="hidden font-mono text-[10px] text-faint sm:block">{st.who}</div>
          </button>
        ))}
      </div>
      <div className="min-h-[200px] rounded-xl border border-line bg-black/40 p-5">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {s.render()}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-[13px] leading-relaxed text-muted">
          <span className="font-medium" style={{ color: s.color }}>
            {s.who}:
          </span>{" "}
          {s.note}
        </p>
        <SimButton onClick={() => setAuto((a) => !a)}>{auto ? "Pause" : "Auto-play"}</SimButton>
        <SimButton
          variant="primary"
          onClick={() => {
            setAuto(false);
            setI((x) => (x + 1) % stages.length);
          }}
        >
          Next stage →
        </SimButton>
      </div>
    </div>
  );
}
