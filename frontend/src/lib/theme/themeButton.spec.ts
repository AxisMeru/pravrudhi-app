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

test("the theme button is in the sidebar brand row and the phone top strip, not floating over the page: no page header reserves space for it (no md:pr-20)", () => {
  for (const f of ["src/components/PageHeader.tsx", "src/components/run/RunHeader.tsx", "src/components/objective/ObjectiveDetailView.tsx"]) {
    assert.doesNotMatch(readFileSync(join(process.cwd(), f), "utf8"), /md:pr-20/, `${f} no longer reserves space under a floating theme button`);
  }
  const box = readFileSync(join(process.cwd(), "src/components/ThemeSwitch.tsx"), "utf8");
  assert.doesNotMatch(box, /right-6|border border-\[var\(--color-control-border\)\]/, "borderless, not at the old floating spot");
  assert.match(box, /h-11 w-11/, "44 px hit area");
  assert.doesNotMatch(box, /md:z-|left-\[/, "no z hack and no guessed left offset: the row icon is in the brand row's flow");
  assert.match(readFileSync(join(process.cwd(), "src/components/Sidebar.tsx"), "utf8"), /<ThemeSwitch where="row" \/>/);
  assert.match(readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8"), /<ThemeSwitch where="strip" \/>/);
  assert.doesNotMatch(box, /md:h-\d|md:w-\d/, "the hit area is 44 px at desktop width too");
});
