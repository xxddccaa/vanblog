import { describe, expect, it } from "vitest";
import {
  DEFAULT_FRONT_CARD_BACKGROUND_DARK,
  resolveFrontCardSurfaceColors,
} from "../utils/frontCardSurface";

describe("front card surface colors", () => {
  it("keeps the dark page background in the same graphite family as the card surface", () => {
    const surfaces = resolveFrontCardSurfaceColors();

    expect(surfaces.dark).toBe(DEFAULT_FRONT_CARD_BACKGROUND_DARK);
    expect(surfaces.darkPage).toBe("#101214");
  });

  it("derives a non-black page background from a custom dark card color", () => {
    const surfaces = resolveFrontCardSurfaceColors({
      frontCardBackgroundColorDark: "#15314d",
    });

    expect(surfaces.dark).toBe("#15314d");
    expect(surfaces.darkPage).toBe("#13273c");
  });
});
