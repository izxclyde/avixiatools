import type { Metadata } from "next";
import Link from "next/link";
import { ReportForm } from "@/components/report-form";

export const metadata: Metadata = {
  title: "Report an issue",
  description: "Report a bug or suggest a feature for avixiatools.",
};

export default function ReportPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Report an issue
      </h1>
      <p className="mt-2 text-muted-foreground">
        Found a bug or have a suggestion? Send it straight to the avixiatools
        GitHub Issues — no account needed.
      </p>
      <div className="mt-8">
        <ReportForm />
      </div>
      <p className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        avixiatools is built by{" "}
        <Link
          href="https://hcnatividad.com"
          className="underline underline-offset-2 hover:text-foreground"
        >
          H.C. Natividad
        </Link>
        . Issues are tracked in the{" "}
        <Link
          href="https://github.com/izxclyde/avixiatools/issues"
          className="underline underline-offset-2 hover:text-foreground"
        >
          public issue tracker
        </Link>
        .
      </p>
    </div>
  );
}