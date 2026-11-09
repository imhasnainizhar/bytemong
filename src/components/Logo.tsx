import Link from "next/link";
import { site } from "@/lib/site";

/**
 * ByteStack mark: three isometric "byte" plates stacked on a gradient tile,
 * a nod to the value stack every frame lives on.
 */
export function LogoMark({ size = 30, id = "bs" }: { size?: number; id?: string }) {
  const tile = `${id}-tile`;
  const plate = `${id}-plate`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id={tile} x1="2" y1="1" x2="30" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset=".55" stopColor="#6d5cf6" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id={plate} x1="8" y1="6" x2="24" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e0e7ff" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8.5" fill={`url(#${tile})`} />
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" stroke="white" strokeOpacity=".22" />
      {/* bottom plate */}
      <path d="M16 18.6 24.6 22.6 16 26.6 7.4 22.6Z" fill="white" fillOpacity=".35" />
      {/* middle plate */}
      <path d="M16 13.4 24.6 17.4 16 21.4 7.4 17.4Z" fill="white" fillOpacity=".62" stroke="#5b4fe0" strokeOpacity=".35" strokeWidth=".6" />
      {/* top plate */}
      <path d="M16 8.2 24.6 12.2 16 16.2 7.4 12.2Z" fill={`url(#${plate})`} stroke="#4c3fd6" strokeOpacity=".35" strokeWidth=".6" />
      {/* "bits" on the top plate */}
      <circle cx="13.4" cy="12.2" r="1" fill="#6d5cf6" />
      <circle cx="16" cy="12.2" r="1" fill="#6d5cf6" fillOpacity=".55" />
      <circle cx="18.6" cy="12.2" r="1" fill="#6d5cf6" />
    </svg>
  );
}

export function Wordmark({ className = "text-[15px]" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-ink ${className}`}>
      Byte<span className="text-gradient">Stack</span>
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
