"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { searchTools } from "@/lib/search";
import { CATEGORY_ICONS } from "@/lib/tools";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const OPEN_EVENT = "avixia:open-palette";

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchTools(query), [query]);

  const close = useCallback(() => setOpen(false), []);
  const go = useCallback(
    (slug: string) => {
      close();
      router.push(`/tools/${slug}`);
    },
    [close, router]
  );

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Search tools</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search tools…"
            className="h-11 border-0 bg-transparent focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                go(results[active].slug);
              }
            }}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {query.trim() && results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No tools found.
            </p>
          ) : (
            <ul role="listbox" aria-label="Tools">
              {results.map((tool, i) => {
                const Icon = CATEGORY_ICONS[tool.category];
                return (
                  <li key={tool.slug} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onClick={() => go(tool.slug)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        i === active
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{tool.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {tool.description}
                        </span>
                      </span>
                      {i === active && (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}