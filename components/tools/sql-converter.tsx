"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/copy-button";
import { convertSqlConcat, type SqlConvertResult, type SqlLanguage } from "@/lib/logic/sql";

const example = `Q = Q & " SELECT CANCEL_FLAG FROM TMS_DO_HDR " & DB.NoLock & " "
Q = Q & " WHERE "
Q = Q & " CANCEL_FLAG = '" & _cancelType & "' "
Q = Q & " AND AMEND_NO = 251"
If _fltrBy = "B" Then
    Q = Q & " AND BARCODE='" & _DONo & "'"
ElseIf _fltrBy = "M" Then
    Q = Q & " AND (MANUAL_DONO='" & _DONo & "' OR DOC_NO='" & _DONo & "')"
End If`;

const helpersExample = `Public Shared ReadOnly Property NoLock As String = "WITH (NOLOCK)"`;

export default function SqlConverter() {
  const [input, setInput] = useState(example);
  const [helpers, setHelpers] = useState(helpersExample);
  const [language, setLanguage] = useState<SqlLanguage>("auto");
  const [result, setResult] = useState<SqlConvertResult | null>(() => convertSqlConcat(example, "auto", helpersExample));

  const convert = () => setResult(convertSqlConcat(input, language, helpers));
  const code = result?.code ?? "";
  const parameters = result?.parameters.map((param) => `cmd.Parameters.AddWithValue("${param.name}", ${param.expr})`).join(result.language === "cs" ? ";\n" : "\n") ?? "";
  const sql = result?.variants.map((variant) => `-- ${variant.label}\n${variant.sql}`).join("\n\n") ?? "";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="grid gap-1.5">
          <Label htmlFor="sql-input">Legacy C# / VB code</Label>
          <Textarea id="sql-input" value={input} onChange={(event) => setInput(event.target.value)} className="min-h-[300px] font-mono text-sm" placeholder="Paste code that builds a SQL query..." />
        </div>
        <div className="grid content-start gap-1.5">
          <Label>Language</Label>
          <Select value={language} onValueChange={(value) => value && setLanguage(value as SqlLanguage)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="vb">VB / VB.NET</SelectItem>
              <SelectItem value="cs">C#</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">Quoted values become named parameters. Numeric literals and helper expressions stay intact.</p>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sql-helpers">Helper definitions (optional)</Label>
        <Textarea id="sql-helpers" value={helpers} onChange={(event) => setHelpers(event.target.value)} className="min-h-[100px] font-mono text-sm" placeholder={'Paste definitions such as: Public Shared ReadOnly Property NoLock As String = "WITH (NOLOCK)"'} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={convert}>Convert</Button>
        <Button variant="ghost" onClick={() => { setInput(example); setHelpers(helpersExample); setResult(convertSqlConcat(example, "auto", helpersExample)); }}>Try example</Button>
        <Button variant="ghost" onClick={() => { setInput(""); setHelpers(""); setResult(null); }}>Clear</Button>
      </div>
      {!result && input.trim() && <p className="text-sm text-destructive">No supported SQL concatenation assignment was found.</p>}
      {result && (
        <div className="grid gap-5">
          <Output label="Converted code" value={code} />
          <Output label={`Parameters (${result.parameters.length})`} value={parameters} />
          <Output label="Rendered SQL with parameters" value={sql} />
        </div>
      )}
    </div>
  );
}

function Output({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1.5"><div className="flex items-center justify-between"><Label>{label}</Label>{value && <CopyButton value={value} />}</div><Textarea readOnly value={value} className="min-h-[130px] font-mono text-sm" /></div>;
}
