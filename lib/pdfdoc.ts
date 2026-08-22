// Shared document-content mapping for the MD/HTML/EPUB→PDF tools.
// Produces pdfmake content arrays so all three tools render identically.
// mdToContent is pure and covered by node --test.

import { marked, type Tokens } from "marked";

export type Content = Record<string, unknown>;
type Run = { text: string; bold?: boolean; italics?: boolean };

type PdfMakeModule = (typeof import("pdfmake/build/pdfmake.js"))["default"];

let pdfMakePromise: Promise<PdfMakeModule> | null = null;

// Kept local so this module stays importable by node --test (no path aliases).
// pdfmake needs its font bundle registered before creating documents.
export async function getPdfMake(): Promise<PdfMakeModule> {
  if (!pdfMakePromise) {
    pdfMakePromise = (async () => {
      const pdfMake = (await import("pdfmake/build/pdfmake.js")).default;
      const vfs = (await import("pdfmake/build/vfs_fonts.js")).default;
      pdfMake.addVirtualFileSystem(vfs);
      return pdfMake;
    })();
  }
  return pdfMakePromise;
}

const HEADING_SIZES: Record<number, number> = {
  1: 22,
  2: 17,
  3: 14,
  4: 12,
  5: 11,
  6: 10,
};

/** Render marked inline tokens as pdfmake text runs (or a plain string). */
function inlineRuns(tokens: Tokens.Generic[] | undefined): Run[] | string {
  if (!tokens?.length) return "";
  const runs: Run[] = [];

  const push = (run: Run) => {
    if (run.text === "") return;
    runs.push(run);
  };

  const walk = (list: Tokens.Generic[], inherited: Partial<Run> = {}) => {
    for (const t of list) {
      switch (t.type) {
        case "strong":
          walk((t as Tokens.Strong).tokens ?? [], { ...inherited, bold: true });
          break;
        case "em":
          walk((t as Tokens.Em).tokens ?? [], { ...inherited, italics: true });
          break;
        case "codespan":
          push({ text: (t as Tokens.Codespan).text, ...inherited, italics: true });
          break;
        case "link":
        case "image":
          // Links/images degrade to their text/alt
          if ("text" in t && typeof t.text === "string") push({ text: t.text, ...inherited });
          break;
        case "br":
          push({ text: "\n", ...inherited });
          break;
        default: {
          const nested = (t as Tokens.Text).tokens;
          if (nested) {
            walk(nested, inherited);
          } else if ("text" in t && typeof t.text === "string") {
            push({ text: t.text, ...inherited });
          }
        }
      }
    }
  };

  walk(tokens);
  const styled = runs.filter((r) => r.bold || r.italics);
  if (styled.length === 0) return runs.map((r) => r.text).join("");
  return runs;
}

function listItem(item: Tokens.ListItem): Content {
  const parts: Content[] = [];
  for (const child of item.tokens ?? []) {
    if (child.type === "paragraph" || child.type === "text") {
      parts.push({ text: inlineRuns(child.tokens), style: "body" });
    } else if (child.type === "list") {
      parts.push(listBlock(child as Tokens.List));
    }
  }
  return parts.length === 1 ? parts[0] : { stack: parts };
}

function listBlock(token: Tokens.List): Content {
  const items = token.items.map(listItem);
  return token.ordered ? { ol: items } : { ul: items };
}

/** Convert a markdown string into pdfmake content blocks. */
export function mdToContent(md: string): Content[] {
  const content: Content[] = [];
  for (const token of marked.lexer(md)) {
    switch (token.type) {
      case "heading": {
        const h = token as Tokens.Heading;
        content.push({
          text: inlineRuns(h.tokens),
          fontSize: HEADING_SIZES[h.depth] ?? 10,
          bold: h.depth <= 3,
          margin: [0, h.depth <= 2 ? 14 : 8, 4, 0],
        });
        break;
      }
      case "paragraph":
        content.push({ text: inlineRuns((token as Tokens.Paragraph).tokens), style: "body" });
        break;
      case "code":
        content.push({
          table: {
            body: [[{ text: (token as Tokens.Code).text, style: "code" }]],
            widths: ["*"],
          },
          layout: "codeBlock",
          margin: [0, 6, 0, 6],
        });
        break;
      case "blockquote": {
        const quote = token as Tokens.Blockquote;
        const text = quote.tokens
          .map((inner) =>
            inner.type === "paragraph" || inner.type === "text"
              ? inlineRuns(inner.tokens)
              : ""
          )
          .join("\n");
        content.push({
          table: {
            body: [[{ text, style: "quote" }]],
            widths: ["*"],
          },
          layout: "quote",
          margin: [0, 6, 0, 6],
        });
        break;
      }
      case "hr":
        content.push({
          canvas: [{ type: "line", x1: 0, y1: 0, x2: 491, y2: 0, lineWidth: 0.75 }],
          margin: [0, 10, 0, 10],
        });
        break;
      case "list":
        content.push(listBlock(token as Tokens.List));
        break;
      case "table": {
        const t = token as Tokens.Table;
        const header = t.header.map((cell) => ({
          text: inlineRuns(cell.tokens),
          style: "tableHeader",
        }));
        const body = t.rows.map((row) =>
          row.map((cell) => ({ text: inlineRuns(cell.tokens), style: "cell" }))
        );
        content.push({
          table: { headerRows: 1, body: [header, ...body] },
          layout: "lightHorizontalLines",
          margin: [0, 6, 0, 6],
        });
        break;
      }
      default:
        break;
    }
  }
  return content;
}

/** Convert an HTML fragment/document into pdfmake content (block-level subset). */
export function htmlToContent(html: string): Content[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const content: Content[] = [];

  const walk = (el: Element) => {
    for (const child of el.children) {
      const tag = child.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const depth = Number(tag[1]);
        content.push({
          text: child.textContent ?? "",
          fontSize: HEADING_SIZES[depth] ?? 10,
          bold: depth <= 3,
          margin: [0, depth <= 2 ? 14 : 8, 4, 0],
        });
      } else if (tag === "p") {
        const text = child.textContent?.trim();
        if (text) content.push({ text, style: "body" });
      } else if (tag === "ul" || tag === "ol") {
        const items = [...child.children]
          .filter((li) => li.tagName.toLowerCase() === "li")
          .map((li) => li.textContent ?? "");
        content.push(tag === "ol" ? { ol: items } : { ul: items });
      } else if (tag === "pre") {
        content.push({
          table: {
            body: [[{ text: child.textContent ?? "", style: "code" }]],
            widths: ["*"],
          },
          layout: "codeBlock",
          margin: [0, 6, 0, 6],
        });
      } else if (tag === "table") {
        const rows = [...child.querySelectorAll("tr")].map((tr) =>
          [...tr.cells].map((td) => ({
            text: td.textContent ?? "",
            ...(td.tagName.toLowerCase() === "th"
              ? { style: "tableHeader" }
              : { style: "cell" }),
          }))
        );
        if (rows.length > 0) {
          content.push({
            table: { headerRows: child.querySelector("thead") ? 1 : 0, body: rows },
            layout: "lightHorizontalLines",
            margin: [0, 6, 0, 6],
          });
        }
      } else if (tag === "blockquote") {
        content.push({ text: child.textContent ?? "", style: "quote" });
      } else if (["section", "article", "div", "main"].includes(tag)) {
        walk(child);
      } else if (
        !["script", "style", "nav", "header", "footer", "aside", "img", "figure"].includes(tag)
      ) {
        const text = child.textContent?.trim();
        if (text) content.push({ text, style: "body" });
      }
    }
  };

  walk(doc.body);
  return content;
}

// Custom table layouts referenced by name; passed to createPdf as tableLayouts
export const PDFDOC_LAYOUTS = {
  codeBlock: {
    hLineColor: () => "#e2e0e7",
    vLineColor: () => "#e2e0e7",
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
  },
  quote: {
    hLineWidth: () => 0,
    vLineWidth: (i: number) => (i === 0 ? 2.5 : 0),
    vLineColor: () => "#d8d6de",
    paddingLeft: () => 10,
    paddingTop: () => 4,
    paddingBottom: () => 4,
  },
};

/** Build and return the PDF blob for a set of content blocks. */
export async function contentToBlob(
  content: Content[],
  orientation: "portrait" | "landscape" = "portrait",
  title?: string
): Promise<Blob> {
  const pdfMake = await getPdfMake();
  // pdfmake 0.3's getBlob() returns a Promise; callback style never fires
  return pdfMake
    .createPdf(
      {
        content,
        ...(title ? { info: { title } } : {}),
        styles: DOC_STYLES,
        defaultStyle: { fontSize: 10.5, lineHeight: 1.45 },
        pageSize: "A4",
        pageOrientation: orientation,
        pageMargins: [52, 56, 52, 56],
      } as unknown as Record<string, unknown>,
      PDFDOC_LAYOUTS
    )
    .getBlob();
}

const DOC_STYLES: Record<string, Record<string, unknown>> = {
  body: { margin: [0, 0, 0, 8] },
  code: { fillColor: "#f1f0f4", margin: [8, 8, 8, 8], preserveLeadingSpaces: true },
  quote: { italics: true, color: "#555555" },
  cell: { fontSize: 9.5 },
  tableHeader: { bold: true, fillColor: "#f1f0f4", fontSize: 9.5 },
};
