"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Wrench } from "lucide-react";
import { activeCategories, toolsByCategory } from "@/lib/tools";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6">
      {activeCategories.map((category) => (
        <div key={category.id}>
          <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category.name}
          </h2>
          <ul className="mt-2 flex flex-col gap-0.5">
            {toolsByCategory(category.id).map((tool) => {
              const href = `/tools/${tool.slug}`;
              const active = pathname === href;
              return (
                <li key={tool.slug}>
                  <Link
                    href={href}
                    className={cn(
                      "block rounded-md px-3 py-1.5 text-sm transition-colors",
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
      ))}
    </nav>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <SidebarHeader />
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-3">
            <NavLinks />
          </div>
        </ScrollArea>
      </aside>

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
          <div className="flex h-full flex-col">
            <SidebarHeader />
            <Separator />
            <ScrollArea className="flex-1">
              <div className="p-3">
                <NavLinks />
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SidebarHeader() {
  return (
    <div className="flex items-center gap-2 p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wrench className="h-4 w-4" />
      </span>
      <Link href="/" className="text-lg font-semibold tracking-tight">
        avixia<span className="text-primary">tools</span>
      </Link>
    </div>
  );
}
