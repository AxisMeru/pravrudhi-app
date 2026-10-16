import { expect, test } from "./support/engineTest";
import { isLayoutB } from "./support/layout";

// D1 + D2 (explorer review of the live alias): on a phone the closed drawer must not leave controls in the tab order; the open drawer is a modal dialog that Escape closes, and the page behind is inert.
test.describe("phone drawer", () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test("closed: no off-screen control can take focus (Tab through the page)", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    const stops: Array<{ tag: string; x: number; w: number }> = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const b = el.getBoundingClientRect();
        return { tag: `${el.tagName} ${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}`, x: b.x, w: b.width };
      });
      if (r) stops.push(r);
    }
    expect(stops.length).toBeGreaterThan(5);
    for (const s of stops) expect(s.x + s.w, `${s.tag} is off-screen to the left but takes focus`).toBeGreaterThan(0);
    // and the drawer itself is not in the accessibility tree while closed
    await expect(page.locator("#primary-navigation")).toBeHidden();
  });

  test("open: a dialog; Escape closes it and returns focus to the button; the page behind is inert while open", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("#main")).toHaveAttribute("inert", "");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Navigation" })).toHaveCount(0);
    await expect(page.locator("#primary-navigation")).toBeHidden();
    await expect(page.locator("#main")).not.toHaveAttribute("inert", "");
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  });

  test("open at a phone width, then the window grows to desktop: the drawer closes, the page is not left inert, the sidebar has no dialog role (R2, #211)", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.locator("#main")).toHaveAttribute("inert", "");
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator("#main")).not.toHaveAttribute("inert", "");
    await expect(page.locator("#primary-navigation")).not.toHaveAttribute("role", "dialog");
    await expect(page.locator("#primary-navigation")).toBeVisible();
    await page.getByRole("heading", { level: 1 }).first().click(); // the page behind answers clicks again
  });

  test("with the drawer open the theme button is inert and never a Tab stop; it is focusable again after close (Track B, A1)", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    const theme = page.getByTestId("theme-button");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(theme).toHaveAttribute("inert", "");
    await expect(theme).toHaveAttribute("aria-hidden", "true");
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), `Tab stop ${i + 1}`).not.toBe("theme-button");
    }
    await page.keyboard.press("Escape");
    await expect(theme).not.toHaveAttribute("inert", "");
    await expect(theme).not.toHaveAttribute("aria-hidden", "true");
    await theme.focus();
    await expect(theme).toBeFocused();
  });

  test("opening moves focus into the dialog", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.locator("#primary-navigation")).toBeFocused();
  });
});

test("desktop: the sidebar is a normal column: visible, its links focusable, no dialog role", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.goto("/screening");
  await expect(page.locator("#primary-navigation")).toBeVisible();
  await expect(page.locator("#primary-navigation")).not.toHaveAttribute("role", "dialog");
  // layout B has no "Matter" item (R1's ruling for app#393): on /screening its first link is the page's own "Facts" anchor
  const first = (await isLayoutB(page)) ? page.locator("#primary-navigation a").first() : page.getByRole("link", { name: "Matter", exact: true }).first();
  if (await isLayoutB(page)) await expect(first).toHaveText("Facts");
  await first.focus();
  await expect(first).toBeFocused();
});

// Deploy 3 #203 (explorer review of the live alias: D3, D7, D8). At a phone width the close button must not cover the product name, every control a thumb has to hit is at least 44 px
// high (and wide, for the ones that are only a word), and the sidebar's section labels are not smaller than 12 px.
const SIZE_MIN = 44;
const OFFENCES = { contracts: ["ipc415_property", "ipc405_misappropriation"], entries: [{ id: "ipc415_property", validated: true }, { id: "ipc405_misappropriation", validated: true }] };

test.describe("phone touch targets and drawer header", () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test("D3: with the drawer open the close button does not cover the product name", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    await page.getByRole("button", { name: "Open navigation" }).click();
    // the drawer slides in (200 ms): measure once it has stopped at the left edge, not mid-slide
    await expect.poll(async () => (await page.getByRole("dialog", { name: "Navigation" }).boundingBox())?.x).toBe(0);
    const toggle = await page.getByRole("button", { name: "Close navigation" }).boundingBox();
    const brand = await page.getByTestId("drawer-brand").boundingBox();
    expect(toggle && brand).toBeTruthy();
    const overlap = !(toggle!.x + toggle!.width <= brand!.x || brand!.x + brand!.width <= toggle!.x || toggle!.y + toggle!.height <= brand!.y || brand!.y + brand!.height <= toggle!.y);
    expect(overlap, `the close button (${JSON.stringify(toggle)}) overlaps the product name (${JSON.stringify(brand)})`).toBe(false);
  });

  test("D7: the controls on Screening and the navigation toggle are at least 44 px high and wide", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: OFFENCES }));
    await page.goto("/screening");
    await expect(page.getByTestId("offence-list").locator("label").first()).toBeVisible();
    const targets: Array<[string, ReturnType<typeof page.locator>]> = [
      ["navigation toggle", page.getByRole("button", { name: "Open navigation" })],
      ["Add a fact", page.getByRole("button", { name: "Add a fact" })],
      ["About this screening", page.getByTestId("about-screening").locator("summary")],
      ["file picker", page.getByTestId("facts-file")],
      ["first Remove", page.getByRole("button", { name: /^Remove fact F1$/ })],
      ["first offence row", page.getByTestId("offence-list").locator("label").first()],
      ["last offence row", page.getByTestId("offence-list").locator("label").last()],
    ];
    for (const [name, loc] of targets) {
      const b = await loc.boundingBox();
      expect(b, `${name} has a box`).toBeTruthy();
      expect(b!.height, `${name} is ${Math.round(b!.height)} px high`).toBeGreaterThanOrEqual(SIZE_MIN);
      expect(b!.width, `${name} is ${Math.round(b!.width)} px wide`).toBeGreaterThanOrEqual(SIZE_MIN);
    }
  });

  test("D7 (R2, #217): the 'About this screening' fold keeps its disclosure marker at a phone width (summary stays display: list-item, 44 px from padding)", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: OFFENCES }));
    await page.goto("/screening");
    const summary = page.getByTestId("about-screening").locator("summary");
    await expect(summary).toBeVisible();
    const style = await summary.evaluate((el) => ({ display: getComputedStyle(el).display, listStyleType: getComputedStyle(el).listStyleType, h: el.getBoundingClientRect().height }));
    expect(style.display, "a summary that is not a list-item loses its disclosure triangle").toBe("list-item");
    expect(style.listStyleType).not.toBe("none");
    expect(style.h).toBeGreaterThanOrEqual(SIZE_MIN);
    // no other control this PR sized was turned into a flex summary / lost a marker: every <summary> on the page is a list-item
    // (layout B's Reference disclosure draws its own chevron, a flex summary, so it is the one exemption)
    const displays = await page.locator('summary:not([data-testid="mb-group-reference"] > summary)').evaluateAll((els) => els.map((e) => getComputedStyle(e).display));
    expect(displays.length).toBeGreaterThan(0);
    for (const d of displays) expect(d).toBe("list-item");
    // layout B's Reference disclosure replaces the marker with a chevron: it must be there, thumb-sized (opened in the drawer), and toggle the disclosure
    if (await isLayoutB(page)) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      const ref = page.getByTestId("mb-group-reference");
      const sum = ref.locator("summary");
      await expect(sum).toBeVisible();
      await expect(ref.getByTestId("mb-reference-chevron")).toBeVisible();
      expect((await sum.boundingBox())!.height, "the Reference summary is at least 44 px high").toBeGreaterThanOrEqual(SIZE_MIN);
      const isOpen = () => ref.evaluate((el) => (el as HTMLDetailsElement).open);
      const before = await isOpen();
      await sum.click();
      await expect.poll(isOpen).toBe(!before);
      await sum.click();
      await expect.poll(isOpen).toBe(before);
    }
  });

  test("D7: every link and button inside the open drawer is at least 44 px high", async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto("/screening");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();
    const items = await drawer.locator("a, button").evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { name: (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 30), h: b.height, w: b.width }; }));
    expect(items.length).toBeGreaterThan(5);
    for (const it of items) expect(it.h, `${it.name} is ${Math.round(it.h)} px high`).toBeGreaterThanOrEqual(SIZE_MIN);
  });
});

test("D8: the sidebar's section labels (WORK, REFERENCE, ACCOUNT) are at least 12 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.goto("/screening");
  const sizes = await page.locator("#primary-navigation").evaluate((nav) => {
    // live layout: the label div of each nav-group-*; layout B: the group heading <p>s and the Reference summary
    const labels = [...nav.querySelectorAll('[data-testid^="nav-group-"] > div:first-child, #mb-screening-heading, #mb-general-heading, [data-testid="mb-group-reference"] > summary')];
    return labels.map((l) => ({ text: (l.textContent ?? "").trim(), px: parseFloat(getComputedStyle(l).fontSize) }));
  });
  expect(sizes.length).toBeGreaterThanOrEqual(3);
  for (const s of sizes) expect(s.px, `${s.text} is ${s.px} px`).toBeGreaterThanOrEqual(12);
});
