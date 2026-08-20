import { test } from "node:test";
import assert from "node:assert/strict";
import { parseColour, contrastRatio, generateShades, generatePalette } from "../lib/logic/colour.ts";
import { convertBase, isValidNumber } from "../lib/logic/numbers.ts";
import { convertUnit, UNIT_CATEGORIES } from "../lib/logic/units.ts";
import { countWords, countSentences, countParagraphs, readingTime } from "../lib/logic/text.ts";
import { pxToRem, remToPx, convertTypo, lineHeightRatio } from "../lib/logic/typography.ts";
import { unixToDate, dateToUnix, addToDate, weekdayName } from "../lib/logic/dates.ts";
import { md5Hex, base64Encode, base64Decode, urlEncode, urlDecode, sha256Hex } from "../lib/logic/hash.ts";
import { formatJson, minifyJson, formatXml, minifyXml } from "../lib/logic/format.ts";
import { convertSqlConcat, parseHelpers } from "../lib/logic/sql.ts";

test("colour: parse hex → all formats", () => {
  const c = parseColour("#6633ff");
  assert.ok(c);
  assert.equal(c.hex, "#6633ff");
  assert.ok(c.rgb.startsWith("rgb("));
  assert.ok(c.oklch.startsWith("oklch("));
  assert.equal(parseColour("not-a-colour"), null);
  assert.equal(parseColour(""), null);
});

test("colour: contrast ratio", () => {
  const ratio = contrastRatio("#000000", "#ffffff");
  assert.ok(ratio !== null);
  assert.ok(Math.abs(ratio - 21) < 0.01);
  assert.equal(contrastRatio("garbage", "#fff"), null);
});

test("colour: tailwind shades keep 500 as base and lighten/darken", () => {
  const shades = generateShades("#6633ff");
  assert.equal(shades["500"], "#6633ff");
  assert.equal(Object.keys(shades).length, 11);
  const l = (h) => Number.parseInt(h.slice(1, 3), 16);
  assert.ok(l(shades["50"]) > l(shades["500"]));
  assert.ok(l(shades["950"]) < l(shades["500"]));
});

test("colour: palette has 5 valid hex colours", () => {
  const palette = generatePalette();
  assert.equal(palette.length, 5);
  for (const c of palette) assert.match(c, /^#[0-9a-f]{6}$/);
});

test("numbers: base conversion", () => {
  assert.equal(convertBase("ff", 16, 10), "255");
  assert.equal(convertBase("255", 10, 2), "11111111");
  assert.equal(convertBase("11111111", 2, 16), "ff");
  assert.equal(convertBase("0", 10, 36), "0");
  assert.equal(convertBase("-10", 10, 2), "-1010");
  assert.ok(isValidNumber("ff", 16));
  assert.ok(!isValidNumber("ff", 10));
});

test("units: conversions", () => {
  const length = UNIT_CATEGORIES.find((c) => c.id === "length");
  assert.ok(length);
  assert.ok(Math.abs(convertUnit(length, 1, "km", "m") - 1000) < 1e-9);
  assert.ok(Math.abs(convertUnit(length, 1, "in", "cm") - 2.54) < 1e-9);
  const temp = UNIT_CATEGORIES.find((c) => c.id === "temperature");
  assert.ok(temp);
  assert.ok(Math.abs(convertUnit(temp, 32, "°F", "°C") - 0) < 1e-9);
  assert.ok(Math.abs(convertUnit(temp, 0, "°C", "K") - 273.15) < 1e-9);
});

test("text: counting", () => {
  assert.equal(countWords("hello   world\nfoo"), 3);
  assert.equal(countSentences("One. Two! Three?"), 3);
  assert.equal(countParagraphs("a\n\nb\n\n\nc"), 3);
  assert.equal(readingTime(400, 200), "2m");
});

test("typography: px/rem and unit conversion", () => {
  assert.equal(pxToRem(16), 1);
  assert.equal(remToPx(1.5), 24);
  assert.ok(Math.abs(convertTypo(72, "pt", "in") - 1) < 1e-9);
  assert.ok(Math.abs(convertTypo(16, "px", "pt") - 12) < 1e-9);
  assert.equal(lineHeightRatio(20, 40), 2);
});

test("dates: unix round-trip and arithmetic", () => {
  const d = unixToDate(0);
  assert.equal(dateToUnix(d), 0);
  const next = addToDate(new Date(2026, 0, 31), { months: 1 });
  assert.equal(weekdayName(next), "Saturday");
  assert.ok(Math.abs(next.getTime() - new Date(2026, 1, 28).getTime()) < 1000);
});

test("hash/encoding: known vectors", async () => {
  assert.equal(md5Hex(""), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(md5Hex("abc"), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(base64Encode("hello"), "aGVsbG8=");
  assert.equal(base64Decode("aGVsbG8="), "hello");
  assert.equal(base64Decode("***"), null);
  assert.equal(urlEncode("a b&c"), "a%20b%26c");
  assert.equal(urlDecode("a%20b%26c"), "a b&c");
  assert.equal(urlDecode("%zz"), null);
  assert.equal(await sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("format: json pretty/minify/validate", () => {
  assert.equal(formatJson('{"a":1,"b":[1,2]}'), '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
  assert.equal(minifyJson('{ "a" : 1 }'), '{"a":1}');
  assert.equal(formatJson("{"), null);
  assert.equal(minifyJson(""), null);
});

test("format: xml pretty/minify/validate", () => {
  assert.equal(
    formatXml("<a><b>text</b><c/></a>"),
    "<a>\n  <b>text</b>\n  <c/>\n</a>"
  );
  assert.equal(
    formatXml('<?xml version="1.0"?>\n<a x="1">v</a>'),
    '<?xml version="1.0"?>\n<a x="1">v</a>'
  );
  assert.equal(
    formatXml("<root><a>x</a><p>Hello <b>world</b></p></root>"),
    "<root>\n  <a>x</a>\n  <p>Hello <b>world</b></p>\n</root>"
  );
  assert.equal(formatXml("<p>Hello <b>world</b></p>"), "<p>Hello <b>world</b></p>");
  assert.equal(formatXml("<a>  spaced  </a>"), "<a>  spaced  </a>");
  assert.equal(
    formatXml("<a><b><c>x</c></b></a>"),
    "<a>\n  <b>\n    <c>x</c>\n  </b>\n</a>"
  );
  assert.equal(minifyXml("<a>\n  <b>x</b>\n</a>"), "<a><b>x</b></a>");
  assert.equal(minifyXml("<a><!-- c --><b>x</b></a>"), "<a><!-- c --><b>x</b></a>");
  assert.equal(formatXml("<a></b>"), null);
  assert.equal(minifyXml("<a>"), null);
});

test("sql: VB concatenation becomes parameterized and renders branches", () => {
  const input = `Q = Q & " SELECT CANCEL_FLAG FROM TMS_DO_HDR " & DB.NoLock & " "
Q = Q & " WHERE "
Q = Q & " CANCEL_FLAG = '" & _cancelType & "' "
Q = Q & " AND AMEND_NO = 251"
If _fltrBy = "B" Then
    Q = Q & " AND BARCODE='" & _DONo & "'"
ElseIf _fltrBy = "M" Then
    Q = Q & " AND (MANUAL_DONO='" & _DONo & "' OR DOC_NO='" & _DONo & "')"
End If`;
  const result = convertSqlConcat(input, "vb", `Public Shared ReadOnly Property NoLock As String = "WITH (NOLOCK)"`);
  assert.ok(result);
  assert.equal(result.parameters.length, 2);
  assert.match(result.code, /CANCEL_FLAG = " & @cancelType/);
  assert.match(result.code, /BARCODE=\" & @DONo/);
  assert.ok(result.variants.some((variant) => variant.sql.includes("CANCEL_FLAG = @cancelType")));
  assert.match(result.variants[0].sql, /WITH \(NOLOCK\)/);
  assert.ok(result.variants.some((variant) => variant.sql.includes("BARCODE=@DONo")));
  assert.ok(result.variants.some((variant) => variant.sql.includes("MANUAL_DONO=@DONo")));
  assert.match(result.code, /AMEND_NO = 251/);
});

test("sql: C# concatenation and interpolation", () => {
  const concatenated = convertSqlConcat(`Q = Q + "SELECT * FROM T WHERE ID='" + id + "'";`, "cs");
  assert.ok(concatenated);
  assert.match(concatenated.code, /ID=\" \+ @id/);
  assert.equal(concatenated.parameters[0].expr, "id");

  const interpolated = convertSqlConcat(`var q = $"SELECT * FROM T WHERE CODE='{code}'";`, "cs");
  assert.ok(interpolated);
  assert.match(interpolated.code, /CODE=@code/);
  assert.equal(interpolated.variants[0].sql, "SELECT * FROM T WHERE CODE=@code");
});

test("sql: helper parsing preserves helper expressions and values", () => {
  const helpers = parseHelpers(`Public Shared ReadOnly Property NoLock As String = "WITH (NOLOCK)"`);
  assert.ok(helpers.names.has("NoLock"));
  const result = convertSqlConcat(`Q = Q & "SELECT * FROM T " & DB.NoLock`, "vb", `Public Shared ReadOnly Property NoLock As String = "WITH (NOLOCK)"`);
  assert.ok(result);
  assert.equal(result.parameters.length, 0);
  assert.equal(result.variants[0].sql, "SELECT * FROM T WITH (NOLOCK)");
});

test("sql: += concatenation with VB-style & values", () => {
  const result = convertSqlConcat(`q = " SELECT GPS_ASSET_ID "
q += "   FROM TMS_GPS_HDR "
q += "  WHERE DOOR_CODE = '" & _DoorCode & "' "`, "vb");
  assert.ok(result);
  assert.equal(result.parameters.length, 1);
  assert.equal(result.parameters[0].name, "@DoorCode");
  assert.match(result.code, /q \+= "  WHERE DOOR_CODE = " & @DoorCode/);
  assert.ok(result.variants[0].sql.includes("SELECT GPS_ASSET_ID"));
  assert.ok(result.variants[0].sql.includes("WHERE DOOR_CODE = @DoorCode"));
});

test("sql: C# += and VB &= compound assignments", () => {
  const csharp = convertSqlConcat(`q = "SELECT * FROM T"
q += " WHERE X='" + x + "'";`, "cs");
  assert.ok(csharp);
  assert.equal(csharp.parameters.length, 1);
  assert.ok(csharp.variants[0].sql.includes("WHERE X=@x"));

  const vb = convertSqlConcat(`Q = "SELECT * FROM T"
Q &= " WHERE Y='" & y & "'"`, "vb");
  assert.ok(vb);
  assert.equal(vb.parameters.length, 1);
  assert.ok(vb.variants[0].sql.includes("WHERE Y=@y"));
});

test("sql: fresh-start assignment without self-reference", () => {
  const result = convertSqlConcat(`Q = "SELECT * FROM T WHERE A='" & a & "'"
Q = Q & " AND B='" & b & "'"`, "vb");
  assert.ok(result);
  assert.equal(result.parameters.length, 2);
  assert.ok(result.variants[0].sql.includes("WHERE A=@a"));
  assert.ok(result.variants[0].sql.includes("AND B=@b"));
});

test("sql: multiple query variables each get a rendered query", () => {
  const result = convertSqlConcat(`Q = Q & "SELECT A FROM T1"
Sql = Sql & "SELECT B FROM T2"`, "vb");
  assert.ok(result);
  assert.equal(result.variants.length, 2);
  assert.ok(result.variants.some((variant) => variant.sql.includes("SELECT A FROM T1")));
  assert.ok(result.variants.some((variant) => variant.sql.includes("SELECT B FROM T2")));
});
