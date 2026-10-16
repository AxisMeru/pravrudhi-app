import assert from "node:assert/strict";
import { test } from "node:test";

import { THEME_ICON_ARIA, THEME_ICON_TOOLTIP } from "../navCopy";
import { nextTheme } from "./theme";

test("the cycle is system -> light -> dark -> system", () => {
  assert.equal(nextTheme("system"), "light");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "system");
});

test("R1's strings are pinned byte for byte (app#378)", () => {
  assert.deepEqual({ ...THEME_ICON_ARIA }, {
    system: "Colour theme: follows your device setting. Press to use light.",
    light: "Colour theme: light. Press to use dark.",
    dark: "Colour theme: dark. Press to follow your device setting.",
  });
  assert.deepEqual({ ...THEME_ICON_TOOLTIP }, {
    system: "Colour theme: device setting",
    light: "Colour theme: light",
    dark: "Colour theme: dark",
  });
});
