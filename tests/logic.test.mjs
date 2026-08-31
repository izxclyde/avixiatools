import { test } from "node:test";
import assert from "node:assert/strict";
import { parseColour, contrastRatio, generateShades, generatePalette } from "../lib/logic/colour.ts";
import { convertBase, isValidNumber } from "../lib/logic/numbers.ts";
import { convertUnit, UNIT_CATEGORIES } from "../lib/logic/units.ts";
import { countWords, countSentences, countParagraphs, readingTime } from "../lib/logic/text.ts";
import { pxToRem, remToPx, convertTypo, lineHeightRatio } from "../lib/logic/typography.ts";
import { unixToDate, dateToUnix, addToDate, weekdayName, detectEpochPrecision, epochToSeconds, epochPrecisions } from "../lib/logic/dates.ts";
import { md5Hex, base64Encode, base64Decode, urlEncode, urlDecode, sha256Hex } from "../lib/logic/hash.ts";
import { formatJson, minifyJson, formatXml, minifyXml } from "../lib/logic/format.ts";
import { convertSqlConcat, parseHelpers } from "../lib/logic/sql.ts";
import { sqlToCode } from "../lib/logic/sql-to-code.ts";
import { formatSql, detectDialect } from "../lib/logic/sql-format.ts";
import { generateWiFiString, generateVCardString } from "../lib/logic/qr.ts";
import { mod10CheckDigit, validateContent, filterContent, buildBwipOptions, friendlyBwipError } from "../lib/logic/barcode.ts";
import { parsePageRanges, parseRangeSegment, chunkPages, formatPageLabel, outputName, formatBytes, sanitizeWinAnsi } from "../lib/logic/pdf.ts";
import { parseCsv, splitColumns } from "../lib/logic/csv.ts";
import { mdToContent } from "../lib/pdfdoc.ts";

const sqlOpts = {
  keywordCase: "upper",
  tabWidth: 2,
  useTabs: false,
  logicalOperatorNewline: "before",
  linesBetweenQueries: 1,
};

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

test("dates: epoch precision detection and conversion", () => {
  assert.equal(detectEpochPrecision("1750000000"), "s");
  assert.equal(detectEpochPrecision("1750000000000"), "ms");
  assert.equal(detectEpochPrecision("1750000000000000"), "us");
  assert.equal(detectEpochPrecision("1750000000000000000"), "ns");
  assert.equal(epochToSeconds("1750000000000"), 1750000000);
  assert.equal(epochToSeconds("1750000000000000"), 1750000000);
  assert.ok(Math.abs(epochToSeconds("1750000000000000000") - 1750000000) < 1);
  assert.equal(epochToSeconds("0"), 0);
  assert.equal(epochToSeconds("-86400"), -86400);
  assert.equal(epochToSeconds("1750000000.5"), 1750000000.5);
  assert.equal(epochToSeconds("abc"), null);
  assert.equal(epochToSeconds(""), null);
  const p = epochPrecisions(unixToDate(1750000000));
  assert.equal(p.s, "1750000000");
  assert.equal(p.ms, "1750000000000");
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

test("sql: function helpers (ConCat, NoLock, IsNull) resolve to values", () => {
  const helpers = `Public Shared Function ConCat() As String
    Return If(clsDB.isSQLDB(), "+", "||")
End Function
Public Shared Function NoLock() As String
    Return If(clsDB.isSQLDB(), " WITH(NOLOCK) ", "")
End Function
Public Shared Function IsNull() As String
    Return If(clsDB.isSQLDB(), "ISNULL", "NVL")
End Function`;
  const result = convertSqlConcat(`Q = Q & "SELECT A FROM T " & NoLock()
Q = Q & " WHERE B = 1 " & ConCat() & " C = IsNull() "`, "vb", helpers);
  assert.ok(result);
  assert.match(result.variants[0].sql, /WITH\(NOLOCK\)/);
  assert.ok(result.variants[0].sql.includes("+"));
  assert.ok(!result.variants[0].sql.includes("ConCat()"));
  assert.ok(result.variants[0].sql.includes("IsNull()"));
});

test("sql: parameterized function helpers (TrimStr, Cast*) resolve with args", () => {
  const helpers = `Public Shared Function TrimStr(field As String) As String
    Return If(clsDB.isSQLDB(), "LTRIM(RTRIM(" & field & "))", "TRIM(" & field & ")")
End Function
Public Shared Function CastVarChar(Column As String) As String
    Return If(clsDB.isSQLDB(), "CAST(" & Column & " AS VARCHAR) ", "TO_CHAR(" & Column & ")")
End Function`;
  const result = convertSqlConcat(`Q = Q & "SELECT " & CastVarChar(TP_CODE) & " FROM T "
Q = Q & " WHERE X = '" & _code & "' "
Q = Q & " AND Y = TrimStr(_name) "`, "vb", helpers);
  assert.ok(result);
  assert.ok(result.variants[0].sql.includes("CAST"));
  assert.ok(result.variants[0].sql.includes("VARCHAR"));
});

test("sql: nested helper calls and default args resolve (CastDecimal)", () => {
  const helpers = `Public Shared Function CastDecimal(Column As String, Optional Precision As String = "2") As String
    Return If(clsDB.isSQLDB(), "CAST(" & Column & " AS DECIMAL(15," & Precision & ")) ", "TO_NUMBER(TRIM(" & Column & ")," & ("'999999999.").PadRight(CInt(Precision), "9") & "')")
End Function`;
  const result = convertSqlConcat(`Q = Q & "SELECT " & CastDecimal(TP_AMT) & " FROM T"`, "vb", helpers);
  assert.ok(result);
  assert.ok(result.variants[0].sql.includes("DECIMAL(15,2)"));
});

test("sql: control-flow helper (GetDate with IsSQLDB) resolves to SQL branch", () => {
  const helpers = `Public Shared Function GetDate() As String
    If clsDB.isSQLDB() Then
        Return "CONVERT(DATETIME2, GETDATE())"
    Else
        Return "SYSDATE"
    End If
End Function`;
  const result = convertSqlConcat(`Q = Q & "SELECT * FROM T WHERE TS = " & GetDate()`, "vb", helpers);
  assert.ok(result);
  assert.ok(result.variants[0].sql.includes("CONVERT(DATETIME2, GETDATE())"));
});

test("sql: full clsDB helper block resolves SQL-output helpers", () => {
  const helpers = `Public Shared Function INITCAP() As String
    Return If(clsDB.isSQLDB(), "dbo.INITCAP", "INITCAP")
End Function
Public Shared Function NoLock() As String
    Return If(clsDB.isSQLDB(), " WITH(NOLOCK) ", "")
End Function
Public Shared Function ConCat() As String
    Return If(clsDB.isSQLDB(), "+", "||")
End Function
Public Shared Function TrimStr(field As String) As String
    Return If(clsDB.isSQLDB(), "LTRIM(RTRIM(" & field & "))", "TRIM(" & field & ")")
End Function`;
  const result = convertSqlConcat(`Q = Q & "SELECT " & INITCAP() & "(A) FROM T " & NoLock()
Q = Q & " WHERE X = '" & _code & "' " & ConCat() & " AND Y = " & TrimStr(_name) `, "vb", helpers);
  assert.ok(result);
  const sql = result.variants[0].sql;
  assert.ok(sql.includes("dbo.INITCAP"));
  assert.ok(sql.includes("WITH(NOLOCK)"));
  assert.ok(sql.includes("+"));
  assert.ok(sql.includes("LTRIM(RTRIM"));
});

test("sql: qualified parameterless helper (DB.NoLock) resolves", () => {
  const helpers = `Public Shared Function NoLock() As String
    Return If(clsDB.isSQLDB(), " WITH(NOLOCK) ", "")
End Function`;
  const result = convertSqlConcat(`Q = Q & " SELECT CANCEL_FLAG FROM TMS_DO_HDR " & DB.NoLock & " "
Q = Q & " WHERE "
Q = Q & " CANCEL_FLAG = '" & _cancelType & "' "
Q = Q & " AND AMEND_NO = 251"
If _fltrBy = "B" Then
    Q = Q & " AND BARCODE='" & _DONo & "'"
ElseIf _fltrBy = "M" Then
    Q = Q & " AND (MANUAL_DONO='" & _DONo & "' OR DOC_NO='" & _DONo & "')"
End If`, "vb", helpers);
  assert.ok(result);
  const sql = result.variants[0].sql;
  assert.ok(sql.includes("WITH(NOLOCK)"));
  assert.ok(!sql.includes("DB.NoLock"));
  assert.equal(result.variants.map(v => v.label).filter(l => l.includes("fltrBy")).length, 2);
});

test("sql: qualified parameterized helper (DB.CastVarChar(...)) resolves", () => {
  const helpers = `Public Shared Function CastVarChar(Column As String) As String
    Return If(clsDB.isSQLDB(), "CAST(" & Column & " AS VARCHAR) ", "TO_CHAR(" & Column & ")")
End Function`;
  const result = convertSqlConcat(`Q = Q & "SELECT " & DB.CastVarChar(TP_CODE) & " FROM T"`, "vb", helpers);
  assert.ok(result);
  const sql = result.variants[0].sql;
  assert.ok(sql.includes("CAST"));
  assert.ok(sql.includes("VARCHAR"));
  assert.ok(!sql.includes("DB.CastVarChar"));
});

test("sql-format: keyword case, indentation, and operator placement", () => {
  assert.equal(
    formatSql("select a, b from t where x = 1 and y = 2", "sql", sqlOpts),
    "SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  x = 1\n  AND y = 2"
  );
  assert.equal(
    formatSql("select a from t", "sql", { ...sqlOpts, keywordCase: "lower" }),
    "select\n  a\nfrom\n  t"
  );
  assert.equal(
    formatSql("SELECT * FROM t WHERE a = 1 AND b = 2", "sql", { ...sqlOpts, logicalOperatorNewline: "after" }),
    "SELECT\n  *\nFROM\n  t\nWHERE\n  a = 1 AND\n  b = 2"
  );
});

test("sql-format: dialects keep their syntax", () => {
  assert.equal(
    formatSql("SELECT [col], GETDATE() FROM [dbo].[tab] WHERE [id] = 1", "transactsql", sqlOpts),
    "SELECT\n  [col],\n  GETDATE()\nFROM\n  [dbo].[tab]\nWHERE\n  [id] = 1"
  );
  assert.equal(
    formatSql("SELECT v := x FROM dual", "plsql", sqlOpts),
    "SELECT\n  v := x\nFROM\n  dual"
  );
  assert.equal(
    formatSql("SELECT `name` FROM `users` WHERE id = 1", "mysql", sqlOpts),
    "SELECT\n  `name`\nFROM\n  `users`\nWHERE\n  id = 1"
  );
  assert.equal(
    formatSql("SELECT id::int FROM t WHERE name ILIKE '%a%'", "postgresql", sqlOpts),
    "SELECT\n  id::int\nFROM\n  t\nWHERE\n  name ILIKE '%a%'"
  );
});

test("sql-format: comments and strings are preserved", () => {
  assert.equal(
    formatSql("select a from t -- comment here", "sql", sqlOpts),
    "SELECT\n  a\nFROM\n  t -- comment here"
  );
});

test("sql-format: dialect auto-detection", () => {
  assert.equal(detectDialect("SELECT [id] FROM [dbo].[t] GO"), "transactsql");
  assert.equal(detectDialect("SELECT * FROM dual"), "plsql");
  assert.equal(detectDialect("SELECT `x` FROM `t`"), "mysql");
  assert.equal(detectDialect("SELECT $1::int FROM t"), "postgresql");
  assert.equal(detectDialect("SELECT a FROM b"), "sql");
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

test("sql-format: parameterized T-SQL is detected and formatted", () => {
  const input = "SELECT CANCEL_FLAG FROM TMS_DO_HDR WITH (NOLOCK) WHERE CANCEL_FLAG = @cancelType AND AMEND_NO = 251";
  assert.equal(detectDialect(input), "transactsql");
  assert.equal(
    formatSql(input, "auto", sqlOpts),
    "SELECT\n  CANCEL_FLAG\nFROM\n  TMS_DO_HDR\nWITH\n  (NOLOCK)\nWHERE\n  CANCEL_FLAG = @cancelType\n  AND AMEND_NO = 251"
  );
});

test("sql-format: wrong dialect falls back instead of crashing", () => {
  const input = "SELECT * FROM t WHERE x = @x";
  assert.equal(
    formatSql(input, "sql", sqlOpts),
    "SELECT\n  *\nFROM\n  t\nWHERE\n  x = @x"
  );
});

test("sql-to-code: VB output uses &=, quotes string params, and initialises the variable", () => {
  const result = sqlToCode("SELECT * FROM T WHERE X = @x", { language: "vb" });
  assert.ok(result);
  assert.equal(result.parameters.length, 1);
  assert.equal(result.parameters[0].name, "@x");
  assert.equal(result.parameters[0].expr, "_x");
  assert.equal(
    result.code,
    'q = ""\nq &= "SELECT * FROM T "\nq &= "WHERE X = \'" & _x & "\'"'
  );
});

test("sql-to-code: C# output uses += with no prefix and an initialiser", () => {
  const result = sqlToCode("SELECT * FROM T WHERE X = @x", { language: "cs" });
  assert.ok(result);
  assert.equal(result.parameters[0].expr, "x");
  assert.match(result.code, /^q = "";/);
  assert.match(result.code, /q \+= "SELECT \* FROM T "/);
  assert.match(result.code, /q \+= "WHERE X = '" \+ x \+ "'";/);
});

test("sql-to-code: round-trips through convertSqlConcat", () => {
  const input = "SELECT CANCEL_FLAG FROM TMS_DO_HDR WITH (NOLOCK)\nWHERE CANCEL_FLAG = @cancelType\nAND AMEND_NO = 251";
  const result = sqlToCode(input, { language: "vb" });
  assert.ok(result);
  const back = convertSqlConcat(result.code, "vb");
  assert.ok(back);
  assert.equal(back.variants[0].sql, "SELECT CANCEL_FLAG FROM TMS_DO_HDR WITH (NOLOCK) WHERE CANCEL_FLAG = @cancelType AND AMEND_NO = 251");
  assert.equal(back.parameters[0].name, "@cancelType");
  assert.equal(back.parameters[0].expr, "_cancelType");
});

test("sql-to-code: variable name is configurable", () => {
  const result = sqlToCode("SELECT * FROM T WHERE A = @a", { language: "cs", variable: "sSql" });
  assert.ok(result);
  assert.match(result.code, /^sSql = "";/);
  assert.match(result.code, /sSql \+= "SELECT \* FROM T "/);
  assert.match(result.code, /sSql \+= "WHERE A = '" \+ a \+ "'";/);
});

test("sql-to-code: quoteValues false emits bare fragments", () => {
  const result = sqlToCode("SELECT * FROM T WHERE N = @n", { language: "vb", quoteValues: false });
  assert.ok(result);
  assert.match(result.code, /q &= "SELECT \* FROM T "/);
  assert.match(result.code, /q &= "WHERE N = " & _n/);
});

test("sql-to-code: literals and comments are preserved, @ inside quotes ignored", () => {
  const result = sqlToCode("SELECT 'O''Brien' AS name -- keep @this\nFROM T WHERE X = @x", { language: "vb" });
  assert.ok(result);
  assert.equal(result.parameters.length, 1);
  assert.equal(result.parameters[0].name, "@x");
  assert.match(result.code, /O''Brien/);
  assert.match(result.code, /keep @this/);
});

test("sql-to-code: empty input returns null", () => {
  assert.equal(sqlToCode("   ", { language: "vb" }), null);
});

test("qr: wifi string builds the ZXing WIFI: spec", () => {
  assert.equal(
    generateWiFiString({ ssid: "MyNet", password: "p@ss", securityType: "WPA", isHidden: true }),
    "WIFI:T:WPA;S:MyNet;P:p@ss;H:true;;"
  );
  assert.equal(
    generateWiFiString({ ssid: "Cafe", password: "", securityType: "nopass", isHidden: false }),
    "WIFI:T:nopass;S:Cafe;;"
  );
  assert.equal(
    generateWiFiString({ ssid: "A;B\"C", password: "x", securityType: "WEP", isHidden: false }),
    "WIFI:T:WEP;S:A\\;B\\\"C;P:x;;"
  );
});

test("qr: wifi string requires ssid and password for secured networks", () => {
  assert.equal(generateWiFiString({ ssid: "", password: "x", securityType: "WPA", isHidden: false }), "");
  assert.equal(generateWiFiString({ ssid: "Net", password: "", securityType: "WPA", isHidden: false }), "");
});

test("qr: vcard builds a 3.0 block with filled fields only", () => {
  const vcard = generateVCardString({
    firstName: "John",
    lastName: "Doe",
    organization: "Acme",
    title: "",
    email: "john@example.com",
    phone: "",
    website: "https://example.com",
    address: "1 Main St",
  });
  assert.match(vcard, /^BEGIN:VCARD\nVERSION:3.0\n/);
  assert.match(vcard, /N:Doe;John;;;/);
  assert.match(vcard, /FN:John Doe/);
  assert.match(vcard, /ORG:Acme/);
  assert.match(vcard, /EMAIL:john@example.com/);
  assert.match(vcard, /URL:https:\/\/example.com/);
  assert.match(vcard, /ADR:;;1 Main St;;;;/);
  assert.doesNotMatch(vcard, /TITLE:/);
  assert.doesNotMatch(vcard, /TEL:/);
  assert.match(vcard, /END:VCARD$/);
});

test("barcode: mod-10 check digits for EAN-13 and UPC-A", () => {
  // "4006381333931" is a standard valid EAN-13; check digit is 1
  assert.equal(mod10CheckDigit("400638133393", 1, 3), 1);
  // "036000291452" is a standard valid UPC-A; check digit is 2
  assert.equal(mod10CheckDigit("03600029145", 3, 1), 2);
});

test("barcode: validation accepts valid codes and rejects bad check digits", () => {
  assert.equal(validateContent("", "ean13"), null);
  assert.equal(validateContent("400638133393", "ean13"), null); // data portion only
  assert.equal(validateContent("4006381333931", "ean13"), null); // correct check digit
  assert.match(validateContent("4006381333932", "ean13"), /Check digit should be 1/);
  assert.match(validateContent("40063", "ean13"), /exactly 12 or 13 digits/);
  assert.equal(validateContent("036000291452", "upca"), null);
  assert.match(validateContent("036000291459", "upca"), /Check digit should be 2/);
  assert.match(validateContent("1234", "upca"), /exactly 11 or 12 digits/);
});

test("barcode: content filtering and code 39 charset", () => {
  assert.equal(filterContent("abc-123", "code39"), "ABC-123"); // auto-uppercase
  assert.equal(filterContent("a!b@c", "code39"), "ABC"); // strips unsupported
  assert.match(validateContent("BAD~CHAR", "code39"), /Code 39 only supports/);
  assert.equal(validateContent("ABC-123", "code39"), null);
  assert.equal(filterContent("12a34b", "ean13"), "1234"); // digits only
});

test("barcode: bwip options per symbology", () => {
  const opts = { padding: 2, foregroundColor: "#000000", backgroundColor: "#ffffff", transparentBg: false, showText: true };
  const c128 = buildBwipOptions("code128", "ABC", 300, opts);
  assert.equal(c128.bcid, "code128");
  assert.equal(c128.includetext, true); // 1D shows text by default
  assert.equal(c128.backgroundcolor, "ffffff");
  const dm = buildBwipOptions("datamatrix", "X", 300, opts);
  assert.equal(dm.bcid, "datamatrix");
  assert.equal(dm.includetext, false); // 2D never shows text
  const transparent = buildBwipOptions("datamatrix", "X", 300, { ...opts, transparentBg: true });
  assert.equal("backgroundcolor" in transparent, false); // omitted = alpha-0 bg
  const noText = buildBwipOptions("code128", "ABC", 300, { ...opts, showText: false });
  assert.equal(noText.includetext, false);
});

test("barcode: friendly error strips bwip namespaces", () => {
  assert.equal(friendlyBwipError(new Error("bwipp.ean13#1234: bad data")), "bad data");
  assert.equal(friendlyBwipError(new Error("bwip-js: unknown bcid")), "unknown bcid");
  assert.equal(friendlyBwipError("nope"), "Failed to generate barcode");
});

// --- PDF tools ---

test("pdf: range segment parsing clamps and rejects", () => {
  assert.deepEqual(parseRangeSegment("3", 10), [3]);
  assert.deepEqual(parseRangeSegment("2-5", 10), [2, 3, 4, 5]);
  assert.deepEqual(parseRangeSegment("9-20", 10), [9, 10]); // clamped
  assert.equal(parseRangeSegment("0", 10), null); // pages are 1-based
  assert.equal(parseRangeSegment("5-2", 10), null); // reversed span
  assert.equal(parseRangeSegment("abc", 10), null);
  assert.equal(parseRangeSegment("", 10), null);
  assert.equal(parseRangeSegment("1-3", 0), null); // empty document
});

test("pdf: multi-range parsing sorts, dedupes and validates", () => {
  assert.deepEqual(parsePageRanges("5,1-3,3", 10), [1, 2, 3, 5]); // dedupe + sort
  assert.deepEqual(parsePageRanges(" 1 - 2 , 7 ", 10), [1, 2, 7]); // whitespace
  assert.equal(parsePageRanges("1,x", 10), null);
  assert.equal(parsePageRanges("", 10), null);
  assert.equal(parsePageRanges(",", 10), null);
});

test("pdf: chunking splits consecutive groups", () => {
  const all = (n) => Array.from({ length: n }, (_, i) => i + 1);
  assert.deepEqual(chunkPages(all(12), 4), [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]);
  assert.deepEqual(chunkPages(all(5), 2), [[1, 2], [3, 4], [5]]); // uneven tail
  assert.deepEqual(chunkPages([], 3), []);
  assert.deepEqual(chunkPages([1, 2], 0), [[1], [2]]); // degenerate size clamps to 1
});

test("pdf: page label templates", () => {
  assert.equal(formatPageLabel("{n} / {total}", 3, 10), "3 / 10");
  assert.equal(formatPageLabel("Page {n} of {total}", 2, 5), "Page 2 of 5");
  assert.equal(formatPageLabel("- {n} -", 7, 99), "- 7 -"); // no placeholders needed
});

test("pdf: output naming and byte formatting", () => {
  assert.equal(outputName("scan.pdf", "-compressed"), "scan-compressed.pdf");
  assert.equal(outputName("SCAN.PDF", "-merged"), "SCAN-merged.pdf");
  assert.equal(outputName("noext", "-x"), "noext-x.pdf");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.00 MB");
  assert.equal(formatBytes(-1), "—");
});

test("pdf: winansi sanitising keeps latin, replaces the rest", () => {
  assert.equal(sanitizeWinAnsi("CONFIDENTIAL"), "CONFIDENTIAL");
  // é and ï are latin-1; em dash has a WinAnsi slot — both kept
  assert.equal(sanitizeWinAnsi("café — naïve"), "café — naïve");
  // arrows have no WinAnsi representation
  assert.equal(sanitizeWinAnsi("a → b"), "a ? b");
  assert.equal(sanitizeWinAnsi("日本語"), "???");
});

test("csv: quoted fields, escaped quotes and embedded newlines", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,2,3"), [["a", "b", "c"], ["1", "2", "3"]]);
  assert.deepEqual(parseCsv('"has,comma","has ""quote""",x'), [
    ["has,comma", 'has "quote"', "x"],
  ]);
  assert.deepEqual(parseCsv('"multi\nline",b'), [["multi\nline", "b"]]);
  assert.deepEqual(parseCsv("a,,c"), [["a", "", "c"]]); // empty cell kept
  assert.deepEqual(parseCsv(""), []); // empty input
  assert.deepEqual(parseCsv("\r\n"), []); // blank line skipped
});

test("csv: ragged rows are preserved as-is", () => {
  assert.deepEqual(parseCsv("a,b\nc"), [["a", "b"], ["c"]]);
});

test("csv: column splitting on multi-space runs", () => {
  assert.deepEqual(splitColumns("Name   Qty    Price"), ["Name", "Qty", "Price"]);
  assert.deepEqual(splitColumns("single space stays"), ["single space stays"]);
  assert.deepEqual(splitColumns("  trimmed   cells  "), ["trimmed", "cells"]);
  assert.deepEqual(splitColumns(""), []);
});

test("pdfdoc: markdown maps headings, lists, tables and inline styles", () => {
  const blocks = mdToContent("# Title\n\nPara with **bold** and *italics*.\n\n- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |");
  assert.equal(blocks.length, 4); // heading + paragraph + list + table
  const [heading, para, list, table] = blocks;
  assert.equal(heading.fontSize, 22);
  assert.equal(list.ul.length, 2);
  assert.equal(table.table.headerRows, 1);
  // Inline styles: single plain run collapses to a string; styled runs stay an array
  assert.equal(typeof para.text === "string" || Array.isArray(para.text), true);
  const runs = mdToContent("**only bold**")[0];
  assert.equal(runs.text[0].bold, true);
});

test("pdfdoc: code fences and blockquotes become styled blocks", () => {
  const blocks = mdToContent("```\ncode line\n```\n\n> quoted");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].layout, "codeBlock");
  assert.equal(blocks[1].layout, "quote");
});

test("pdfdoc: empty markdown yields empty content", () => {
  assert.deepEqual(mdToContent(""), []);
});
