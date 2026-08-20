import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ACTIVE_TOOLS } from "@/lib/tools";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        That page doesn&apos;t exist. Jump back in with one of these tools:
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {ACTIVE_TOOLS.slice(0, 8).map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {tool.name}
          </Link>
        ))}
      </div>
      <Button variant="ghost" className="mt-8" render={<Link href="/" />}>
        <ArrowLeft className="h-4 w-4" />
        Back to all tools
      </Button>
    </div>
  );
}