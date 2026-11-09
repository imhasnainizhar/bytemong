import Link from "next/link";
import { site } from "@/lib/site";

/**
 * ByteMong mark: a mongoose face on a gradient tile, with square "bit" eyes.
 * Keep in sync with src/app/icon.svg.
 */
export function LogoMark({ size = 30, id = "bm" }: { size?: number; id?: string }) {
  const tile = `${id}-tile`;
  const head = `${id}-head`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id={tile} x1="2" y1="1" x2="30" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset=".55" stopColor="#6d5cf6" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id={head} x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e0e7ff" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8.5" fill={`url(#${tile})`} />
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" stroke="white" strokeOpacity=".22" />
      {/* round ears */}
      <circle cx="9.6" cy="10.2" r="3.2" fill={`url(#${head})`} />
      <circle cx="22.4" cy="10.2" r="3.2" fill={`url(#${head})`} />
      <circle cx="9.6" cy="10.2" r="1.5" fill="#6d5cf6" fillOpacity=".4" />
      <circle cx="22.4" cy="10.2" r="1.5" fill="#6d5cf6" fillOpacity=".4" />
      {/* head tapering to a long snout */}
      <path d="M7.4 15.4Q7.4 9.8 16 9.8Q24.6 9.8 24.6 15.4Q24.6 19.2 19.6 22.4L17.4 26Q16 27.4 14.6 26L12.4 22.4Q7.4 19.2 7.4 15.4Z" fill={`url(#${head})`} />
      {/* square "bit" eyes */}
      <rect x="10.6" y="13.6" width="3.2" height="3.2" rx=".8" fill="#4c3fd6" />
      <rect x="18.2" y="13.6" width="3.2" height="3.2" rx=".8" fill="#4c3fd6" />
      {/* nose */}
      <ellipse cx="16" cy="24.6" rx="1.7" ry="1.2" fill="#4c3fd6" />
    </svg>
  );
}

export function Wordmark({ className = "text-[15px]" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-ink ${className}`}>
      Byte<span className="text-gradient">Mong</span>
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label={`${site.name} home`}>
      <span className="transition-transform duration-300 group-hover:-translate-y-0.5">
        <LogoMark id="nav-logo" />
      </span>
      <Wordmark />
    </Link>
  );
}
