"use client";

import type { FlowStep, SimKey } from "@/content";
import { BytecodeSim } from "./BytecodeSim";
import { DispatchSim } from "./DispatchSim";
import { FibersSim } from "./FibersSim";
import { FlowSim } from "./FlowSim";
import { GcSim } from "./GcSim";
import { HeapStackSim } from "./HeapStackSim";
import { JitSim } from "./JitSim";
import { ModulesSim } from "./ModulesSim";
import { PipelineSim } from "./PipelineSim";
import { SafepointsSim } from "./SafepointsSim";
import { ShapesSim } from "./ShapesSim";
import { UpvaluesSim } from "./UpvaluesSim";

export function Simulation({ sim, flow, color }: { sim: SimKey; flow?: FlowStep[]; color?: string }) {
  switch (sim) {
    case "pipeline":
      return <PipelineSim />;
    case "bytecode":
      return <BytecodeSim />;
    case "heap-stack":
      return <HeapStackSim />;
    case "modules":
      return <ModulesSim />;
    case "dispatch":
      return <DispatchSim />;
    case "upvalues":
      return <UpvaluesSim />;
    case "shapes":
      return <ShapesSim />;
    case "gc":
      return <GcSim />;
    case "jit":
      return <JitSim />;
    case "fibers":
      return <FibersSim />;
    case "safepoints":
      return <SafepointsSim />;
    case "flow":
      return <FlowSim steps={flow ?? []} color={color} />;
  }
}
