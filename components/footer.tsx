import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-tight">
              avixia<span className="text-primary">tools</span>
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              Free browser tools for designers and developers. No logins, no
              tracking — everything runs on your device.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
          >
            <Link
              href="/about"
              className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              About
            </Link>
            <Link
              href="/report"
              className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Report an issue
            </Link>
            <a
              href="https://hcnatividad.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Built by Harren Natividad
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
