import { format } from "sql-formatter";

export type SqlDialect =
  | "auto"
  | "sql"
  | "transactsql"
  | "plsql"
  | "mysql"
  | "mariadb"
  | "postgresql"
  | "sqlite"
  | "bigquery"
  | "snowflake"
  | "db2"
  | "redshift"
  | "spark"
  | "trino";

export const DIALECTS: { value: Exclude<SqlDialect, "auto">; label: string }[] = [
  { value: "sql", label: "Generic SQL" },
  { value: "transactsql", label: "SQL Server (T-SQL)" },
  { value: "plsql", label: "Oracle (PL/SQL)" },
  { value: "mysql", label: "MySQL" },
  { value: "mariadb", label: "MariaDB" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "bigquery", label: "BigQuery" },
  { value: "snowflake", label: "Snowflake" },
  { value: "db2", label: "DB2" },
  { value: "redshift", label: "Redshift" },
  { value: "spark", label: "Spark SQL" },
  { value: "trino", label: "Trino" },
];

export type SqlFormatOptions = {
  keywordCase: "preserve" | "upper" | "lower";
  tabWidth: number;
  useTabs: boolean;
  logicalOperatorNewline: "before" | "after" | "none";
  linesBetweenQueries: number;
};

// ponytail: keyword sniffing is enough to pick a dialect; the generic
// formatter is a safe fallback when no signal matches.
export function detectDialect(input: string): Exclude<SqlDialect, "auto"> {
  const s = input.trim();
  if (/\bGO\b|\bGETDATE\s*\(|\[[\w\s]+\]|N'|^\s*USE\s+\w+/i.test(s)) return "transactsql";
  if (/\bSYSDATE\b|\bDUAL\b|\bNVL\s*\(|:=|TO_NUMBER\s*\(|\bNO_DATA_FOUND\b/i.test(s)) return "plsql";
  if (/`[^`]+`|\bAUTO_INCREMENT\b|\bON DUPLICATE KEY\b/i.test(s)) return "mysql";
  if (/\$\d+|\b::\w+\b|\bILIKE\b|\bRETURNING\b/i.test(s)) return "postgresql";
  return "sql";
}

export function formatSql(
  input: string,
  dialect: SqlDialect,
  options: SqlFormatOptions
): string {
  const language = dialect === "auto" ? detectDialect(input) : dialect;
  return format(input, {
    language,
    keywordCase: options.keywordCase,
    tabWidth: options.useTabs ? 1 : options.tabWidth,
    useTabs: options.useTabs,
    logicalOperatorNewline:
      options.logicalOperatorNewline === "none"
        ? undefined
        : options.logicalOperatorNewline,
    linesBetweenQueries: options.linesBetweenQueries,
  });
}