"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { renderPageToCanvas } from "@/lib/pdf";

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
// up front. ponytail: HTML5 drag events for reorder — swap for a dnd library
// if touch support on mobile matters.
export function PageGrid(props: PageGridProps) {
  const dragIndex = useRef<number | null>(null);

  const cells =
    props.mode === "select"
      ? Array.from({ length: props.pageCount }, (_, i) => ({ page: i + 1, rotation: 0 }))
      : props.pages;

  const move = (from: number, to: number) => {
    if (props.mode !== "organize" || from === to) return;
    const next = [...props.pages];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    dragIndex.current = null;
    props.onChange(next);
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {cells.map((item, index) => (
        <ThumbCell
          key={`${item.page}-${item.rotation}`}
          pdf={props.pdf}
          item={item}
          selected={props.mode === "select" ? props.selected.has(item.page) : undefined}
          draggable={props.mode === "organize"}
          onToggle={
            props.mode === "select" ? () => props.onToggle(item.page) : undefined
          }
          {...(props.mode === "organize"
            ? {
                onRotate: (delta: 90 | -90) => {
                  const next = [...props.pages];
                  next[index] = {
                    ...next[index],
                    rotation: (next[index].rotation + delta + 360) % 360,
                  };
                  props.onChange(next);
                },
                onDelete: () => {
                  const next = [...props.pages];
                  next.splice(index, 1);
                  props.onChange(next);
                },
                onDragStart: () => {
                  dragIndex.current = index;
                },
                onDropAt: () => move(dragIndex.current ?? -1, index),
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
  draggable?: boolean;
  onToggle?: () => void;
  onRotate?: (delta: 90 | -90) => void;
  onDelete?: () => void;
  onDragStart?: () => void;
  onDropAt?: () => void;
};

function ThumbCell({
  pdf,
  item,
  selected,
  draggable,
  onToggle,
  onRotate,
  onDelete,
  onDragStart,
  onDropAt,
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

  return (
    <div
      ref={ref}
      role={onToggle ? "checkbox" : undefined}
      aria-checked={onToggle ? !!selected : undefined}
      tabIndex={onToggle ? 0 : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={onDropAt}
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
        selected && "border-primary ring-2 ring-primary"
      )}
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
