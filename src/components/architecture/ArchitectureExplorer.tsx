"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { Cpu, Maximize2, MousePointerClick } from "lucide-react";
import { archById, ArchGraph, ComponentGrid, GRAPH_H, GRAPH_W, NodeDetails } from "./ArchGraph";
import { VmCanvas } from "./VmCanvas";

export function ArchitectureExplorer() {
  const [selected, setSelectedState] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const node = selected ? archById[selected] : null;

  // When the panel is stacked under the graph, bring it into view on selection.
  const setSelected = (id: string | null) => {
    setSelectedState(id);
    if (id && window.innerWidth < 1280) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      {/* Graph */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[12px] text-muted">
            <span className="h-2 w-2 rounded-full bg-emerald animate-pulse-soft" />
            Wisp VM pipeline
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            <MousePointerClick className="h-3.5 w-3.5" /> click a node
          </span>
        </div>
        <div className="relative">
          {/* Floating "open canvas" button, pinned to the graph's top-left corner */}
          <button
            onClick={() => setCanvasOpen(true)}
            aria-label="Open the interactive canvas"
            title="Open the interactive canvas"
            className="group absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-line-strong bg-black/70 p-2.5 text-muted shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)] backdrop-blur-md transition hover:border-violet/50 hover:text-ink"
          >
            <Maximize2 className="h-4 w-4 transition group-hover:scale-110" />
            <span className="hidden pr-1 text-[12px] sm:inline">Open canvas</span>
          </button>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} className="block w-full min-w-[560px]">
              <ArchGraph selected={selected} hover={hover} onHover={setHover} onNodeClick={(id) => setSelected(selected === id ? null : id)} />
            </svg>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      <div ref={panelRef} className="card flex min-h-[520px] scroll-mt-24 flex-col overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
        <AnimatePresence mode="wait">
          {node ? (
            <motion.div key={node.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} className="flex-1 overflow-y-auto p-5">
              <NodeDetails node={node} />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex flex-col items-center px-6 pb-6 pt-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue/30 bg-blue/10 text-blue">
                  <Cpu className="h-5 w-5" />
                </span>
                <p className="mt-4 text-[14px] text-muted">Click any node in the diagram</p>
                <p className="mt-1 text-[12px] text-faint">You&apos;ll see its JVM counterpart and how to build it</p>
              </div>
              <div className="border-t border-line px-4 py-4 md:px-5">
                <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-faint">Components</div>
                <ComponentGrid onSelect={setSelected} onHover={setHover} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {node && (
          <button onClick={() => setSelected(null)} className="border-t border-line px-5 py-2.5 text-left text-[12px] text-faint transition hover:text-ink">
            ← All components
          </button>
        )}
      </div>

      <VmCanvas open={canvasOpen} onClose={() => setCanvasOpen(false)} />
    </div>
  );
}
