import { ACTIVE_TOOLS, CATEGORIES, type Tool } from "@/lib/tools";

const categoryName = (id: string) =>
  CATEGORIES.find((c) => c.id === id)?.name ?? "";

// Ranked substring match over name, description and category.
export function searchTools(query: string): Tool[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ACTIVE_TOOLS.filter((t) => {
    const hay = `${t.name} ${t.description} ${categoryName(t.category)}`.toLowerCase();
    return hay.includes(q);
  });
}