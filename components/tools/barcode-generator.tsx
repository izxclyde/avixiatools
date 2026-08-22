"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Download,
  Copy,
  Check,
  Loader2,
  Info,
  Plus,
  Trash2,
  AlertCircle,
  Upload,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BARCODE_TYPES,
  buildBwipOptions,
  filterContent,
  friendlyBwipError,
  isContentCompatible,
  validateContent,
  type BarcodeOptions,
  type BarcodeType,
} from "@/lib/logic/barcode";
import { downloadBlob } from "@/lib/download";
import { ShareButton } from "@/components/tools/share-button";

// Tailwind class for the checkerboard shown behind a transparent preview.
const CHECKERBOARD_CLASS =
  "bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]";

interface BatchItem {
  id: string;
  content: string;
  status: "pending" | "generating" | "done" | "error";
  dataUrl?: string;
}

const defaultOptions: BarcodeOptions = {
  padding: 2,
  foregroundColor: "#000000",
  backgroundColor: "#ffffff",
  transparentBg: false,
  showText: true,
};

const typeSlug = (type: BarcodeType) =>
  BARCODE_TYPES[type].name.toLowerCase().replace(/\s+/g, "-");

export default function BarcodeGenerator() {
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");
  const [codeType, setCodeType] = useState<BarcodeType>("datamatrix");
  const [content, setContent] = useState("");
  const [size, setSize] = useState(300);
  const [options, setOptions] = useState<BarcodeOptions>(defaultOptions);
  const [codeDataUrl, setCodeDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{ blob: Blob; filename: string } | null>(null);

  // Batch state
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchGenerating, setBatchGenerating] = useState(false);

  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    // Reset on mount too — StrictMode (dev default) runs mount→cleanup→mount,
    // and without this the flag stays false after the remount and every
    // guarded setState is skipped, freezing the preview.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle code type change - clear content if incompatible
  const handleCodeTypeChange = (newType: BarcodeType) => {
    if (!isContentCompatible(content, newType)) {
      setContent("");
    }
    setCodeType(newType);
  };

  // Handle content change - filter to allowed characters
  const handleContentChange = (value: string) => {
    setContent(filterContent(value, codeType));
  };

  // Generate barcode using bwip-js (toCanvas is synchronous)
  const generateCode = useCallback(async () => {
    if (!content.trim()) {
      setCodeDataUrl(null);
      setError(null);
      return;
    }

    const validationError = validateContent(content, codeType);
    if (validationError) {
      setError(validationError);
      setCodeDataUrl(null);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const bwipjs = await import("bwip-js/browser");

      const canvas = document.createElement("canvas");
      bwipjs.toCanvas(canvas, buildBwipOptions(codeType, content, size, options));
      const dataUrl = canvas.toDataURL("image/png");

      if (!isMountedRef.current) return;
      setCodeDataUrl(dataUrl);
    } catch (err) {
      console.error("Code generation failed:", err);
      if (!isMountedRef.current) return;
      setError(friendlyBwipError(err));
      setCodeDataUrl(null);
    } finally {
      if (isMountedRef.current) setGenerating(false);
    }
  }, [content, codeType, size, options]);

  // Regenerate when dependencies change
  useEffect(() => {
    const debounce = setTimeout(() => {
      generateCode();
    }, 300);
    return () => clearTimeout(debounce);
  }, [generateCode]);

  // Render an offscreen canvas for export/batch; returns null on failure.
  const renderCanvas = async (
    text: string
  ): Promise<HTMLCanvasElement | null> => {
    try {
      const bwipjs = await import("bwip-js/browser");
      const canvas = document.createElement("canvas");
      bwipjs.toCanvas(canvas, buildBwipOptions(codeType, text, size, options));
      return canvas;
    } catch (err) {
      console.error("Code generation failed:", err);
      return null;
    }
  };

  const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

  // Download functions — blobs only (data URLs break iOS Safari downloads)
  const downloadCode = async (format: "png" | "svg") => {
    if (!codeDataUrl) return;

    const validationError = validateContent(content, codeType);
    if (validationError) return;

    let blob: Blob | null = null;
    if (format === "svg") {
      const bwipjs = await import("bwip-js/browser");
      const svg = bwipjs.toSVG(
        buildBwipOptions(codeType, content, size, options)
      );
      blob = new Blob([svg], { type: "image/svg+xml" });
    } else {
      const canvas = await renderCanvas(content);
      blob = canvas ? await canvasToBlob(canvas) : null;
    }
    if (!blob) return;
    const filename = `${typeSlug(codeType)}-${Date.now()}.${format}`;
    downloadBlob(blob, filename);
    setShareTarget({ blob, filename });
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    if (!codeDataUrl) return;

    try {
      const canvas = await renderCanvas(content);
      if (!canvas) return;
      const blob = await canvasToBlob(canvas);
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // Batch handlers
  const addBatchItem = () => {
    setBatchItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        content: "",
        status: "pending",
      },
    ]);
  };

  const removeBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateBatchItem = (id: string, value: string) => {
    const filtered = filterContent(value, codeType);
    setBatchItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, content: filtered } : item
      )
    );
  };

  const handleBatchFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text
        .split(/\r?\n/)
        .map((line) => filterContent(line.trim(), codeType))
        .filter((line) => line.length > 0);

      const newItems: BatchItem[] = lines.map((line) => ({
        id: crypto.randomUUID(),
        content: line,
        status: "pending",
      }));

      setBatchItems((prev) => [...prev, ...newItems]);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const generateBatch = async () => {
    if (batchItems.length === 0) return;

    setBatchGenerating(true);
    const JSZip = (await import("jszip")).default;
    if (!isMountedRef.current) return;

    const zip = new JSZip();

    for (const item of batchItems) {
      if (!isMountedRef.current) return;
      if (!item.content.trim()) continue;

      if (validateContent(item.content, codeType)) {
        setBatchItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error" } : i))
        );
        continue;
      }

      setBatchItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "generating" } : i
        )
      );

      try {
        const canvas = await renderCanvas(item.content);
        if (!canvas) throw new Error("render failed");
        const blob = await canvasToBlob(canvas);
        if (!isMountedRef.current) return;
        if (!blob) throw new Error("encode failed");

        const safeName = item.content
          .slice(0, 30)
          .replace(/[^a-zA-Z0-9]/g, "_");
        zip.file(`${typeSlug(codeType)}-${safeName}.png`, blob);

        const dataUrl = canvas.toDataURL("image/png");
        if (!isMountedRef.current) return;

        setBatchItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "done", dataUrl } : i
          )
        );
      } catch {
        if (!isMountedRef.current) return;
        setBatchItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error" } : i))
        );
      }
    }

    // Download ZIP
    const zipBlob = await zip.generateAsync({ type: "blob" });
    if (!isMountedRef.current) return;
    const zipName = `${typeSlug(codeType)}-batch-${Date.now()}.zip`;
    downloadBlob(zipBlob, zipName);
    setShareTarget({ blob: zipBlob, filename: zipName });

    if (isMountedRef.current) setBatchGenerating(false);
  };

  const currentType = BARCODE_TYPES[codeType];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Code Type Selector */}
        <div className="space-y-3">
          <Label className="text-lg font-bold">Code Type</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(BARCODE_TYPES) as BarcodeType[]).map((key) => (
              <Tooltip key={key}>
                <TooltipTrigger
                  render={
                    <Button
                      variant={codeType === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleCodeTypeChange(key)}
                      className="text-xs"
                    >
                      {BARCODE_TYPES[key].name}
                    </Button>
                  }
                />
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-bold">{BARCODE_TYPES[key].name}</p>
                  <p className="text-xs text-muted-foreground">
                    {BARCODE_TYPES[key].description}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Mode Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single</TabsTrigger>
            <TabsTrigger value="batch">Batch Mode</TabsTrigger>
          </TabsList>

          <div className="mt-3 border-2 border-border">
            {/* Single Mode */}
            <TabsContent value="single" className="m-0">
              {/* Content Input */}
              <div className="space-y-2 border-b-2 border-border p-4">
                <Label className="font-bold">Content</Label>
                <Input
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder={currentType.placeholder}
                  className="h-12 text-base"
                />
                <p className="text-xs text-muted-foreground">
                  {currentType.charHint}
                </p>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>

              {/* Main Content Area */}
              <div className="grid lg:grid-cols-2">
                {/* Preview */}
                <div className="space-y-4 border-b-2 border-border p-4 lg:border-b-0 lg:border-r-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-bold">Preview</Label>
                    {currentType.category === "1d" && (
                      <div className="flex items-center gap-2">
                        <Switch
                          id="show-text"
                          checked={options.showText}
                          onCheckedChange={(checked) =>
                            setOptions((prev) => ({
                              ...prev,
                              showText: checked,
                            }))
                          }
                        />
                        <Label
                          htmlFor="show-text"
                          className="text-sm font-normal text-muted-foreground"
                        >
                          Show numbers
                        </Label>
                      </div>
                    )}
                  </div>
                  <div
                    className={`-mx-4 flex min-h-[280px] items-center justify-center border border-x-0 border-border p-4 ${options.transparentBg ? CHECKERBOARD_CLASS : ""}`}
                    style={
                      options.transparentBg
                        ? undefined
                        : { backgroundColor: options.backgroundColor }
                    }
                  >
                    {generating ? (
                      <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    ) : codeDataUrl ? (
                      <img
                        src={codeDataUrl}
                        alt={currentType.name}
                        style={{ maxWidth: size, height: "auto" }}
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <p>
                          Enter content to generate {currentType.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      size="lg"
                      onClick={() => downloadCode("png")}
                      disabled={!codeDataUrl}
                      className="h-12"
                    >
                      <Download className="mr-2 size-5" />
                      PNG
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => downloadCode("svg")}
                      disabled={!codeDataUrl}
                      className="h-12"
                    >
                      <Download className="mr-2 size-5" />
                      SVG
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={copyToClipboard}
                      disabled={!codeDataUrl}
                      className="h-12"
                    >
                      {copied ? (
                        <>
                          <Check className="mr-2 size-5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 size-5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  {shareTarget && (
                    <div className="flex justify-end">
                      <ShareButton
                        blob={shareTarget.blob}
                        filename={shareTarget.filename}
                        variant="outline"
                        size="lg"
                        className="h-12 px-6"
                      />
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-4 p-4">
                  <Label className="text-lg font-bold">Options</Label>
                  <Accordion
                    multiple
                    defaultValue={["basic", "colors"]}
                    className="-mx-4 border-t border-border"
                  >
                    {/* Basic Options */}
                    <AccordionItem
                      value="basic"
                      className="border-b border-border"
                    >
                      <AccordionTrigger className="px-4 font-bold">
                        Basic Settings
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 px-4 pb-4">
                        {/* Size */}
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label>Size</Label>
                            <span className="text-sm text-muted-foreground">
                              {size}px
                            </span>
                          </div>
                          <Slider
                            value={size}
                            onValueChange={setSize}
                            min={100}
                            max={600}
                            step={10}
                          />
                        </div>

                        {/* Padding */}
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label>Padding</Label>
                            <span className="text-sm text-muted-foreground">
                              {options.padding}
                            </span>
                          </div>
                          <Slider
                            value={options.padding}
                            onValueChange={(v) =>
                              setOptions((prev) => ({ ...prev, padding: v }))
                            }
                            min={0}
                            max={10}
                            step={1}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Colors */}
                    <AccordionItem
                      value="colors"
                      className="border-b border-border"
                    >
                      <AccordionTrigger className="px-4 font-bold">
                        Colours
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 px-4 pb-4">
                        <div className="-mx-4 border-y border-border">
                          {/* Foreground */}
                          <div className="flex items-stretch border-b border-border">
                            <span className="flex w-28 shrink-0 items-center px-4 text-sm">
                              Foreground
                            </span>
                            <div className="relative w-12 shrink-0 border-l border-border">
                              <div
                                className="size-full"
                                style={{
                                  backgroundColor: options.foregroundColor,
                                }}
                                aria-hidden
                              />
                              <input
                                type="color"
                                aria-label="Foreground colour"
                                value={options.foregroundColor}
                                onChange={(e) =>
                                  setOptions((prev) => ({
                                    ...prev,
                                    foregroundColor: e.target.value,
                                  }))
                                }
                                className="absolute inset-0 size-full cursor-pointer opacity-0"
                              />
                            </div>
                            <Input
                              value={options.foregroundColor}
                              onChange={(e) =>
                                setOptions((prev) => ({
                                  ...prev,
                                  foregroundColor: e.target.value,
                                }))
                              }
                              className="flex-1 border-0 border-l border-border bg-transparent font-mono"
                            />
                          </div>
                          {/* Background */}
                          <div className="flex items-stretch">
                            <span className="flex w-28 shrink-0 items-center px-4 text-sm">
                              Background
                            </span>
                            <div className="relative w-12 shrink-0 border-l border-border">
                              <div
                                className={`size-full ${options.transparentBg ? CHECKERBOARD_CLASS : ""}`}
                                style={
                                  options.transparentBg
                                    ? undefined
                                    : {
                                        backgroundColor:
                                          options.backgroundColor,
                                      }
                                }
                                aria-hidden
                              />
                              <input
                                type="color"
                                aria-label="Background colour"
                                value={options.backgroundColor}
                                disabled={options.transparentBg}
                                onChange={(e) =>
                                  setOptions((prev) => ({
                                    ...prev,
                                    backgroundColor: e.target.value,
                                  }))
                                }
                                className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                              />
                            </div>
                            <Input
                              value={
                                options.transparentBg
                                  ? "transparent"
                                  : options.backgroundColor
                              }
                              disabled={options.transparentBg}
                              onChange={(e) =>
                                setOptions((prev) => ({
                                  ...prev,
                                  backgroundColor: e.target.value,
                                }))
                              }
                              className="flex-1 border-0 border-l border-border bg-transparent font-mono"
                            />
                            <label className="flex shrink-0 cursor-pointer items-center gap-2 border-l border-border px-3 text-sm text-muted-foreground">
                              <Switch
                                checked={options.transparentBg}
                                onCheckedChange={(checked) =>
                                  setOptions((prev) => ({
                                    ...prev,
                                    transparentBg: checked,
                                  }))
                                }
                              />
                              Transparent
                            </label>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </TabsContent>

            {/* Batch Mode */}
            <TabsContent value="batch" className="m-0 space-y-4 p-4">
              <div className="space-y-3">
                {batchItems.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span className="w-6 text-sm text-muted-foreground">
                      {index + 1}.
                    </span>
                    <Input
                      value={item.content}
                      onChange={(e) => updateBatchItem(item.id, e.target.value)}
                      placeholder={currentType.placeholder}
                      className="flex-1"
                    />
                    {item.status === "done" && item.dataUrl && (
                      <img
                        src={item.dataUrl}
                        alt=""
                        className="size-8 rounded"
                      />
                    )}
                    {item.status === "generating" && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {item.status === "error" && (
                      <AlertCircle className="size-4 text-red-500" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBatchItem(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <input
                  ref={batchFileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleBatchFileUpload}
                  className="hidden"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={addBatchItem}>
                    <Plus className="mr-2 size-4" />
                    Add Item
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => batchFileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 size-4" />
                    Upload List
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {currentType.charHint}. Upload a text file with one item per
                  line.
                </p>
                <Button
                  onClick={generateBatch}
                  disabled={batchItems.length === 0 || batchGenerating}
                  className="w-full"
                >
                  {batchGenerating ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Package className="mr-2 size-4" />
                  )}
                  Generate &amp; Download ZIP
                </Button>
                {shareTarget && (
                  <ShareButton
                    blob={shareTarget.blob}
                    filename={shareTarget.filename}
                    variant="outline"
                    className="w-full"
                  />
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Inventor Acknowledgements */}
        <div className="border-2 border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info className="size-5" />
            <h3 className="font-bold">About {currentType.name}</h3>
          </div>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Invented by:</span>{" "}
              {currentType.inventor}
            </p>
            <p>
              <span className="text-muted-foreground">Year:</span>{" "}
              {currentType.year}
            </p>
            <p className="mt-2 text-muted-foreground">
              {currentType.description}
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
