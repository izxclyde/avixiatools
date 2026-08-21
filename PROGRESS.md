# avixiatools — Progress Tracker

**Status:** Wave 1 (MVP) complete — 15 tools built and verified, plus 3 Developer/Other tools. Waves 2-5 planned, ~42 tools remaining. Site is currently **Developer + Other**: the Colour and Typography & Text tools are disabled (kept on disk, hidden from nav/routes).

**Tech Stack:**
- Next.js 16.3.1 (App Router)
- React 19.2.8 + TypeScript
- Tailwind CSS v4
- shadcn/ui components
- MIT-licensed source reference (attribution included)

**Wave 1 — 15 MVP Tools (built & verified, Colour + Typography & Text currently disabled):**

| Category | Tools | Status |
|---|---|---|
| Colour | Colour Converter ✅, Contrast Checker ✅, Gradient Generator ✅, Tailwind Shade Generator ✅, Palette Generator ✅ | Disabled |
| Typography & Text | Word Counter ✅, PX to REM ✅, Line Height Calculator ✅, Typography Calculator ✅, Paper Sizes ✅, Text Diff ✅ | Disabled (Text Diff moved to Developer) |
| Calculators | Base Converter ✅, Unit Converter ✅, Time Calculator ✅, Encoding Tools ✅ | Moved to Developer |

**Developer (8 tools built & verified):**
- JSON Formatter ✅ — pretty-print, minify, validate
- XML Formatter ✅ — pretty-print, minify, validate (hand-rolled tokenizer, no dependency)
- SQL Formatter ✅ — pretty-print for SQL Server/T-SQL, Oracle/PLSQL, MySQL, PostgreSQL, SQLite, BigQuery, Snowflake, and more (via `sql-formatter`); dialect auto-detect (incl. `@param`/table-hint T-SQL), keyword case, indent, operator placement; falls back across dialects instead of erroring on parameterized SQL
- SQL to Code ✅ — reverse of SQL Query Converter: generate legacy VB (`&=`)/C# (`+=`) concatenation code from a SQL query with `@params`; configurable variable name, parameter prefix, and string-value quoting (hand-rolled tokenizer, no dependency)
- Base Converter, Unit Converter, Time Calculator, Encoding Tools — moved from Calculators
- Text Diff — moved from Typography & Text

**Other (3 tools built & verified):**
- QR Generator ✅ — styled QR codes with custom colors, shapes, and logos (via `qr-code-styling`, `jszip`); Single, WiFi, vCard, and Batch tabs; presets, PNG/SVG export, copy, and info caption (adapted from MIT-licensed delphitools, attributed in `ACKNOWLEDGEMENTS.md`)
- Barcode Generator ✅ — Micro QR, Data Matrix, Aztec, PDF417, Code 128, Code 39, EAN-13, and UPC-A via `bwip-js`; Single and Batch tabs; charset filtering with auto-uppercase (Code 39), EAN-13/UPC-A mod-10 check-digit validation; size/padding sliders, colours + transparency, "Show numbers" toggle for 1D codes; PNG/SVG export, copy, batch ZIP (adapted from MIT-licensed delphitools, attributed in `ACKNOWLEDGEMENTS.md`)
- Background Remover ✅ — automatic in-browser background removal via `@huggingface/transformers` + `briaai/RMBG-1.4` (WebGPU with WASM fallback); drop/paste/select input, download progress for the one-time ~180MB model fetch, side-by-side preview with checkerboard transparency, PNG export (adapted from MIT-licensed delphitools, attributed in `ACKNOWLEDGEMENTS.md`)

**Pages:**
- Report an issue ✅ — `/report` creates GitHub issues automatically via the API (server-side `app/api/report` route, needs `GITHUB_TOKEN`); honeypot spam guard; footer + site credit link to hcnatividad.com

**Unfinished Waves:**

**Wave 2 — Typography & Text remaining (5 tools):**
- Typo Calculator — convert between pt, picas, inches, agates, ciceros, em, rem
- Line Height Calculator — already done but could add em/rem support
- Paper Sizes — already done but could add more ISO/B series
- Text Diff — already done but could add char-level diff toggle
- Word Counter — already done but could add reading level stats

**Wave 3 — Colour remaining (5 tools):**
- Colour Blindness Simulator — simulate deuteranopia, protanopia, tritanopia
- Gradient Generator — add mesh gradients + more preset shapes
- Tailwind Shade Generator — add more weight steps or preview CSS vars
- Palette Generator — add palette collections + save/load palettes
- Contrast Checker — already done but could add AA/AAA large text badges + ratio details

**Wave 4 — Images & Assets (13 tools):**
- Image Clipper — trim transparent edges from PNGs
- Image Converter — convert between PNG, JPEG, WebP, JXL, GIF, BMP, TIFF, ICO, ICNS
- Favicon Generator — generate favicons from any image
- SVG Optimiser — optimise and minify SVG files
- Placeholder Generator — generate placeholder images
- Base64 Image Encoder — convert images to Base64 strings
- Palette Extractor — extract colour palettes from images
- Image Tracer — trace raster images to SVG vectors
- Paste Image — paste and download an image from clipboard
- Artwork Enhancer — add colour noise overlay to artwork
- ~~Background Remover~~ ✅ — done, shipped under Other (see above)
- Substrata — arrange and mark up images in the browser (image editor)

**Wave 5 — Social + Misc + Calculators + Other (14 tools):**
- Matte Generator — put non-square images on a square matte
- Seamless Scroll Generator — split images for Instagram carousel scrolls
- Social Media Cropper — crop images for Instagram, Bluesky & Threads
- Watermarker — add watermarks to images
- Harmony Generator — generate colour harmonies
- Palette Collection — browse curated colour palettes
- ~~Barcode Generator~~ ✅ — done, shipped under Other (see above)
- Meta Tag Generator — generate HTML meta tags
- Regex Tester — test regular expressions
- Tailwind Cheat Sheet — quick reference for Tailwind classes
- Text Scratchpad — text editor with manipulation tools
- Cipher Decoder — decode classical ciphers manually or auto-detect the cipher
- Shavian Transliterator — transliterate English text to the Shavian alphabet

**Verification (waves 2-5):**
- `npm run build` — passes after each wave
- `npm run lint` — passes
- `npm test` — 10/10 logic tests continue to pass
- All tools render interactively at `http://localhost:3000`

**How to Continue (Wave 2+):**
1. Create a component in `components/tools/<slug>.tsx`
2. Add an entry to `lib/tools.ts` (TOOLS array + CATEGORIES)
3. The dynamic route `/tools/[slug]/page.tsx` auto-picks it up via `toolComponents` map in `components/tools/index.tsx`
4. Reference the MIT-licensed delphitools source for logic accuracy, with attribution in `ACKNOWLEDGEMENTS.md`

**Dependencies already installed:**
- `culori` (colour math), `lucide-react` (icons), `diff` (text diff), `sql-formatter` (SQL formatting), `bwip-js` (barcode rendering), `qr-code-styling` (QR codes), `jszip` (batch ZIP downloads)
- `@types/culori` (TypeScript types for culori)
- shadcn/ui components: card, input, label, select, textarea, tabs, sheet, scroll-area, separator, badge, tooltip, switch, etc.

**Current verification:**
- `npm run build` — passes (Next.js 16 Turbopack)
- `npm run lint` — passes
- `npm test` — 41/41 logic tests pass
- All 11 Developer/Other tools render interactively at `http://localhost:3000`

---
*This file is the single source of truth for project state. If context is lost, resume from here.*