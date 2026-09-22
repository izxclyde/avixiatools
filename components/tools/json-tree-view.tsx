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
  JsonNode,
  formatJsonProperty,
  getJsonNodeValueText,
} from "@/lib/logic/format";
import { useCopy } from "@/hooks/use-copy";

/** Strings longer than this are truncated in the tree view. */
const MAX_INLINE = 80;

interface JsonTreeViewProps {
  tree: JsonNode;
  rawJson: string;
}

export function JsonTreeView({ tree, rawJson }: JsonTreeViewProps) {
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
    const collectPaths = (node: JsonNode, curPath: string) => {
      if (node.kind === "object") {
        paths.add(curPath);
        for (const entry of node.entries) {
          collectPaths(entry.value, `${curPath}.${entry.key}`);
        }
      } else if (node.kind === "array") {
        paths.add(curPath);
        node.items.forEach((item, idx) => {
          collectPaths(item, `${curPath}[${idx}]`);
        });
      }
    };
    collectPaths(tree, "root");
    setCollapsedPaths(paths);
  }, [tree]);

  return (
    <div className="flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-semibold text-foreground">Interactive Tree</span>
          <span>•</span>
          <span>Hover or tap a section to copy properties, values, or objects</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={expandAll}
            title="Expand all nodes"
          >
            <ChevronsUpDown className="mr-1 h-3.5 w-3.5" />
            Expand all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={collapseAll}
            title="Collapse all nodes"
          >
            <ChevronsDownUp className="mr-1 h-3.5 w-3.5" />
            Collapse all
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => copy("root-all", rawJson, "entire JSON")}
            aria-label="Copy entire formatted JSON"
          >
            {copiedId === "root-all" ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Copied JSON!
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

      {/* overflow-x-hidden on the wrapper; rows are w-full so they never push past it */}
      <div
        className="max-h-[600px] overflow-y-auto overflow-x-hidden p-3 font-mono text-xs leading-relaxed sm:text-sm"
        role="tree"
        aria-label="JSON structure"
      >
        <div className="sr-only" aria-live="polite">
          {statusMessage}
        </div>

        <JsonNodeRenderer
          node={tree}
          path="root"
          depth={0}
          isLast={true}
          keyName={null}
          collapsedPaths={collapsedPaths}
          toggleCollapse={toggleCollapse}
          activePath={activePath}
          setActivePath={setActivePath}
          copiedId={copiedId}
          onCopy={copy}
          rootId={rootId}
        />
      </div>
    </div>
  );
}

interface JsonNodeRendererProps {
  node: JsonNode;
  path: string;
  depth: number;
  isLast: boolean;
  keyName: string | null;
  collapsedPaths: Set<string>;
  toggleCollapse: (path: string) => void;
  activePath: string | null;
  setActivePath: (path: string | null) => void;
  copiedId: string | null;
  onCopy: (id: string, text: string, label: string) => Promise<boolean>;
  rootId: string;
}

function JsonNodeRenderer({
  node,
  path,
  depth,
  isLast,
  keyName,
  collapsedPaths,
  toggleCollapse,
  activePath,
  setActivePath,
  copiedId,
  onCopy,
}: JsonNodeRendererProps) {
  const isCollapsed = collapsedPaths.has(path);
  const isActive = activePath === path;
  const indentPadding = `${depth * 1.25}rem`;

  if (node.kind === "primitive") {
    const valueText = getJsonNodeValueText(node);
    const propId = `prop-${path}`;
    const valId = `val-${path}`;
    const isPropCopied = copiedId === propId;
    const isValCopied = copiedId === valId;

    return (
      <div
        className="group tree-node-row relative flex w-full items-start justify-between rounded px-1.5 py-0.5"
        data-active={isActive}
        onClick={() => setActivePath(isActive ? null : path)}
      >
        {/* Content — flex-1 + min-w-0 so it shrinks and wraps instead of overflowing */}
        <div
          className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1"
          style={{ paddingLeft: indentPadding }}
        >
          <span className="inline-block w-4 shrink-0" />
          {keyName !== null && (
            <>
              <span className="code-key shrink-0">&quot;{keyName}&quot;</span>
              <span className="code-punctuation mr-1 shrink-0">:</span>
            </>
          )}
          <PrimitiveValueSpan node={node} />
          {!isLast && <span className="code-punctuation">,</span>}
        </div>

        {/* Copy buttons — sticky to the right so they don't cause horizontal scroll */}
        <div
          className="sticky right-0 ml-2 flex shrink-0 items-center gap-1 self-start opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 data-[visible=true]:opacity-100"
          data-visible={isActive}
        >
          {keyName !== null && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] font-sans"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(propId, formatJsonProperty(keyName, node), `property "${keyName}"`);
              }}
              aria-label={`Copy property ${keyName}`}
              title={`Copy property "${keyName}": ${node.raw}`}
            >
              {isPropCopied ? (
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
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] font-sans"
            onClick={(e) => {
              e.stopPropagation();
              onCopy(valId, valueText, `value of ${keyName ?? "element"}`);
            }}
            aria-label={`Copy value ${valueText}`}
            title={`Copy value: ${valueText}`}
          >
            {isValCopied ? (
              <>
                <Check className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                <span>Value</span>
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (node.kind === "object") {
    const isRoot = keyName === null;
    const propId = `prop-${path}`;
    const sectionId = `sec-${path}`;
    const isPropCopied = copiedId === propId;
    const isSecCopied = copiedId === sectionId;
    const count = node.entries.length;

    return (
      <div className="flex flex-col">
        <div
          className="group tree-node-row relative flex w-full items-center justify-between rounded px-1.5 py-0.5"
          data-active={isActive}
          onClick={() => setActivePath(isActive ? null : path)}
        >
          <div className="flex min-w-0 flex-1 items-center" style={{ paddingLeft: indentPadding }}>
            <button
              type="button"
              className="mr-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(path);
              }}
              aria-label={isCollapsed ? "Expand object" : "Collapse object"}
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {keyName !== null && (
              <>
                <span className="code-key shrink-0">&quot;{keyName}&quot;</span>
                <span className="code-punctuation mr-1.5 shrink-0">:</span>
              </>
            )}

            <span className="code-punctuation shrink-0">&#123;</span>

            {isCollapsed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse(path);
                }}
                className="mx-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                ... {count} {count === 1 ? "property" : "properties"}
              </button>
            )}

            {isCollapsed && (
              <>
                <span className="code-punctuation shrink-0">&#125;</span>
                {!isLast && <span className="code-punctuation">,</span>}
              </>
            )}
          </div>

          <div
            className="sticky right-0 ml-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 data-[visible=true]:opacity-100"
            data-visible={isActive}
          >
            {keyName !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] font-sans"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(propId, formatJsonProperty(keyName, node), `property "${keyName}"`);
                }}
                aria-label={`Copy property "${keyName}"`}
                title={`Copy property "${keyName}": { ... }`}
              >
                {isPropCopied ? (
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
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] font-sans"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(sectionId, node.raw, isRoot ? "root object" : `object "${keyName ?? ""}"`);
              }}
              aria-label={`Copy section ${keyName ? `"${keyName}"` : ""}`}
              title="Copy object section as formatted JSON"
            >
              {isSecCopied ? (
                <>
                  <Check className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                  <span>Section</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {node.entries.map((entry, idx) => (
              <JsonNodeRenderer
                key={entry.key}
                node={entry.value}
                path={`${path}.${entry.key}`}
                depth={depth + 1}
                isLast={idx === node.entries.length - 1}
                keyName={entry.key}
                collapsedPaths={collapsedPaths}
                toggleCollapse={toggleCollapse}
                activePath={activePath}
                setActivePath={setActivePath}
                copiedId={copiedId}
                onCopy={onCopy}
                rootId=""
              />
            ))}

            <div
              className="tree-node-row flex w-full items-center rounded px-1.5 py-0.5"
              style={{ paddingLeft: indentPadding }}
            >
              <span className="inline-block w-4 shrink-0" />
              <span className="code-punctuation">&#125;</span>
              {!isLast && <span className="code-punctuation">,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  if (node.kind === "array") {
    const isRoot = keyName === null;
    const propId = `prop-${path}`;
    const sectionId = `sec-${path}`;
    const isPropCopied = copiedId === propId;
    const isSecCopied = copiedId === sectionId;
    const count = node.items.length;

    return (
      <div className="flex flex-col">
        <div
          className="group tree-node-row relative flex w-full items-center justify-between rounded px-1.5 py-0.5"
          data-active={isActive}
          onClick={() => setActivePath(isActive ? null : path)}
        >
          <div className="flex min-w-0 flex-1 items-center" style={{ paddingLeft: indentPadding }}>
            <button
              type="button"
              className="mr-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(path);
              }}
              aria-label={isCollapsed ? "Expand array" : "Collapse array"}
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {keyName !== null && (
              <>
                <span className="code-key shrink-0">&quot;{keyName}&quot;</span>
                <span className="code-punctuation mr-1.5 shrink-0">:</span>
              </>
            )}

            <span className="code-punctuation shrink-0">&#91;</span>

            {isCollapsed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse(path);
                }}
                className="mx-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                ... {count} {count === 1 ? "item" : "items"}
              </button>
            )}

            {isCollapsed && (
              <>
                <span className="code-punctuation shrink-0">&#93;</span>
                {!isLast && <span className="code-punctuation">,</span>}
              </>
            )}
          </div>

          <div
            className="sticky right-0 ml-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 data-[visible=true]:opacity-100"
            data-visible={isActive}
          >
            {keyName !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] font-sans"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(propId, formatJsonProperty(keyName, node), `property "${keyName}"`);
                }}
                aria-label={`Copy property "${keyName}"`}
                title={`Copy property "${keyName}": [ ... ]`}
              >
                {isPropCopied ? (
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
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] font-sans"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(sectionId, node.raw, isRoot ? "root array" : `array "${keyName ?? ""}"`);
              }}
              aria-label={`Copy array ${keyName ? `"${keyName}"` : ""}`}
              title="Copy array section as formatted JSON"
            >
              {isSecCopied ? (
                <>
                  <Check className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                  <span>Section</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {node.items.map((item, idx) => (
              <JsonNodeRenderer
                key={`${path}[${idx}]`}
                node={item}
                path={`${path}[${idx}]`}
                depth={depth + 1}
                isLast={idx === node.items.length - 1}
                keyName={null}
                collapsedPaths={collapsedPaths}
                toggleCollapse={toggleCollapse}
                activePath={activePath}
                setActivePath={setActivePath}
                copiedId={copiedId}
                onCopy={onCopy}
                rootId=""
              />
            ))}

            <div
              className="tree-node-row flex w-full items-center rounded px-1.5 py-0.5"
              style={{ paddingLeft: indentPadding }}
            >
              <span className="inline-block w-4 shrink-0" />
              <span className="code-punctuation">&#93;</span>
              {!isLast && <span className="code-punctuation">,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}

/**
 * Renders a primitive JSON value. Strings longer than MAX_INLINE chars are
 * truncated with a "Show full value" toggle so they don't push the layout wide.
 */
function PrimitiveValueSpan({ node }: { node: { kind: "primitive"; value: unknown; raw: string } }) {
  const [expanded, setExpanded] = useState(false);

  if (node.value === null) {
    return <span className="code-null">null</span>;
  }
  if (typeof node.value === "boolean") {
    return <span className="code-boolean">{String(node.value)}</span>;
  }
  if (typeof node.value === "number") {
    return <span className="code-number">{node.value}</span>;
  }

  // String — apply truncation for long values
  const display = JSON.stringify(node.value) as string;
  if (display.length > MAX_INLINE) {
    return (
      <span className="code-string min-w-0 break-all">
        {expanded ? display : `${display.slice(0, MAX_INLINE)}…`}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="ml-1.5 inline rounded bg-muted px-1 py-0.5 text-[10px] font-sans text-muted-foreground hover:text-foreground"
          title={expanded ? "Collapse value" : "Show full value"}
        >
          {expanded ? "Hide" : "Show full"}
        </button>
      </span>
    );
  }

  return <span className="code-string">{display}</span>;
}
