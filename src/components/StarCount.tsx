"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { site, githubUrl } from "@/lib/site";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export { GithubIcon };

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** 7 → "7", 1234 → "1.2k", 15678 → "15.7k", 1_250_000 → "1.3m" */
function format(n: number) {
  return compact.format(n).toLowerCase();
}

const CACHE_MS = 5 * 60 * 1000; // stay well under GitHub's 60 req/hour anonymous limit

export function StarCount() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const key = `stars:${site.repo}`;
    let cached: { n: number; at: number } | null = null;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) cached = JSON.parse(raw);
    } catch {}
    const fresh = cached && Date.now() - cached.at < CACHE_MS;
    const load: Promise<number | null> = fresh
      ? Promise.resolve(cached!.n)
      : fetch(`https://api.github.com/repos/${site.repo}`, { signal: ctrl.signal, headers: { Accept: "application/vnd.github+json" } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d && typeof d.stargazers_count === "number" ? d.stargazers_count : (cached?.n ?? null)));
    load
      .then((n) => {
        if (n === null || ctrl.signal.aborted) return;
        setStars(n);
        try {
          sessionStorage.setItem(key, JSON.stringify({ n, at: Date.now() }));
        } catch {}
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  return (
    <a
      href={githubUrl}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-center overflow-hidden rounded-lg border border-line bg-white/[0.03] text-[13px] text-ink transition hover:border-line-strong hover:bg-white/[0.05]"
    >
      <span className="flex items-center gap-2 px-3 py-1.5">
        <GithubIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Star</span>
      </span>
      <span className="flex items-center gap-1.5 border-l border-line px-3 py-1.5 font-mono text-[12px] text-muted group-hover:text-ink">
        <Star className="h-3.5 w-3.5 fill-amber/80 text-amber" />
        {stars === null ? "—" : format(stars)}
      </span>
    </a>
  );
}
