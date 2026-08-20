"use client";

import { useState } from "react";
import { FormatterPanel } from "@/components/tools/shared";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DIALECTS,
  formatSql,
  type SqlDialect,
  type SqlFormatOptions,
} from "@/lib/logic/sql-format";

const example = `select c.customer_id, c.customer_name, sum(o.order_total) as total
from customers c
inner join orders o on o.customer_id = c.customer_id
where o.order_date >= '2024-01-01' and c.status = 'active'
group by c.customer_id, c.customer_name
having sum(o.order_total) > 1000
order by total desc;`;

const DEFAULT_OPTIONS: SqlFormatOptions = {
  keywordCase: "upper",
  tabWidth: 2,
  useTabs: false,
  logicalOperatorNewline: "before",
  linesBetweenQueries: 1,
};

function OptionSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function SqlFormatter() {
  const [dialect, setDialect] = useState<SqlDialect>("auto");
  const [options, setOptions] = useState<SqlFormatOptions>(DEFAULT_OPTIONS);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OptionSelect
          label="Dialect"
          value={dialect}
          onChange={(v) => setDialect(v as SqlDialect)}
          items={[{ value: "auto", label: "Auto-detect" }, ...DIALECTS]}
        />
        <OptionSelect
          label="Keyword case"
          value={options.keywordCase}
          onChange={(v) =>
            setOptions((prev) => ({
              ...prev,
              keywordCase: v as SqlFormatOptions["keywordCase"],
            }))
          }
          items={[
            { value: "upper", label: "UPPERCASE" },
            { value: "lower", label: "lowercase" },
            { value: "preserve", label: "Preserve" },
          ]}
        />
        <OptionSelect
          label="Indent"
          value={options.useTabs ? "tab" : String(options.tabWidth)}
          onChange={(v) =>
            setOptions((prev) =>
              v === "tab"
                ? { ...prev, useTabs: true }
                : { ...prev, useTabs: false, tabWidth: Number(v) }
            )
          }
          items={[
            { value: "2", label: "2 spaces" },
            { value: "4", label: "4 spaces" },
            { value: "tab", label: "Tab" },
          ]}
        />
        <OptionSelect
          label="Operators"
          value={options.logicalOperatorNewline}
          onChange={(v) =>
            setOptions((prev) => ({
              ...prev,
              logicalOperatorNewline: v as SqlFormatOptions["logicalOperatorNewline"],
            }))
          }
          items={[
            { value: "before", label: "New line before" },
            { value: "after", label: "New line after" },
            { value: "none", label: "Same line" },
          ]}
        />
      </div>
      <FormatterPanel
        format={(s) => formatSql(s, dialect, options)}
        placeholder={"SELECT * FROM users WHERE id = 1;"}
        example={example}
        storageKey="avixia:sql-format:input"
      />
    </div>
  );
}