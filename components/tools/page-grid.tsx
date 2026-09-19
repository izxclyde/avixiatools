"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { renderPageToCanvas } from "@/lib/pdf";
import {
  prefersReducedMotion,
  project,
  rubberband,
  velocityFromHistory,
  type VelocitySample,
} from "@/lib/motion";

export type PageItem = {
  page: number; // original 1-based page number
  rotation: number; // extra rotation in degrees: 0 | 90 | 180 | 270
};

type PageGridProps =
  | {
      mode: "select";
      pdf: PDFDocumentProxy;
      pageCount: number;
      selected: Set<number>;
      onToggle: (page: number) => void;
    }
  | {
      mode: "organize";
      pdf: PDFDocumentProxy;
      pages: PageItem[];
      onChange: (pages: PageItem[]) => void;
    };

// Shared thumbnail grid for the extract/organize tools. Thumbnails lazy-load
// via IntersectionObserver so large PDFs don't render hundreds of canvases
// up front.
//
// Organize mode: Pointer Events reorder with 1:1 tracking (§2), 10px
// hysteresis (§10), velocity-projected landing (§5/§6), rubber-banded edges
// (§9). WAAPI ease-out settle, cancelled on re-grab so every animation is
// interruptible (§3). Reduced-motion users get instant commits (§14).
// ponytail: settle is a short ease-out, not a true velocity-carry spring —
// upgrade to motion `animate` with velocity handoff if the feel needs it.
export function PageGrid(props: PageGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    from: number;
    current: number;
    dx: number;
    dy: number;
    settling: boolean;
  } | null>(null);
  const startRef = useRef<{ x: number; y: number; index: number; page: number } | null>(null);
  const samplesRef = useRef<VelocitySample[]>([]);
  const settleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (settleTimeout.current) clearTimeout(settleTimeout.current);
    },
    []
  );

  const cells =
    props.mode === "select"
      ? Array.from({ length: props.pageCount }, (_, i) => ({ page: i + 1, rotation: 0 }))
      : props.pages;

  const move = (from: number, to: number) => {
    if (props.mode !== "organize" || from === to) return;
    const next = [...props.pages];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    props.onChange(next);
  };

  const hoverIndexAt = (x: number, y: number): number | null => {
    const container = containerRef.current;
    if (!container) return null;
    const children = Array.from(container.children) as HTMLElement[];
    let best: number | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < children.length; i++) {
      const r = children[i].getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };

  const isOrganize = props.mode === "organize";

  function handleCellPointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    index: number,
    page: number
  ) {
    // Let rotate/delete buttons handle their own presses (§1: respond
    // on pointer-down — buttons already do via .press).
    if ((e.target as HTMLElement).closest("button")) return;
    if (settleTimeout.current) {
      clearTimeout(settleTimeout.current);
      settleTimeout.current = null;
    }
    startRef.current = { x: e.clientX, y: e.clientY, index, page };
    samplesRef.current = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleCellPointerMove(
    e: React.PointerEvent<HTMLDivElement>,
    page: number
  ) {
    const start = startRef.current;
    // Guard on item identity — the dragged node's render index shifts
    // after each live reorder move.
    if (!start || start.page !== page) return;
    const rawDx = e.clientX - start.x;
    const rawDy = e.clientY - start.y;
    if (!drag && Math.hypot(rawDx, rawDy) < 10) return; // hysteresis (§10)

    samplesRef.current.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (samplesRef.current.length > 8) samplesRef.current.shift();

    // Rubber-band past the container edges (§9)
    const container = containerRef.current;
    let dx = rawDx;
    let dy = rawDy;
    if (container) {
      const r = container.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right)
        dx = start.x + rubberband(rawDx, r.width) - start.x;
      if (e.clientY < r.top || e.clientY > r.bottom)
        dy = start.y + rubberband(rawDy, r.height) - start.y;
    }

    const from = drag?.current ?? start.index;
    const hover = hoverIndexAt(e.clientX, e.clientY);
    if (hover !== null && hover !== from) {
      move(from, hover);
      setDrag({ from: drag?.from ?? start.index, current: hover, dx, dy, settling: false });
    } else if (!drag) {
      setDrag({ from: start.index, current: start.index, dx, dy, settling: false });
    } else {
      setDrag({ ...drag, dx, dy });
    }
  }

  function handleCellPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    startRef.current = null;
    if (!drag || (drag.from === drag.current && Math.hypot(drag.dx, drag.dy) < 10)) {
      setDrag(null);
      return;
    }
    // Velocity-projected landing (§5/§6): a fast flick carries one
    // extra slot in the flick direction instead of dropping where
    // the finger happened to stop.
    const { vx, vy } = velocityFromHistory(samplesRef.current);
    const speed = Math.hypot(vx, vy);
    let finalIndex = drag.current;
    if (speed > 500 && props.mode === "organize") {
      const container = containerRef.current;
      if (container) {
        const rects = Array.from(container.children).map(
          (c) => (c as HTMLElement).getBoundingClientRect()
        );
        const cur = rects[drag.current];
        if (cur) {
          // Dominant flick axis decides direction; project() gives magnitude.
          const flickDist = Math.abs(project(speed));
          if (flickDist > cur.width / 2) {
            const dir =
              Math.abs(vx) >= Math.abs(vy)
                ? Math.sign(vx)
                : 0; // vertical flicks stay — grid reflows anyway
            const biased = drag.current + dir;
            if (biased >= 0 && biased < cells.length) finalIndex = biased;
          }
        }
      }
    }
    if (finalIndex !== drag.current) move(drag.current, finalIndex);

    // Settle: eased return to the slot, interruptible on re-grab (§3).
    if (prefersReducedMotion()) {
      setDrag(null);
      return;
    }
    const el = e.currentTarget;
    setDrag({ from: drag.from, current: finalIndex, dx: 0, dy: 0, settling: true });
    try {
      el.getAnimations().forEach((a) => a.cancel());
    } catch {
      // non-fatal
    }
    settleTimeout.current = setTimeout(() => {
      setDrag(null);
      settleTimeout.current = null;
    }, 200);
  }

  function handleCellPointerCancel() {
    startRef.current = null;
    setDrag(null);
  }

  return (
    <div ref={containerRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {cells.map((item, index) => (
        <ThumbCell
          key={`${item.page}-${item.rotation}`}
          pdf={props.pdf}
          item={item}
          selected={props.mode === "select" ? props.selected.has(item.page) : undefined}
          onToggle={
            props.mode === "select" ? () => props.onToggle(item.page) : undefined
          }
          dragTransform={
            drag && drag.current === index
              ? { dx: drag.dx, dy: drag.dy, settling: drag.settling, active: true }
              : undefined
          }
          {...(props.mode === "organize"
            ? {
                onRotate: (delta: 90 | -90) => {
                  // Resolve by item identity — render-time index is stale
                  // after live reorder moves.
                  const pages = props.pages;
                  const at = pages.findIndex((p) => p.page === item.page);
                  if (at < 0) return;
                  const next = [...pages];
                  next[at] = {
                    ...next[at],
                    rotation: (next[at].rotation + delta + 360) % 360,
                  };
                  props.onChange(next);
                },
                onDelete: () => {
                  const pages = props.pages;
                  const at = pages.findIndex((p) => p.page === item.page);
                  if (at < 0) return;
                  const next = [...pages];
                  next.splice(at, 1);
                  props.onChange(next);
                  setDrag(null);
                },
                onPointerDown: isOrganize
                  ? (e: React.PointerEvent<HTMLDivElement>) =>
                      handleCellPointerDown(e, index, item.page)
                  : undefined,
                onPointerMove: isOrganize
                  ? (e: React.PointerEvent<HTMLDivElement>) =>
                      handleCellPointerMove(e, item.page)
                  : undefined,
                onPointerUp: isOrganize
                  ? (e: React.PointerEvent<HTMLDivElement>) => handleCellPointerUp(e)
                  : undefined,
                onPointerCancel: isOrganize ? handleCellPointerCancel : undefined,
              }
            : {})}
        />
      ))}
    </div>
  );
}

type ThumbCellProps = {
  pdf: PDFDocumentProxy;
  item: PageItem;
  selected?: boolean;
  onToggle?: () => void;
  onRotate?: (delta: 90 | -90) => void;
  onDelete?: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: () => void;
  dragTransform?: { dx: number; dy: number; settling: boolean; active: boolean };
};

function ThumbCell({
  pdf,
  item,
  selected,
  onToggle,
  onRotate,
  onDelete,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  dragTransform,
}: ThumbCellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el || url) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        (async () => {
          try {
            const page = await pdf.getPage(item.page);
            const canvas = await renderPageToCanvas(page, 280);
            if (!cancelled) setUrl(canvas.toDataURL("image/jpeg", 0.75));
          } catch {
            // Thumbnail failures are non-fatal; the label still shows the page number
          }
        })();
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pdf, item.page, url]);

  const dragging = !!dragTransform && !dragTransform.settling;

  return (
    <div
      ref={ref}
      role={onToggle ? "checkbox" : undefined}
      aria-checked={onToggle ? !!selected : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onToggle}
      onKeyDown={
        onToggle
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
      className={cn(
        "group relative rounded-lg border bg-muted p-2 transition-colors",
        onToggle && "cursor-pointer hover:border-primary focus-visible:outline-ring",
        selected && "border-primary ring-2 ring-primary",
        // Dragging lifts above siblings and follows 1:1 (§2); settling eases
        // home on transform+opacity only so it stays composited (§11).
        onPointerDown && !onToggle && "touch-pan-y cursor-grab",
        dragging && "z-10 cursor-grabbing border-primary shadow-xl"
      )}
      style={
        dragTransform
          ? {
              transform: `translate(${dragTransform.dx}px, ${dragTransform.dy}px)${
                dragging ? " scale(1.05)" : ""
              }`,
              transition: dragTransform.settling ? "transform 180ms ease-out" : "none",
              willChange: "transform",
            }
          : undefined
      }
    >
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden">
        {url ? (
          <img
            src={url}
            alt={`Page ${item.page}`}
            draggable={false}
            className="max-h-full max-w-full bg-white shadow-sm"
            style={{ transform: `rotate(${item.rotation}deg)` }}
          />
        ) : (
          <span className="text-xs text-muted-foreground">Page {item.page}</span>
        )}
      </div>
      <span className="mt-1 block text-center text-xs text-muted-foreground">
        {item.page}
      </span>

      {onToggle && (
        <span
          className={cn(
            "absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-muted-foreground/70 text-[10px] font-bold text-white",
            selected && "bg-primary"
          )}
        >
          ✓
        </span>
      )}

      {onRotate && (
        <span
          className="absolute inset-x-1.5 bottom-6 flex justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="secondary"
            size="icon"
            className="size-7"
            onClick={() => onRotate(-90)}
            aria-label={`Rotate page ${item.page} left`}
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-7"
            onClick={() => onRotate(90)}
            aria-label={`Rotate page ${item.page} right`}
          >
            <RotateCw className="size-3.5" />
          </Button>
          {onDelete && (
            <Button
              variant="destructive"
              size="icon"
              className="size-7"
              onClick={onDelete}
              aria-label={`Remove page ${item.page}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </span>
      )}
    </div>
  );
}
