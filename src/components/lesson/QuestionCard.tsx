"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ChevronDown, Lightbulb, Microscope } from "lucide-react";
import type { Question } from "@/content";
import { Rich } from "../Rich";

export function QuestionCard({ q, index, color }: { q: Question; index: number; color: string }) {
  const [open, setOpen] = useState(index === 0);
  const [tab, setTab] = useState<"intuition" | "technical">("intuition");

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-4 p-5 text-left" aria-expanded={open}>
        <span className="mt-0.5 font-mono text-[12px]" style={{ color }}>
          Q{index + 1}
        </span>
        <span className="flex-1 text-[15px] font-medium leading-snug text-ink">
          <Rich text={q.q} />
        </span>
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <div className="px-5 pb-5">
              <div className="mb-3 inline-flex rounded-lg border border-line bg-black/40 p-0.5 text-[12px]">
                {(
                  [
                    ["intuition", "Intuition", Lightbulb],
                    ["technical", "Under the hood", Microscope],
                  ] as const
                ).map(([k, label, I]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${tab === k ? "text-ink" : "text-faint hover:text-muted"}`}
                  >
                    {tab === k && <motion.span layoutId={`qtab-${index}`} className="absolute inset-0 rounded-md bg-white/[0.07]" />}
                    <I className="relative h-3.5 w-3.5" />
                    <span className="relative">{label}</span>
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={tab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="text-[14px] leading-relaxed text-[#a9a9b4]"
                >
                  <Rich text={tab === "intuition" ? q.intuition : q.technical} />
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
