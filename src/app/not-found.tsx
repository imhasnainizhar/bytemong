import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 pb-10 pt-40 text-center">
      <div className="font-mono text-[12px] text-rose">StackUnderflow: no frame for this route</div>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">404</h1>
      <p className="mt-3 text-muted">The instruction pointer jumped somewhere that doesn&apos;t exist.</p>
      <Link href="/" className="mt-8 rounded-lg border border-line bg-white/[0.03] px-4 py-2 text-[13px] text-ink transition hover:border-line-strong">
        Return to the roadmap
      </Link>
    </div>
  );
}
