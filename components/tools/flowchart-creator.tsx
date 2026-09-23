"use client";

import dynamic from "next/dynamic";

const FlowchartCanvas = dynamic(() => import("@/components/tools/flowchart-canvas"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[480px] items-center justify-center rounded-lg border bg-card"
      role="status"
      aria-label="Loading flowchart editor"
    >
      <p className="text-sm text-muted-foreground">Loading editor…</p>
    </div>
  ),
});

export default function FlowchartCreator() {
  return <FlowchartCanvas />;
}
