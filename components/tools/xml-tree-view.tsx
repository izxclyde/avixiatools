"use client";

import { useId, useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  XmlNode,
  formatXmlNode,
  getXmlNodeContent,
} from "@/lib/logic/format";
import { useCopy } from "@/hooks/use-copy";

interface XmlTreeViewProps {
  nodes: XmlNode[];
  rawXml: string;
}

export function XmlTreeView({ nodes, rawXml }: XmlTreeViewProps) {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [activePath, setActivePath] = useState<string | null>(null);
  const { copiedId, copy, statusMessage } = useCopy();
  const rootId = useId();

  const toggleCollapse = useCallback((path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedPaths(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    const paths = new Set<string>();
    const collectPaths = (nodeList: XmlNode[], curPath: string) => {
      nodeList.forEach((node, idx) => {
        const path = `${curPath}[${idx}]`;
        if (node.kind === "element" && !node.selfClose && node.children.length > 0) {
          const isTextOnly = !node.children.some((c) => c.kind === "element");
          if (!isTextOnly) {
            paths.add(path);
            collectPaths(node.children, path);
          }
        }
      });
    };
    collectPaths(nodes, "root");
    setCollapsedPaths(paths);
  }, [nodes]);

  return (
    <div className="flex flex-col rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-semibold text-foreground">Interactive Tree</span>
          <span>•</span>
          <span>Hover or tap a node to copy tags, content, or sections</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={expandAll}
            title="Expand all elements"
          >
            <ChevronsUpDown className="mr-1 h-3.5 w-3.5" />
            Expand all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={collapseAll}
            title="Collapse all elements"
          >
            <ChevronsDownUp className="mr-1 h-3.5 w-3.5" />
            Collapse all
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => copy("root-all", rawXml, "entire XML")}
            aria-label="Copy entire formatted XML"
          >
            {copiedId === "root-all" ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Copied XML!
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy all
              </>
            )}
          </Button>
        </div>
      </div>

      <div
        className="max-h-[600px] overflow-auto p-3 font-mono text-xs leading-relaxed sm:text-sm"
        role="tree"
        aria-label="XML structure"
      >
        <div className="sr-only" aria-live="polite">
          {statusMessage}
        </div>

        {nodes.map((node, idx) => (
          <XmlNodeRenderer
            key={`${rootId}-${idx}`}
            node={node}
            path={`node-${idx}`}
            depth={0}
            collapsedPaths={collapsedPaths}
            toggleCollapse={toggleCollapse}
            activePath={activePath}
            setActivePath={setActivePath}
            copiedId={copiedId}
            onCopy={copy}
          />
        ))}
      </div>
    </div>
  );
}

interface XmlNodeRendererProps {
  node: XmlNode;
  path: string;
  depth: number;
  collapsedPaths: Set<string>;
  toggleCollapse: (path: string) => void;
  activePath: string | null;
  setActivePath: (path: string | null) => void;
  copiedId: string | null;
  onCopy: (id: string, text: string, label: string) => Promise<boolean>;
}

function XmlNodeRenderer({
  node,
  path,
  depth,
  collapsedPaths,
  toggleCollapse,
  activePath,
  setActivePath,
  copiedId,
  onCopy,
}: XmlNodeRendererProps) {
  const isCollapsed = collapsedPaths.has(path);
  const isActive = activePath === path;
  const indentPadding = `${depth * 1.25}rem`;

  if (node.kind !== "element") {
    if (node.kind === "text") {
      const trimmed = node.raw.trim();
      if (!trimmed) return null;
      return (
        <div
          className="tree-node-row flex min-w-max items-center rounded px-1.5 py-0.5"
          style={{ paddingLeft: indentPadding }}
        >
          <span className="inline-block w-4" />
          <span className="text-foreground">{trimmed}</span>
        </div>
      );
    }

    if (node.kind === "comment") {
      const commentId = `comment-${path}`;
      const isCopied = copiedId === commentId;
      return (
        <div
          className="group tree-node-row relative flex min-w-max items-center justify-between rounded px-1.5 py-0.5"
          data-active={isActive}
          onClick={() => setActivePath(isActive ? null : path)}
        >
          <div className="flex items-center" style={{ paddingLeft: indentPadding }}>
            <span className="inline-block w-4" />
            <span className="italic text-muted-foreground/70">{node.raw}</span>
          </div>
          <div
            className="ml-4 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 data-[visible=true]:opacity-100"
            data-visible={isActive}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] font-sans"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(commentId, node.raw, "XML comment");
              }}
              aria-label="Copy comment"
            >
              {isCopied ? (
                <>
                  <Check className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>
      );
    }

    // CDATA or PI
    const rawId = `raw-${path}`;
    const isCopied = copiedId === rawId;
    return (
      <div
        className="group tree-node-row relative flex min-w-max items-center justify-between rounded px-1.5 py-0.5"
        data-active={isActive}
        onClick={() => setActivePath(isActive ? null : path)}
      >
        <div className="flex items-center" style={{ paddingLeft: indentPadding }}>
          <span className="inline-block w-4" />
          <span className="text-teal-600 dark:text-teal-400">{node.raw}</span>
        </div>
        <div
          className="ml-4 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 data-[visible=true]:opacity-100"
          data-visible={isActive}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] font-sans"
            onClick={(e) => {
              e.stopPropagation();
              onCopy(rawId, node.raw, node.kind);
            }}
            aria-label={`Copy ${node.kind}`}
          >
            {isCopied ? (
              <>
                <Check className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Element
  const tagId = `tag-${path}`;
  const contentId = `content-${path}`;
  const isTagCopied = copiedId === tagId;
  const isContentCopied = copiedId === contentId;

  // Self-closing element
  if (node.selfClose) {
    return (
      <div
        className="group tree-node-row relative flex min-w-max items-center justify-between rounded px-1.5 py-0.5"
        data-active={isActive}
        onClick={() => setActivePath(isActive ? null : path)}
      >
        <div className="flex items-center" style={{ paddingLeft: indentPadding }}>
          <span className="inline-block w-4" />
          <XmlTagSpan raw={node.open} />
        </div>
        <div
          className="ml-4 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 data-[visible=true]:opacity-100"
          data-visible={isActive}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] font-sans"
            onClick={(e) => {
              e.stopPropagation();
              onCopy(tagId, formatXmlNode(node), `tag <${node.name} />`);
            }}
            aria-label={`Copy tag ${node.name}`}
            title={`Copy tag <${node.name} />`}
          >
            {isTagCopied ? (
              <>
                <Check className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                <span>Copy Tag</span>
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Check if this element is a single-line text-only element (no element children)
  const hasElementChildren = node.children.some((c) => c.kind === "element");
  const isTextOnly = !hasElementChildren;
  const innerText = node.children.map((c) => c.raw).join("");
  const isSingleLineText = isTextOnly && !innerText.includes("\n");

  if (isSingleLineText) {
    const textContent = innerText.trim();
    return (
      <div
        className="group tree-node-row relative flex min-w-max items-center justify-between rounded px-1.5 py-0.5"
        data-active={isActive}
        onClick={() => setActivePath(isActive ? null : path)}
      >
        <div className="flex items-center" style={{ paddingLeft: indentPadding }}>
          <span className="inline-block w-4" />
          <XmlTagSpan raw={node.open} />
          <span className="text-foreground">{textContent}</span>
          <span className="code-punctuation">&lt;/</span>
          <span className="code-tag">{node.name}</span>
          <span className="code-punctuation">&gt;</span>
        </div>

        <div
          className="ml-4 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 data-[visible=true]:opacity-100"
          data-visible={isActive}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] font-sans"
            onClick={(e) => {
              e.stopPropagation();
              onCopy(tagId, formatXmlNode(node), `tag <${node.name}>`);
            }}
            aria-label={`Copy XML tag ${node.name}`}
            title={`Copy tag: <${node.name}>${textContent}</${node.name}>`}
          >
            {isTagCopied ? (
              <>
                <Check className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                <span>Copy</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] font-sans"
            onClick={(e) => {
              e.stopPropagation();
              onCopy(contentId, textContent, `content of <${node.name}>`);
            }}
            aria-label={`Copy content of <${node.name}>`}
            title={`Copy content: ${textContent}`}
          >
            {isContentCopied ? (
              <>
                <Check className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                <span>Content</span>
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Nested / Multiline element with children
  const elementCount = node.children.filter((c) => c.kind === "element").length;
  const contentValue = getXmlNodeContent(node);

  return (
    <div className="flex flex-col">
      <div
        className="group tree-node-row relative flex min-w-max items-center justify-between rounded px-1.5 py-0.5"
        data-active={isActive}
        onClick={() => setActivePath(isActive ? null : path)}
      >
        <div className="flex items-center" style={{ paddingLeft: indentPadding }}>
          <button
            type="button"
            className="mr-0.5 flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(path);
            }}
            aria-label={isCollapsed ? `Expand <${node.name}>` : `Collapse <${node.name}>`}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <XmlTagSpan raw={node.open} />

          {isCollapsed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(path);
              }}
              className="mx-1 rounded bg-muted px-1.5 py-0.2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              ... {elementCount > 0 ? `${elementCount} child tags` : "content"}
            </button>
          )}

          {isCollapsed && (
            <>
              <span className="code-punctuation">&lt;/</span>
              <span className="code-tag">{node.name}</span>
              <span className="code-punctuation">&gt;</span>
            </>
          )}
        </div>

        <div
          className="ml-4 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 data-[visible=true]:opacity-100"
          data-visible={isActive}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] font-sans"
            onClick={(e) => {
              e.stopPropagation();
              onCopy(tagId, formatXmlNode(node), `section <${node.name}>`);
            }}
            aria-label={`Copy section <${node.name}>`}
            title={`Copy entire <${node.name}> section`}
          >
            {isTagCopied ? (
              <>
                <Check className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                <span>Copy Section</span>
              </>
            )}
          </Button>

          {contentValue && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] font-sans"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(contentId, contentValue, `content of <${node.name}>`);
              }}
              aria-label={`Copy content of <${node.name}>`}
              title="Copy inner content without outer tags"
            >
              {isContentCopied ? (
                <>
                  <Check className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                  <span>Content</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {node.children.map((child, idx) => (
            <XmlNodeRenderer
              key={`${path}[${idx}]`}
              node={child}
              path={`${path}[${idx}]`}
              depth={depth + 1}
              collapsedPaths={collapsedPaths}
              toggleCollapse={toggleCollapse}
              activePath={activePath}
              setActivePath={setActivePath}
              copiedId={copiedId}
              onCopy={onCopy}
            />
          ))}

          <div
            className="tree-node-row flex min-w-max items-center rounded px-1.5 py-0.5"
            style={{ paddingLeft: indentPadding }}
          >
            <span className="inline-block w-4" />
            <span className="code-punctuation">&lt;/</span>
            <span className="code-tag">{node.name}</span>
            <span className="code-punctuation">&gt;</span>
          </div>
        </>
      )}
    </div>
  );
}

function XmlTagSpan({ raw }: { raw: string }) {
  // Parse `<tag-name attr="val" ...>`
  const match = raw.match(/^<([A-Za-z0-9_:.-]+)([\s\S]*?)(\/?>)$/);
  if (!match) {
    return <span className="code-tag">{raw}</span>;
  }

  const [, tagName, rest, closing] = match;
  const attrRegex = /([A-Za-z0-9_:.-]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g;
  const parts: React.ReactNode[] = [];
  let attrMatch: RegExpExecArray | null;

  while ((attrMatch = attrRegex.exec(rest)) !== null) {
    const attrName = attrMatch[1];
    const attrVal = attrMatch[2] ?? attrMatch[3];
    parts.push(
      <span key={`attr-${attrMatch.index}`} className="ml-1.5">
        <span className="code-attr">{attrName}</span>
        {attrVal !== undefined && (
          <>
            <span className="code-punctuation">=</span>
            <span className="code-attr-value">&quot;{attrVal}&quot;</span>
          </>
        )}
      </span>
    );
  }

  return (
    <span>
      <span className="code-punctuation">&lt;</span>
      <span className="code-tag">{tagName}</span>
      {parts}
      <span className="code-punctuation">{closing}</span>
    </span>
  );
}
