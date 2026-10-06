import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { startOfflineHost } from "./offline-host";
let offlineHost: Awaited<ReturnType<typeof startOfflineHost>> | undefined;
test.afterEach(async () => {
  await offlineHost?.close();
  offlineHost = undefined;
});

async function navigate(page: Page, destination: string) {
  await page.evaluate((hash) => {
    location.hash = hash;
  }, destination);
}
async function setup(page: Page, character: number, mode: string) {
  await navigate(page, `character/kanji:${character}`);
  await page
    .getByRole("button", { name: "Practice this character", exact: true })
    .click();
  await page
    .locator(".study-mode-grid")
    .getByRole("button", { name: new RegExp(`^${mode}`) })
    .click();
  await page
    .getByLabel("Repeat missed characters once", { exact: true })
    .uncheck();
}
async function complete(page: Page) {
  await expect(
    page.getByRole("heading", { name: "A little more familiar." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to my learning" }).click();
}

test("flashcards resume and all study modes work with real data while offline", async ({
  page,
  context,
  browserName,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (browserName === "webkit") offlineHost = await startOfflineHost();
  await page.goto(offlineHost?.url || "/");
  await page
    .getByRole("button", { name: /download & start learning/i })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little practice.",
    { timeout: 120_000 },
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (offlineHost) {
    await offlineHost.close();
    await expect
      .poll(async () => {
        try {
          await fetch(offlineHost!.url);
          return true;
        } catch {
          return false;
        }
      })
      .toBe(false);
  } else await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little practice.",
    { timeout: 60_000 },
  );

  await setup(page, 23398, "Flashcards");
  await page
    .getByRole("button", { name: "Start flashcards", exact: true })
    .click();
  await expect(page.locator(".flashcard-glyph")).toHaveText("学");
  await page
    .getByRole("button", { name: /reveal meaning & readings/i })
    .click();
  await expect(page.locator(".flashcard-answer h2")).toContainText("study");
  await page.screenshot({
    path: testInfo.outputPath("flashcard.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Save & exit", exact: true }).click();
  await navigate(page, "home");
  await page.reload();
  await page
    .getByRole("button", { name: "Resume session", exact: true })
    .click();
  await expect(page.locator(".flashcard-glyph")).toHaveText("学");
  await page
    .getByRole("button", { name: /reveal meaning & readings/i })
    .click();
  await page
    .getByRole("button", { name: "Good Remembered it", exact: true })
    .click();
  await complete(page);

  await setup(page, 23398, "Quick quiz");
  await page
    .getByLabel("Question type", { exact: true })
    .selectOption("sentence");
  await page.getByText("More practice options", { exact: true }).click();
  await page
    .getByLabel("Base time per question", { exact: true })
    .selectOption("30");
  await page
    .getByLabel("Hide choices until I am ready", { exact: true })
    .check();
  await page
    .getByLabel("Continue automatically after feedback", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Start quick quiz", exact: true })
    .click();
  await expect(page.locator(".quiz-choices")).toHaveCount(0);
  await page.getByRole("button", { name: /Show answer choices/ }).click();
  await expect(page.locator(".quiz-prompt h2")).toContainText("□");
  await page
    .locator(".quiz-choices button")
    .filter({ has: page.getByText("学", { exact: true }) })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "That’s right." }),
  ).toBeVisible();
  await complete(page);

  await setup(page, 19968, "Writing");
  await page
    .getByLabel("Writing style", { exact: true })
    .selectOption("manual");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  const canvas = page.locator(".writing-canvas");
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const getPoints = () =>
    canvas.evaluate((element) => {
      const path = element.querySelector("path.stroke-guide") as SVGPathElement;
      const rect = element.getBoundingClientRect();
      return Array.from({ length: 30 }, (_, index) => {
        const point = path.getPointAtLength(
          (path.getTotalLength() * index) / 29,
        );
        return {
          x: rect.left + (point.x * rect.width) / 109,
          y: rect.top + (point.y * rect.height) / 109,
        };
      });
    });
  let points = await getPoints();
  // An inverse stroke must fail before the valid path is accepted.
  await page.mouse.move(points.at(-1)!.x, points.at(-1)!.y);
  await page.mouse.down();
  for (const point of [...points].reverse())
    await page.mouse.move(point.x, point.y);
  await page.mouse.up();
  await page.getByRole("button", { name: "Check stroke", exact: true }).click();
  await expect(page.locator(".writing-feedback")).toContainText(
    "Start near the beginning",
  );
  await canvas.scrollIntoViewIfNeeded();
  points = await getPoints();
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const point of points) await page.mouse.move(point.x, point.y);
  await page.mouse.up();
  await page.getByRole("button", { name: "Check stroke", exact: true }).click();
  await expect(page.locator(".writing-feedback")).toContainText(
    "Character complete",
  );
  await page.screenshot({
    path: testInfo.outputPath("writing.png"),
    fullPage: true,
  });
  await page
    .locator(".writing-practice")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await complete(page);

  await setup(page, 23398, "Reading");
  await page
    .getByRole("button", { name: "Start reading", exact: true })
    .click();
  await expect(page.locator(".reading-sentence")).toContainText("学");
  await expect(page.locator(".reading-sentence ruby").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Reveal translation", exact: true })
    .click();
  await expect(page.locator(".reading-translation")).not.toBeEmpty();
  await page.getByRole("button", { name: "Understood", exact: true }).click();
  await complete(page);

  await navigate(page, "settings");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backupPath = testInfo.outputPath("study-backup.json");
  await (await download).saveAs(backupPath);
  const profile = JSON.parse(readFileSync(backupPath, "utf8")).profile;
  expect(profile.events).toHaveLength(4);
  expect(
    new Set(profile.events.map((event: { id: string }) => event.id)).size,
  ).toBe(4);
  expect(profile.events.map((event: { mode: string }) => event.mode)).toEqual([
    "flashcards",
    "quiz",
    "writing",
    "reading",
  ]);
  expect(profile.progress["kanji:19968"].writingAttempts).toBe(1);
  expect(profile.progress["kanji:19968"].writingCorrect).toBe(0);
  expect(profile.readingProgress).toHaveLength(1);
  expect(profile.savedSession).toBeNull();
  expect(errors).toEqual([]);
});
