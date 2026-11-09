import { LogoMark, Wordmark } from "./Logo";
import { GithubIcon } from "./StarCount";
import { site, githubUrl } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark size={20} id="footer-logo" />
            <Wordmark className="text-[13px]" />
          </div>
          <p className="mt-1 text-[12px] text-faint">{site.tagline}</p>
        </div>
        <a
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-[12px] text-muted transition hover:text-ink"
        >
          <GithubIcon className="h-4 w-4" />
          View on GitHub
        </a>
      </div>
    </footer>
  );
}
