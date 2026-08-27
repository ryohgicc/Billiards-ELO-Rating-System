import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const headers = readFileSync(path.resolve(__dirname, "../../public/_headers"), "utf8");

function headersFor(route: string) {
  const lines = headers.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === route);

  if (start === -1) {
    return [];
  }

  const result: string[] = [];

  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !line.startsWith(" ")) {
      break;
    }

    if (line.trim()) {
      result.push(line.trim());
    }
  }

  return result;
}

describe("static deploy headers", () => {
  it("validates Next static assets so hydrated UI cannot reuse stale chunks", () => {
    expect(headersFor("/_next/static/*")).toContain("Cache-Control: no-cache");
    expect(headersFor("/_next/*")).toContain("Cache-Control: no-cache");
  });

  it("validates HTML entry points without clearing the full browser cache", () => {
    expect(headersFor("/")).toContain("Cache-Control: no-cache");
    expect(headersFor("/*.html")).toContain("Cache-Control: no-cache");
    expect(headers).not.toContain("Clear-Site-Data");
  });
});
