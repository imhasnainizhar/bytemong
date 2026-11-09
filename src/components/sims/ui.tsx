"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function SimButton({
  children,
  variant = "ghost",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ghost" | "primary" | "active" }) {
  const styles = {
    ghost: "border-line bg-white/[0.03] text-muted hover:text-ink hover:border-line-strong",
    primary: "border-violet/40 bg-violet/15 text-violet-200 hover:bg-violet/25",
    active: "border-blue/40 bg-blue/15 text-blue-200",
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12.5px] transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ title, right, children, className = "" }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-black/30 ${className}`}>
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[12px] font-medium text-muted">{title}</span>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-line bg-white/[0.02] px-3 py-2.5 text-[13px] leading-relaxed text-muted">{children}</div>;
}

export function StepControls({
  step,
  total,
  onPrev,
  onNext,
  onReset,
  extra,
}: {
  step: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SimButton onClick={onPrev} disabled={step === 0}>
        ← Back
      </SimButton>
      <SimButton variant="primary" onClick={onNext} disabled={step >= total - 1}>
        Step →
      </SimButton>
      <SimButton onClick={onReset}>Reset</SimButton>
      {extra}
      <span className="ml-auto font-mono text-[11px] text-faint">
        step {step + 1}/{total}
      </span>
    </div>
  );
}
