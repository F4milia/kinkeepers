/**
 * Minimal RFC 4180 CSV serialization - no library needed for this
 * project's export sizes (A5's partner attendance export). Quotes a
 * field only when it contains a comma, quote, or newline; doubles any
 * embedded quote. CRLF row endings per the RFC, which Excel expects.
 */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (value: string | number | null): string => {
    const str = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers, ...rows].map((row) => row.map(escape).join(","));
  return lines.join("\r\n");
}
