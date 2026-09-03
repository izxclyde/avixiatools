import { test } from "node:test";
import assert from "node:assert/strict";
import { createPdfDoc, getPdfLib, pdfBlob } from "../lib/pdf.ts";

// Regression test for the unlock-pdf S0: saving a password-loaded document
// preserves its encryption, so the tool must copy pages into a fresh document.
async function makeEncrypted() {
  const { PDFDocument, StandardFonts } = await getPdfLib();
  const doc = await createPdfDoc();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText("secret", { x: 50, y: 700, font, size: 12 });
  const clean = await doc.save();
  const src = await PDFDocument.load(clean);
  src.encrypt({ userPassword: "pw123" });
  return { PDFDocument, enc: await src.save() };
}

test("unlock: encrypted pdf refuses passwordless load, opens with password", async () => {
  const { PDFDocument, enc } = await makeEncrypted();
  await assert.rejects(() => PDFDocument.load(enc));
  const opened = await PDFDocument.load(enc, { password: "pw123" });
  assert.equal(opened.getPageCount(), 1);
  await assert.rejects(() => PDFDocument.load(enc, { password: "wrong" }), /incorrect/i);
});

test("unlock: direct save preserves encryption (why fresh-doc copy is required)", async () => {
  const { PDFDocument, enc } = await makeEncrypted();
  const opened = await PDFDocument.load(enc, { password: "pw123" });
  const direct = await opened.save();
  await assert.rejects(() => PDFDocument.load(direct));
});

test("unlock: fresh-doc copyPages produces a genuinely unlocked file", async () => {
  const { PDFDocument, enc } = await makeEncrypted();
  const opened = await PDFDocument.load(enc, { password: "pw123" });
  const out = await createPdfDoc();
  const pages = await out.copyPages(opened, opened.getPageIndices());
  pages.forEach((page) => out.addPage(page));
  const blob = pdfBlob(await out.save());
  assert.equal(blob.type, "application/pdf");
  const round = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  assert.equal(round.getPageCount(), 1);
});
