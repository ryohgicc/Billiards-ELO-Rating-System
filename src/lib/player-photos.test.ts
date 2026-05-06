import { describe, expect, it } from "vitest";

import { getPlayerPhotoCanvasOutputType } from "@/lib/player-photos";

describe("getPlayerPhotoCanvasOutputType", () => {
  it("normalizes png uploads to jpeg output so stored data urls stay renderable", () => {
    expect(getPlayerPhotoCanvasOutputType("image/png")).toBe("image/jpeg");
  });
});
