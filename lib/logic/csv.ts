// Pure CSV helpers — no DOM or dependency code, so they run in node --test.

/**
 * Parse RFC-4180-ish CSV: quoted fields with escaped "" quotes, commas and
 * newlines inside quotes. Returns rows of cells; empty trailing lines skipped.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      // Treat \r\n as one line break
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c !== "") || rows.length > 0) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  // Final cell/row without trailing newline
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);

  return rows;
}

/**
 * Split a text line into columns on runs of two or more spaces (used to
 * turn extracted PDF text into spreadsheet columns). Single spaces stay
 * inside a cell.
 */
export function splitColumns(line: string): string[] {
  return line
    .split(/\s{2,}/)
    .map((cell) => cell.trim())
    .filter((cell) => cell !== "");
}
