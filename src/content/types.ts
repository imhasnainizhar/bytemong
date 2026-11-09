export type Level = "Foundational" | "Intermediate" | "Advanced";
export type Accent = "blue" | "violet" | "cyan" | "emerald" | "amber" | "pink" | "rose";

export type SimKey =
  | "pipeline"
  | "bytecode"
  | "heap-stack"
  | "modules"
  | "dispatch"
  | "upvalues"
  | "shapes"
  | "gc"
  | "jit"
  | "fibers"
  | "safepoints"
  | "flow";

export interface FlowStep {
  label: string;
  sub: string;
}

export interface CodeSnippet {
  lang: "rust" | "wisp" | "text" | "java";
  code: string;
  caption?: string;
}

export interface Question {
  q: string;
  /** A plain-language mental model. */
  intuition: string;
  /** The precise, implementation-level answer. */
  technical: string;
}

export interface Lesson {
  slug: string;
  title: string;
  level: Level;
  accent: Accent;
  icon: string;
  summary: string;
  tags: string[];
  intro: string[];
  sim: SimKey;
  simTitle: string;
  flow?: FlowStep[];
  jvm: { title: string; points: string[] };
  concepts: { heading: string; body: string[]; code?: CodeSnippet }[];
  build: { intro: string; steps: { title: string; body: string; code?: CodeSnippet }[] };
  questions: Question[];
}
