import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

test("every page header keeps its text clear of the fixed theme button from md up (right padding md:pr-20)", () => {
  for (const f of ["src/components/PageHeader.tsx", "src/components/run/RunHeader.tsx", "src/components/objective/ObjectiveDetailView.tsx"]) {
    assert.match(readFileSync(join(process.cwd(), f), "utf8"), /md:pr-20/, `${f} reserves the space under the theme button`);
  }
});
