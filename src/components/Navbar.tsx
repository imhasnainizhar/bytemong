import { Logo } from "./Logo";
import { StarCount } from "./StarCount";

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Dark shade that fades from the top edge downward behind the nav */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black via-black/80 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
      />
      <nav className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 md:justify-around">
        <Logo />
        <StarCount />
      </nav>
    </header>
  );
}
