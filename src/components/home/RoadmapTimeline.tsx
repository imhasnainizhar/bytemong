"use client";

import Link from "next/link";
import { motion, useScroll, useSpring } from "motion/react";
import { useRef } from "react";
import { ChevronRight } from "lucide-react";
import { accentHex, type RoadmapItem } from "@/content";
import { Icon } from "../Icon";

const levelStyle: Record<string, string> = {
  Foundational: "text-blue border-blue/30 bg-blue/10",
  Intermediate: "text-amber border-amber/30 bg-amber/10",
  Advanced: "text-rose border-rose/30 bg-rose/10",
};

export function RoadmapTimeline({ items }: { items: RoadmapItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <div ref={ref} className="relative">
      {/* spine */}
      <div className="absolute bottom-0 left-4 top-0 w-px bg-line md:left-1/2" />
      <motion.div
        style={{ scaleY }}
        className="absolute bottom-0 left-4 top-0 w-px origin-top bg-gradient-to-b from-blue via-violet to-pink md:left-1/2"
      />
      <ol className="space-y-8 md:space-y-4">
        {items.map((it, i) => {
          const left = i % 2 === 0;
          const color = accentHex[it.accent];
          return (
            <li key={it.slug} className="relative md:grid md:grid-cols-2 md:gap-16">
              {/* dot */}
              <motion.span
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="absolute left-4 top-8 z-10 -ml-[5px] h-[11px] w-[11px] rounded-full ring-4 ring-bg md:left-1/2"
                style={{ background: color, boxShadow: `0 0 14px ${color}` }}
              />
              <motion.div
                initial={{ opacity: 0, x: left ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className={`pl-10 md:pl-0 ${left ? "md:col-start-1" : "md:col-start-2"}`}
              >
                <Link href={it.href} className="card card-hover group flex gap-4 p-5 hover:-translate-y-0.5">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                    style={{ borderColor: `${color}40`, background: `${color}14`, color }}
                  >
                    <Icon name={it.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-faint">{it.num}</span>
                      <span className={`rounded-md border px-1.5 py-px text-[10px] font-medium ${levelStyle[it.level]}`}>{it.level}</span>
                    </div>
                    <h3 className="mt-1.5 text-[16px] font-semibold text-ink">{it.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{it.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {it.tags.map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </motion.div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
