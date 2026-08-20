"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/copy-button";
import { sqlToCode, type SqlToCodeLanguage, type SqlToCodeResult } from "@/lib/logic/sql-to-code";

const example = `SELECT CANCEL_FLAG FROM TMS_DO_HDR WITH (NOLOCK)
WHERE CANCEL_FLAG = @cancelType
AND AMEND_NO = 251`;

const defaultPrefix = (language: SqlToCodeLanguage) => (language === "vb" ? "_" : "");

export default function SqlToCode() {
  const [input, setInput] = useState(example);
  const [language, setLanguage] = useState<SqlToCodeLanguage>("vb");
  const [variable, setVariable] = useState("q");
  const [prefix, setPrefix] = useState(defaultPrefix("vb"));
  const [quoteValues, setQuoteValues] = useState(true);
  const [result, setResult] = useState<SqlToCodeResult | null>(() =>
    sqlToCode(example, { language: "vb", variable: "q", prefix: defaultPrefix("vb"), quoteValues: true })
  );

  const convert = () => setResult(sqlToCode(input, { language, variable, prefix, quoteValues }));
  const code = result?.code ?? "";
  const parameters =
    result?.parameters.map((param) => `cmd.Parameters.AddWithValue("${param.name}", ${param.expr})`).join(result.language === "cs" ? ";\n" : "\n") ?? "";

  const changeLanguage = (value: SqlToCodeLanguage | null) => {
    if (!value) return;
    setLanguage(value);
    setPrefix(defaultPrefix(value));
  };

  const tryExample = () => {
    setInput(example);
    setLanguage("vb");
    setVariable("q");
    setPrefix(defaultPrefix("vb"));
    setQuoteValues(true);
    setResult(sqlToCode(example, { language: "vb", variable: "q", prefix: defaultPrefix("vb"), quoteValues: true }));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="grid gap-1.5">
          <Label htmlFor="sql-input">SQL query</Label>
          <Textarea
            id="sql-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Paste a SQL query with @named parameters..."
          />
        </div>
        <div className="grid content-start gap-3">
          <div className="grid gap-1.5">
            <Label>Language</Label>
            <Select value={language} onValueChange={changeLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vb">VB / VB.NET</SelectItem>
                <SelectItem value="cs">C#</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="variable">Variable name</Label>
            <Input id="variable" value={variable} onChange={(event) => setVariable(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="prefix">Parameter prefix</Label>
            <Input id="prefix" value={prefix} onChange={(event) => setPrefix(event.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="quote" checked={quoteValues} onCheckedChange={(checked) => setQuoteValues(checked === true)} />
            <Label htmlFor="quote" className="text-xs text-muted-foreground">Quote string values</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Every line uses {language === "cs" ? "`+=`" : "`&=`"}. In C#, the variable must be initialised before the first line.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={convert}>Convert</Button>
        <Button variant="ghost" onClick={tryExample}>Try example</Button>
        <Button variant="ghost" onClick={() => { setInput(""); setResult(null); }}>Clear</Button>
      </div>
      {!result && input.trim() && <p className="text-sm text-destructive">Enter a SQL query to generate code.</p>}
      {result && (
        <div className="grid gap-5">
          <Output label="Generated code" value={code} />
          <Output label={`Parameters (${result.parameters.length})`} value={parameters} />
        </div>
      )}
    </div>
  );
}

function Output({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1.5"><div className="flex items-center justify-between"><Label>{label}</Label>{value && <CopyButton value={value} />}</div><Textarea readOnly value={value} className="min-h-[130px] font-mono text-sm" /></div>;
}
