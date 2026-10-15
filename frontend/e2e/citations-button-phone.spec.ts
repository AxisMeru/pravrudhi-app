import { expect, test } from "./support/engineTest";

// Explorer gap review (P3): the "Check citations" button is a phone-size target (44 px) at 390 px, like the other buttons.
test.skip(process.env.CITATION_EXISTENCE_BUILD !== "1", "needs the citations-ON build");
test.use({ viewport: { width: 390, height: 844 } });

test("390 px: the Check citations button is at least 44 px high", async ({ page }) => {
  await page.goto("/citations");
  const b = await page.getByRole("button", { name: "Check citations" }).boundingBox();
  expect(b, "the button has a box").not.toBeNull();
  expect(b!.height, `button ${b!.height}px`).toBeGreaterThanOrEqual(44);
});
