import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");

function cssBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  return match?.[1] ?? "";
}

describe("reservation layout styles", () => {
  it("keeps daily history date buttons readable instead of shrinking every day into ellipses", () => {
    expect(cssBlock(".reservation-history .date-switcher__button")).toContain(
      "flex: 0 0 10.8rem",
    );
    expect(cssBlock(".reservation-history .date-switcher__button")).toContain(
      "min-width: 10.8rem",
    );
    expect(cssBlock(".reservation-history .date-switcher__button span,\n.reservation-history .date-switcher__button strong")).toContain(
      "text-overflow: clip",
    );
  });
});
