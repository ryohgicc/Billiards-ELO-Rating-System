import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");

function cssBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  return match?.[1] ?? "";
}

describe("shell layout styles", () => {
  it("fills the available browser width instead of capping the whole app as a thumbnail", () => {
    expect(cssBlock(".shell")).toContain("width: calc(100% - 1.5rem)");
    expect(cssBlock(".shell")).not.toContain("min(1540px");
  });
});
