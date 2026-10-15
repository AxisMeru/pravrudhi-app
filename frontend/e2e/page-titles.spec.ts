import { expect, test } from "./support/engineTest";

// R1 (15 Oct, D4/D5): every page has its own <title>, "{page} · Pravrudhi-Nyaya", and the Screening file note names the Screening button.
const TITLES: Array<[string, string]> = [
  ["/signin", "Sign in"],
  ["/screening", "Matter workspace"],
  ["/demo", "How it works"],
  ["/workflows", "Workflows"],
  ["/data-handling", "Data handling"],
  ["/guide", "User guide"],
  ["/how-it-was-built", "How it was built"],
  ["/settings", "Settings"],
  ["/partner-keys", "API access"],
  ["/citations", "Case citations"],
];

for (const [path, name] of TITLES) {
  test(`${path} has its own title`, async ({ page }) => {
    await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
    await page.goto(path);
    await expect(page).toHaveTitle(`${name} · Pravrudhi-Nyaya`);
  });
}

// #267: "/" renders the home page and then EditionGate redirects it (router.replace to the Matter workspace), so polling the live page's title raced that redirect. The served HTML is what carries
// the home page's own title and it cannot race: read it as the browser first receives it.
test("the home page keeps the product name alone as its title", async ({ page }) => {
  const html = await (await page.request.get("/")).text();
  expect(html.match(/<title>([^<]*)<\/title>/)?.[1]).toBe("Pravrudhi-Nyaya");
});

test("the Screening file note says 'when you press Screen these facts', never Analyse", async ({ page }) => {
  await page.route("**/api/nyaya/registry/contracts", (r) => r.fulfill({ json: { contracts: [], entries: [] } }));
  await page.goto("/screening");
  await expect(page.getByText("is sent to the engine when you press Screen these facts")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("when you press Analyse");
});
