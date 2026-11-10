import {
  Binary,
  Braces,
  Cog,
  Cpu,
  FunctionSquare,
  Gauge,
  GitBranch,
  Layers,
  OctagonPause,
  Package,
  Play,
  Plug,
  Recycle,
  Rocket,
  Shapes,
  SquareTerminal,
  Zap,
  type LucideProps,
} from "lucide-react";

const icons = {
  Binary,
  Braces,
  Cog,
  Cpu,
  FunctionSquare,
  Gauge,
  GitBranch,
  Layers,
  OctagonPause,
  Package,
  Play,
  Plug,
  Recycle,
  Rocket,
  Shapes,
  SquareTerminal,
  Zap,
};

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = icons[name as keyof typeof icons] ?? Cpu;
  return <C {...props} />;
}
