import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, toolsByCategory } from "@/lib/tools";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="mb-10 lg:mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          avixiatools
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          A collection of small, focused tools for designers and developers.
          Everything runs in your browser — no logins, no tracking, no data
          leaves your machine.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {CATEGORIES.map((category) => (
          <section key={category.id} aria-labelledby={`cat-${category.id}`}>
            <h2
              id={`cat-${category.id}`}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {category.name}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {toolsByCategory(category.id).map((tool) => (
                <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                  <Card className="group h-full transition-colors hover:border-primary/50">
                    <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
                      <div>
                        <h3 className="font-medium">{tool.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {tool.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
