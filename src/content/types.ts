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

/** A video, book or article worth reading alongside a lesson. */
export interface Reference {
  title: string;
  by: string;
  url: string;
  kind: "video" | "playlist" | "book" | "article" | "spec";
  note?: string;
}

/** One step of the build-along: what to write, the code, and how the code works. */
export interface BuildStep {
  /** Starts a new group of steps, e.g. "Part 1 · The lexer". */
  section?: string;
  title: string;
  /** What we're about to write and why. */
  body: string;
  code?: CodeSnippet;
  /** "How it works": a walk through the code's logic, one idea per bullet. */
  explain?: string[];
  /** How the JVM does the same job. */
  jvm?: string;
  /** What you should see when you run it. */
  output?: string;
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
  build: {
    intro: string;
    /** What works at the end of this lesson. */
    milestone?: string;
    steps: BuildStep[];
  };
  questions: Question[];
  references?: Reference[];
}
