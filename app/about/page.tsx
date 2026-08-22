import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ACTIVE_TOOLS, activeCategories, toolsByCategory } from "@/lib/tools";

export const metadata: Metadata = {
  title: "About",
  description:
    "What avixiatools is, how your files are handled, and who built it.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All tools
      </Link>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          About avixiatools
        </h1>
        <p className="mt-1 text-muted-foreground">
          A collection of small, focused tools that run entirely in your
          browser.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">What is this?</h2>
          <p className="mt-2">
            avixiatools is a set of {ACTIVE_TOOLS.length} free tools for
            designers and developers, organised into{" "}
            {activeCategories.map((c) => c.name).join(", ")}. There is
            nothing to install and no account to create — open a tool, drop a
            file or paste some text, get your result.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Your files never leave your device
          </h2>
          <p className="mt-2">
            Every tool processes data locally in your browser. Files are never
            uploaded to a server, there are no logins, and nothing is tracked.
            Two exceptions worth knowing about:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Background Remover downloads a one-time ~180MB AI model from a
              CDN — the image itself still never leaves your machine.
            </li>
            <li>
              The Report an issue page sends your message to GitHub only when
              you deliberately submit it.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Credits</h2>
          <p className="mt-2">
            Some tools are adapted from the MIT-licensed{" "}
            <a
              href="https://github.com/1612elphi/delphitools"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              delphitools
            </a>{" "}
            project. Full attribution lives in the repository&apos;s{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              ACKNOWLEDGEMENTS.md
            </code>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Feedback</h2>
          <p className="mt-2">
            Found something broken or missing?{" "}
            <Link
              href="/report"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Report an issue
            </Link>{" "}
            — it lands straight in the GitHub tracker.
          </p>
        </section>

        <footer className="border-t pt-4 text-xs">
          Built by{" "}
          <a
            href="https://hcnatividad.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Harren Natividad
          </a>
          . Currently housing{" "}
          {activeCategories
            .map((c) => `${toolsByCategory(c.id).length} ${c.name.toLowerCase()}`)
            .join(", ")}{" "}
            tools.
        </footer>
      </div>
    </div>
  );
}
