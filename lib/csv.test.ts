import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("joins headers and rows with commas and CRLF line endings", () => {
    expect(toCsv(["A", "B"], [["1", "2"]])).toBe("A,B\r\n1,2");
  });

  it("renders null as an empty field", () => {
    expect(toCsv(["A"], [[null]])).toBe("A\r\n");
  });

  it("quotes and escapes a field containing a comma, quote, or newline", () => {
    expect(toCsv(["A"], [["a,b"]])).toBe('A\r\n"a,b"');
    expect(toCsv(["A"], [['say "hi"']])).toBe('A\r\n"say ""hi"""');
    expect(toCsv(["A"], [["line1\nline2"]])).toBe('A\r\n"line1\nline2"');
  });

  it("passes numbers through as plain text", () => {
    expect(toCsv(["A"], [[3]])).toBe("A\r\n3");
  });
});
