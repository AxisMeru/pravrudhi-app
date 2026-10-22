import { expect, test } from "./support/engineTest";

// The Links block under the NyayaSiddhi film (R1 bbe0e492331d): after the film, the heading, the note, six plain external links.
test("Benchmarks: the Links block sits under the film, with the note and six external links that open safely", async ({ page }) => {
  await page.goto("/benchmarks");
  const film = page.getByTestId("block-film");
  const links = page.getByTestId("block-ns-links");
  await expect(links).toBeVisible();
  const [fy, ly] = await Promise.all([film.boundingBox(), links.boundingBox()]);
  expect(ly!.y).toBeGreaterThan(fy!.y + fy!.height - 1);
  await expect(links.getByRole("heading", { name: "Links" })).toBeVisible();
  await expect(links).toContainText("These links open pages on Hugging Face, outside this app.");
  const a = links.getByRole("link");
  await expect(a).toHaveCount(6);
  const labels = await a.allInnerTexts();
  expect(labels).toEqual(["NyayaSiddhi dataset on Hugging Face", "All files", "Scorer: scorer/s6_scorer.py", "Participant README", "Submission path", "Results folder"]);
  for (let i = 0; i < 6; i++) {
    await expect(a.nth(i)).toHaveAttribute("target", "_blank");
    await expect(a.nth(i)).toHaveAttribute("rel", "noopener noreferrer");
    expect(await a.nth(i).getAttribute("href")).toMatch(/^https:\/\/huggingface\.co\/datasets\/AxisMeru\/nyayasiddhi/);
  }
});
