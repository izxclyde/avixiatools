import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ACTIVE_TOOLS, toolsBySlug } from "@/lib/tools";
import { toolComponents } from "@/components/tools";

export function generateStaticParams() {
  return ACTIVE_TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = toolsBySlug.get(slug);
  if (!tool) return {};
  return {
    title: tool.name,
    description: tool.description,
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = toolsBySlug.get(slug);
  if (!tool) notFound();

  const Component = toolComponents[slug];
  if (!Component) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All tools
      </Link>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {tool.name}
        </h1>
        <p className="mt-1 text-muted-foreground">{tool.description}</p>
      </header>
      <Component />
    </div>
  );
}
