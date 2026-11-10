import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, Suspense } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Coffee, ExternalLink, FileText, Flag, Hammer, HelpCircle, Lightbulb, ListVideo, PlayCircle } from "lucide-react";
import { accentHex, getLesson, lessons, neighbours, roadmap, type Reference } from "@/content";
import { CodeBlock } from "@/components/CodeBlock";
import { Icon } from "@/components/Icon";
import { Reveal } from "@/components/Reveal";
import { Rich } from "@/components/Rich";
import { QuestionCard } from "@/components/lesson/QuestionCard";
import { Simulation } from "@/components/sims/Simulation";

export function generateStaticParams() {
  return lessons.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const l = getLesson(slug);
  return l ? { title: l.title, description: l.summary } : {};
}

export default function LessonPage({ params }: PageProps<"/learn/[slug]">) {
  return (
    <Suspense fallback={<LessonSkeleton />}>
      <Lesson params={params} />
    </Suspense>
  );
}

const refIcon = { video: PlayCircle, playlist: ListVideo, book: BookOpen, article: FileText, spec: FileText } as const;

function References({ refs }: { refs: Reference[] }) {
  return (
    <div className="mt-8 max-w-3xl">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">Watch &amp; read alongside</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {refs.map((r) => {
          const I = refIcon[r.kind];
          return (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="group flex gap-3 rounded-lg border border-line bg-white/[0.02] p-3 transition hover:border-line-strong hover:bg-white/[0.04]"
            >
              <I className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[13.5px] font-medium text-ink">
                  <span className="truncate">{r.title}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-faint transition group-hover:text-ink" />
                </span>
                <span className="mt-0.5 block text-[12px] text-faint">
                  {r.by} · {r.kind}
                </span>
                {r.note && <span className="mt-1 block text-[12.5px] leading-snug text-muted">{r.note}</span>}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function LessonSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 pt-28 sm:px-6 lg:pt-32" aria-hidden>
      <div className="h-3 w-20 rounded bg-white/5" />
      <div className="mt-8 h-6 w-48 rounded-full bg-white/5" />
      <div className="mt-6 h-12 w-2/3 rounded-lg bg-white/[0.06]" />
      <div className="mt-6 space-y-3">
        <div className="h-3 w-full max-w-3xl rounded bg-white/5" />
        <div className="h-3 w-5/6 max-w-3xl rounded bg-white/5" />
        <div className="h-3 w-4/6 max-w-3xl rounded bg-white/5" />
      </div>
      <div className="card mt-12 h-[420px]" />
    </div>
  );
}

async function Lesson({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();
  const color = accentHex[lesson.accent];
  const { prev, next } = neighbours(slug);
  const num = roadmap.find((r) => r.slug === slug)?.num ?? "";

  return (
    <article className="mx-auto max-w-5xl px-4 pb-10 pt-28 sm:px-6 lg:pt-32">
      {/* Header */}
      <Reveal>
        <Link href="/#roadmap" className="inline-flex items-center gap-1.5 text-[12.5px] text-faint transition hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Roadmap
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px]" style={{ borderColor: `${color}40`, background: `${color}10`, color }}>
            <Icon name={lesson.icon} className="h-3.5 w-3.5" />
            Stop {num} · {lesson.level}
          </span>
        </div>
        <h1 className="mt-5 text-[clamp(2.2rem,5vw,3.4rem)] font-bold leading-[1.08] tracking-tight">
          {lesson.title.split(" ").slice(0, -1).join(" ")} <span className="text-gradient">{lesson.title.split(" ").slice(-1)}</span>
        </h1>
        <div className="prose-vm mt-6 max-w-3xl text-[16px]">
          {lesson.intro.map((p, i) => (
            <p key={i}>
              <Rich text={p} />
            </p>
          ))}
        </div>
        {lesson.references && <References refs={lesson.references} />}
      </Reveal>

      {/* Simulation */}
      <Reveal delay={0.05} className="mt-12">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="flex items-center gap-2 font-mono text-[12px] text-muted">
              <span className="h-2 w-2 rounded-full animate-pulse-soft" style={{ background: color }} />
              {lesson.simTitle}
            </div>
            <span className="hidden text-[11px] text-faint sm:inline">{lesson.sim === "flow" ? "click a stage" : "interactive"}</span>
          </div>
          <div className="p-4 sm:p-5">
            <Simulation sim={lesson.sim} flow={lesson.flow} color={color} />
          </div>
        </section>
      </Reveal>

      {/* JVM lessons */}
      <Reveal className="mt-16">
        <section className="card relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.10),transparent)]" />
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-amber">
            <Coffee className="h-4 w-4" /> {lesson.jvm.title}
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {lesson.jvm.points.map((p, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-line bg-black/30 p-4 text-[14px] leading-relaxed text-[#b4b4be]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span>
                  <Rich text={p} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      {/* Concepts */}
      <div className="mt-16 space-y-14">
        {lesson.concepts.map((c, i) => (
          <Reveal key={c.heading}>
            <section>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px]" style={{ color }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="text-2xl font-semibold tracking-tight">{c.heading}</h2>
              </div>
              <div className="prose-vm mt-4 max-w-3xl text-[15.5px]">
                {c.body.map((p, k) => (
                  <p key={k}>
                    <Rich text={p} />
                  </p>
                ))}
              </div>
              {c.code && (
                <div className="mt-5 max-w-3xl">
                  <CodeBlock code={c.code.code} lang={c.code.lang} caption={c.code.caption} />
                </div>
              )}
            </section>
          </Reveal>
        ))}
      </div>

      {/* Build it */}
      <Reveal className="mt-20">
        <section>
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-emerald">
            <Hammer className="h-4 w-4" /> Build it in your VM
          </div>
          <p className="mt-3 max-w-3xl text-[15.5px] leading-relaxed text-muted">
            <Rich text={lesson.build.intro} />
          </p>
          {lesson.build.milestone && (
            <div className="mt-5 flex max-w-3xl items-start gap-3 rounded-lg border border-emerald/25 bg-emerald/[0.05] px-4 py-3 text-[14px] leading-relaxed text-[#c4c4cc]">
              <Flag className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
              <span>
                <span className="font-medium text-emerald">By the end: </span>
                <Rich text={lesson.build.milestone} />
              </span>
            </div>
          )}
          <ol className="relative mt-8 space-y-10 border-l border-line pl-6 sm:pl-8">
            {lesson.build.steps.map((s, i) => (
              <Fragment key={s.title}>
              {s.section && (
                <li className="relative !mt-14 first:!mt-0">
                  <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald/60 ring-4 ring-bg sm:-left-[37px]" />
                  <div className="text-[12px] font-medium uppercase tracking-[0.16em] text-emerald">{s.section}</div>
                </li>
              )}
              <li className="relative">
                <span className="absolute -left-[37px] flex h-7 w-7 items-center justify-center rounded-full border border-emerald/40 bg-bg font-mono text-[11px] text-emerald sm:-left-[45px]">
                  {i + 1}
                </span>
                <h3 className="text-[16px] font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 max-w-3xl text-[14.5px] leading-relaxed text-[#a9a9b4]">
                  <Rich text={s.body} />
                </p>
                {s.code && (
                  <div className="mt-4 max-w-3xl">
                    <CodeBlock code={s.code.code} lang={s.code.lang} caption={s.code.caption} />
                  </div>
                )}
                {s.explain && (
                  <div className="mt-4 max-w-3xl rounded-lg border border-line bg-white/[0.015] p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-blue">
                      <Lightbulb className="h-3.5 w-3.5" /> How it works
                    </div>
                    <ul className="mt-2.5 space-y-2">
                      {s.explain.map((e, k) => (
                        <li key={k} className="flex gap-2.5 text-[13.5px] leading-relaxed text-[#a9a9b4]">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue" />
                          <span>
                            <Rich text={e} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.output && (
                  <div className="mt-4 max-w-3xl">
                    <CodeBlock code={s.output} lang="text" caption="output" />
                  </div>
                )}
                {s.jvm && (
                  <div className="mt-4 flex max-w-3xl gap-2.5 rounded-lg border border-amber/20 bg-amber/[0.04] px-4 py-3 text-[13.5px] leading-relaxed text-[#b0b0ba]">
                    <Coffee className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
                    <span>
                      <span className="font-medium text-amber">In the JVM: </span>
                      <Rich text={s.jvm} />
                    </span>
                  </div>
                )}
              </li>
              </Fragment>
            ))}
          </ol>
        </section>
      </Reveal>

      {/* Questions */}
      <Reveal className="mt-20">
        <section>
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-violet">
            <HelpCircle className="h-4 w-4" /> Questions worth thinking about
          </div>
          <p className="mt-3 max-w-3xl text-[15px] text-muted">Try answering each one yourself first. Then read the intuition, and switch to “Under the hood” for the precise mechanism.</p>
          <div className="mt-6 space-y-3">
            {lesson.questions.map((q, i) => (
              <QuestionCard key={q.q} q={q} index={i} color={color} />
            ))}
          </div>
        </section>
      </Reveal>

      {/* Prev / next */}
      <nav className="mt-20 grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link href={prev.href} className="card card-hover group p-5">
            <div className="flex items-center gap-1.5 text-[11.5px] text-faint">
              <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" /> Previous · {prev.num}
            </div>
            <div className="mt-1.5 font-semibold text-ink">{prev.title}</div>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={next.href} className="card card-hover group p-5 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[11.5px] text-faint">
              Next · {next.num} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
            <div className="mt-1.5 font-semibold text-ink">{next.title}</div>
          </Link>
        )}
      </nav>
    </article>
  );
}
