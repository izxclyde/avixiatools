import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">
          avixiatools — free browser tools for designers and developers.{" "}
          <Link
            href="/report"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Report an issue
          </Link>
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          No logins, no tracking. Everything runs in your browser — nothing
          leaves your machine.
        </p>
        <p className="mt-3 text-xs text-muted-foreground/60">
          Built by{" "}
          <Link
            href="https://hcnatividad.com"
            className="underline underline-offset-2 hover:text-foreground"
          >
            H.C. Natividad
          </Link>
        </p>
      </div>
    </footer>
  );
}