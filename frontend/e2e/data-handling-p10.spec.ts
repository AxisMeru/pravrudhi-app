import { expect, test } from "./support/engineTest";

// P10 (R1, 14 Oct): "At a glance" at the top; with the assistant on, the two routes as labelled groups BELOW the standard sections (so "described above" is true). Three flag states:
// assistant off (the default build), on, on with the delete sentence (the build with NEXT_PUBLIC_ASSISTANT_DELETE_CONFIRMED=1).
const ON = process.env.NEXT_PUBLIC_ASSISTANT_ENTRY === "1";
const DELETE = process.env.NEXT_PUBLIC_ASSISTANT_DELETE_CONFIRMED === "1";

test("the glance: heading, R1's line, three blocks quoting the first signed paragraph, each with a link that reaches its section", async ({ page }) => {
  await page.goto("/data-handling");
  const glance = page.getByTestId("dh-glance");
  await expect(glance.getByRole("heading", { name: "At a glance", level: 2 })).toBeVisible();
  await expect(page.getByTestId("dh-glance-line")).toHaveText("A short version of the sections below; the sections hold the full text.");
  await expect(glance.getByRole("link", { name: /^See the full section/ })).toHaveCount(3);
  await expect(page.getByTestId("dh-glance-sent")).toContainText("When you press Screen these facts, the facts you enter and the offences you select are sent to the Pravrudhi engine.");
  await expect(page.getByTestId("dh-glance-where")).toContainText("The screening runs on the Pravrudhi engine, hosted on RunPod");
  // R1: the fallback-region sentence is in the glance too, as its own paragraph (a skimmer sees every location fact)
  await expect(page.getByTestId("dh-glance-where").locator("p")).toHaveCount(2);
  await expect(page.getByTestId("dh-glance-where")).toContainText("If our EU processing is unavailable, part of the screening may instead run in a North American data centre for that request, and your facts are sent there.");
  await expect(page.getByTestId("dh-glance-kept")).toContainText("Run records are kept for up to 7 days.");
  // R1 (15 Oct, #300): the glance carries the sentence about what a run record can include, and never the fallback's tail that points "above" at another section
  await expect(page.getByTestId("dh-glance-kept")).toContainText("A run record can include the text of facts the screening marked as supported, so do not enter real names or case details unless your firm's setup allows it.");
  await expect(page.getByTestId("dh-glance-where")).toContainText("Parts of the screening run in EU data centres; for some parts the region is not fixed.");
  await expect(page.getByTestId("dh-glance")).not.toContainText("described above");
  for (const id of ["sent", "where", "kept"]) {
    await expect(page.getByTestId(`dh-glance-link-${id}`)).toHaveAttribute("href", `#dh-${id}`);
    await page.getByTestId(`dh-glance-link-${id}`).click();
    await expect(page).toHaveURL(new RegExp(`#dh-${id}$`));
    await expect(page.getByTestId(`dh-${id}`)).toBeInViewport();
  }
  // the glance carries no mention of Anthropic in any build; the one assistant line exists only in the assistant build (below)
  await expect(glance).not.toContainText(/Anthropic/);
  if (!ON) await expect(glance).not.toContainText(/assistant/i);
});

test("assistant off: no groups, no assistant section, no assistant line in the glance, nothing about Anthropic on the page", async ({ page }) => {
  test.skip(ON, "the flag-OFF build");
  await page.goto("/data-handling");
  await expect(page.getByTestId("dh-glance-assistant")).toHaveCount(0);
  await expect(page.getByTestId("dh-assistant")).toHaveCount(0);
  await expect(page.getByTestId("dh-route-a")).toHaveCount(0);
  await expect(page.getByTestId("dh-route-b")).toHaveCount(0);
  await expect(page.getByTestId("data-handling")).not.toContainText(/Anthropic|Without the assistant|With the assistant/);
});

test("assistant on: two labelled groups below the standard sections, with the signed lines; the delete sentence only with its own flag", async ({ page }) => {
  test.skip(!ON, "needs the build with NEXT_PUBLIC_ASSISTANT_ENTRY=1");
  await page.goto("/data-handling");
  const a = page.getByTestId("dh-route-a");
  const b = page.getByTestId("dh-route-b");
  // R1: ONE line in the glance, after the three blocks, linking to route B
  await expect(page.getByTestId("dh-glance-assistant")).toHaveText("The optional assistant changes this: see \u201cWith the assistant (only when you tick the consent box)\u201d below.");
  await expect(page.getByTestId("dh-glance-assistant-link")).toHaveAttribute("href", "#dh-assistant");
  await page.getByTestId("dh-glance-assistant-link").click();
  await expect(page).toHaveURL(/#dh-assistant$/);
  await expect(a.getByRole("heading", { name: "Without the assistant", level: 3 })).toBeVisible();
  await expect(a).toContainText("Without the assistant, your facts are processed as described above and are not sent to Anthropic.");
  await expect(b.getByRole("heading", { name: "With the assistant (only when you tick the consent box)", level: 3 })).toBeVisible();
  await expect(b).toContainText("The consent box is off for every run until you tick it.");
  await expect(b).toContainText("The assistant is offered only to signed-in users.");
  await expect(b.getByRole("link")).toHaveCount(2);
  if (DELETE) await expect(b).toContainText("it is deleted within 2 hours at the latest");
  else await expect(page.getByTestId("data-handling")).not.toContainText("we delete the assistant's session");
  // "described above" is true: every standard section is above the group (page order)
  const ys = async (id: string) => (await page.getByTestId(id).boundingBox())!.y;
  const groupY = await ys("dh-route-a");
  for (const id of ["dh-sent", "dh-citations", "dh-kept", "dh-where", "dh-browser", "dh-documents"]) expect(await ys(id), id).toBeLessThan(groupY);
  // the existing in-app link to the section still lands on it
  await expect(page.getByTestId("dh-assistant").getByRole("heading", { name: "Screening with the assistant (optional)" })).toBeVisible();
});
