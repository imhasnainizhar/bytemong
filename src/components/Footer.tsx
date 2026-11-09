import { LogoMark, Wordmark } from "./Logo";
import { GithubIcon } from "./StarCount";
import { githubUrl } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="self-center">
              <LogoMark size={20} id="footer-logo" />
            </span>
            <Wordmark className="text-[13px]" />
            <span className="text-[11px] font-light text-faint">by Hasnain Izhar</span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
            Learn the JVM by building your own bytecode VM.
            <br />
            Interactive lessons, live simulations and build-along guides.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:items-end">
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[12px] text-muted transition hover:text-ink"
          >
            <GithubIcon className="h-4 w-4" />
            View on GitHub
          </a>
          <p className="text-[11px] font-light text-faint">© 2026 Hasnain Izhar. MIT licensed.</p>
        </div>
      </div>
    </footer>
  );
}
