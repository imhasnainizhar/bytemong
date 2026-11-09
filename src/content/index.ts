import { foundationLessons } from "./lessons-foundations";
import { runtimeLessons } from "./lessons-runtime";
import { advancedLessons } from "./lessons-advanced";
import type { Accent, Lesson, Level } from "./types";

export * from "./types";

export const lessons: Lesson[] = [...foundationLessons, ...runtimeLessons, ...advancedLessons];

export interface RoadmapItem {
  num: string;
  slug: string;
  href: string;
  title: string;
  level: Level;
  accent: Accent;
  icon: string;
  summary: string;
  tags: string[];
}

const architectureStop = {
  slug: "architecture",
  href: "/architecture",
  title: "VM Architecture",
  level: "Foundational" as Level,
  accent: "violet" as Accent,
  icon: "Cpu",
  summary: "See how every subsystem connects, and how to build each one yourself.",
  tags: ["Loader", "Runtime Areas", "Interpreter", "GC", "Native Bridge"],
};

export const roadmap: RoadmapItem[] = (() => {
  const items = lessons.map((l) => ({
    slug: l.slug,
    href: `/learn/${l.slug}`,
    title: l.title,
    level: l.level,
    accent: l.accent,
    icon: l.icon,
    summary: l.summary,
    tags: l.tags,
  }));
  items.splice(1, 0, architectureStop);
  return items.map((it, i) => ({ ...it, num: String(i).padStart(2, "0") }));
})();

export function getLesson(slug: string) {
  return lessons.find((l) => l.slug === slug);
}

/** Previous / next stops along the roadmap for a given slug. */
export function neighbours(slug: string) {
  const i = roadmap.findIndex((r) => r.slug === slug);
  return { prev: i > 0 ? roadmap[i - 1] : undefined, next: i >= 0 && i < roadmap.length - 1 ? roadmap[i + 1] : undefined };
}

export const accentHex: Record<Accent, string> = {
  blue: "#4f8cff",
  violet: "#8b5cf6",
  cyan: "#22d3ee",
  emerald: "#10b981",
  amber: "#f59e0b",
  pink: "#ec4899",
  rose: "#f43f5e",
};
