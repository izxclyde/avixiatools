"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, Search, Wrench } from "lucide-react";
import { activeCategories, toolsByCategory, type Tool } from "@/lib/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePersistedState } from "@/components/tools/shared";
import { cn } from "@/lib/utils";

const matches = (tool: Tool, q: string) =>
  !q ||
  `${tool.name} ${tool.description} ${tool.category}`
    .toLowerCase()
    .includes(q);

function NavLinks({ query }: { query: string }) {
  const pathname = usePathname();
  const q = query.trim().toLowerCase();
  return (
    <nav className="flex flex-col gap-6">
      {activeCategories.map((category) => {
        const tools = toolsByCategory(category.id).filter((t) => matches(t, q));
        if (tools.length === 0) return null;
        return (
          <div key={category.id}>
            <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {category.name}
            </h2>
            <ul className="mt-2 flex flex-col gap-0.5">
              {tools.map((tool) => {
                const href = `/tools/${tool.slug}`;
                const active = pathname === href;
                return (
                  <li key={tool.slug}>
                    <Link
                      href={href}
                      className={cn(
                        "block rounded-md px-3 py-2.5 text-sm transition-colors sm:py-1.5",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      {tool.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative p-3 pb-0">
      <Search className="pointer-events-none absolute top-1/2 left-6 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter tools…"
        aria-label="Filter tools"
        className="pl-9"
      />
    </div>
  );
}

function SidebarBody({
  query,
  setQuery,
  expanded,
  onCollapse,
}: {
  query: string;
  setQuery: (v: string) => void;
  expanded?: boolean;
  onCollapse?: () => void;
}) {
  return (
    <div className="flex h-full w-64 flex-col">
      <SidebarHeader expanded={expanded} onCollapse={onCollapse} />
      <Separator />
      <SidebarSearch value={query} onChange={setQuery} />
      {/* min-h-0 lets flex actually constrain the area so long tool lists scroll */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          <NavLinks query={query} />
        </div>
      </ScrollArea>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // ponytail: persisted so the content keeps its full width across reloads.
  const [collapsed, setCollapsed] = usePersistedState("avixia:sidebar:collapsed", false);

  return (
    <>
      <aside
        id="app-sidebar"
        inert={collapsed}
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r apple-chrome transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-0 border-transparent" : "w-64"
        )}
      >
        <SidebarBody query={query} setQuery={setQuery} expanded={!collapsed} onCollapse={() => setCollapsed(true)} />
      </aside>

      {collapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-3 left-3 z-50 hidden lg:flex"
          aria-label="Expand sidebar"
          title="Expand sidebar"
          aria-expanded={false}
          aria-controls="app-sidebar"
          onClick={() => setCollapsed(false)}
        >
          <PanelLeftOpen className="h-5 w-5" />
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-3 top-3 z-50 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-72 p-0">
          <SidebarBody query={query} setQuery={setQuery} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function SidebarHeader({ expanded, onCollapse }: { expanded?: boolean; onCollapse?: () => void }) {
  return (
    <div className="flex items-center gap-2 p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wrench className="h-4 w-4" />
      </span>
      <Link href="/" className="text-lg font-semibold tracking-tight">
        avixia<span className="text-primary">tools</span>
      </Link>
      <ThemeToggle className="ml-auto" />
      {onCollapse && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          aria-expanded={expanded}
          aria-controls="app-sidebar"
          onClick={onCollapse}
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}