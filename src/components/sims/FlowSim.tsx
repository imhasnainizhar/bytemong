"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { FlowStep } from "@/content";

export function FlowSim({ steps, color = "#8b5cf6" }: { steps: FlowStep[]; color?: string }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1300);
    return () => clearInterval(t);
  }, [steps.length]);

  return (
    <div className="flex flex-col items-stretch gap-0 md:flex-row md:items-center">
      {steps.map((s, i) => {
        const on = i === active;
        const done = i < active;
        return (
          <div key={s.label} className="flex flex-col items-center md:flex-1 md:flex-row">
            <motion.button
              onClick={() => setActive(i)}
              animate={{ scale: on ? 1.04 : 1 }}
              className="w-full rounded-xl border px-3 py-3 text-center transition-colors md:w-auto md:min-w-0 md:flex-1"
              style={{
                borderColor: on ? color : done ? `${color}55` : "rgba(255,255,255,0.08)",
                background: on ? `${color}1f` : "rgba(255,255,255,0.02)",
                boxShadow: on ? `0 0 24px -6px ${color}` : "none",
              }}
            >
              <div className="font-mono text-[10px] text-faint">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-0.5 text-[13px] font-semibold" style={{ color: on ? "#fff" : "#d4d4dc" }}>
                {s.label}
              </div>
              <div className="mt-1 truncate font-mono text-[10.5px] text-muted">{s.sub}</div>
            </motion.button>
            {i < steps.length - 1 && (
              <div className="relative h-6 w-px md:h-px md:w-8 md:shrink-0">
                <div className="absolute inset-0 bg-white/10" />
                <div
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ background: color, opacity: done || on ? 0.9 : 0, boxShadow: on ? `0 0 8px ${color}` : "none" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
