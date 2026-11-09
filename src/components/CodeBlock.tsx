"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const KEYWORDS: Record<string, string[]> = {
  rust: ["fn", "let", "mut", "pub", "struct", "enum", "impl", "match", "if", "else", "while", "loop", "for", "in", "return", "self", "Self", "use", "type", "as", "unsafe", "Some", "None", "Ok", "Err", "true", "false", "const", "static"],
  wisp: ["let", "fn", "return", "if", "else", "while", "for", "in", "import", "export", "nil", "true", "false", "proto"],
  java: ["public", "class", "static", "void", "int", "new", "return", "final", "private"],
  text: [],
};

function highlight(line: string, lang: keyof typeof KEYWORDS) {
  // comments
  const commentIdx = (() => {
    const markers = lang === "text" ? ["//", "; "] : ["//"];
    let idx = -1;
    for (const m of markers) {
      const i = line.indexOf(m);
      if (i >= 0 && (idx < 0 || i < idx)) idx = i;
    }
    return idx;
  })();
  const code = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const comment = commentIdx >= 0 ? line.slice(commentIdx) : "";
  const kw = KEYWORDS[lang];
  const tokens = code.split(/(\s+|[(){}[\],.;:<>=!&|+\-*/?#]|"[^"]*")/g).filter((t) => t !== "");
  return (
    <>
      {tokens.map((t, i) => {
        if (t.startsWith('"')) return <span key={i} className="text-emerald-300/90">{t}</span>;
        if (kw.includes(t)) return <span key={i} className="text-violet-300">{t}</span>;
        if (/^\d[\d_.x]*$/i.test(t) || /^0x[0-9a-f]+$/i.test(t)) return <span key={i} className="text-amber-300/90">{t}</span>;
        if (/^[A-Z][A-Za-z0-9_]*$/.test(t)) return <span key={i} className="text-sky-300">{t}</span>;
        return <span key={i}>{t}</span>;
      })}
      {comment && <span className="text-faint italic">{comment}</span>}
    </>
  );
}

export function CodeBlock({ code, lang = "rust", caption }: { code: string; lang?: keyof typeof KEYWORDS; caption?: string }) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  return (
    <div className="code-block overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          </span>
          <span className="ml-2 text-[11px] uppercase tracking-wider text-faint">{lang}</span>
          {caption && <span className="text-[11px] text-muted">· {caption}</span>}
        </div>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            });
          }}
          className="flex items-center gap-1 text-[11px] text-faint transition hover:text-ink"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[#cfcfdb]">
        <code>
          {lines.map((l, i) => (
            <div key={i} className="flex">
              <span className="mr-4 w-5 shrink-0 select-none text-right text-faint/70">{i + 1}</span>
              <span className="whitespace-pre">{highlight(l, lang)}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
