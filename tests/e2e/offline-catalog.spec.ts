import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { CatalogManifest } from "../../src/data/manifest";
import { startOfflineHost } from "./offline-host";
let offlineHost: Awaited<ReturnType<typeof startOfflineHost>> | undefined;
test.afterEach(async () => {
  await offlineHost?.close();
  offlineHost = undefined;
});

const manifest = JSON.parse(
  readFileSync("public/data/manifest.json", "utf8"),
) as CatalogManifest;
async function initialize(page: Page, url = "/") {
  await page.goto(url);
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
}
async function navigate(page: Page, hash: string) {
  await page.evaluate((destination) => {
    location.hash = destination;
  }, hash);
}
async function verifyAudioPlayback(page: Page) {
  // Observe real media decoding, including on a fresh page with no network connection.
  await page.evaluate(() => {
    const OriginalAudio = window.Audio;
    window.Audio = class extends OriginalAudio {
      constructor(source?: string) {
        super(source);
        this.addEventListener(
          "loadedmetadata",
          () =>
            (document.documentElement.dataset.audioDuration = String(
              this.duration,
            )),
        );
      }
    };
  });
  await page.getByRole("button", { name: "Play pronunciation" }).click();
  await expect
    .poll(() => page.locator("html").getAttribute("data-audio-duration"))
    .not.toBeNull();
  expect(
    Number(await page.locator("html").getAttribute("data-audio-duration")),
  ).toBeGreaterThan(0.5);
  await expect(page.getByRole("alert")).toHaveCount(0);
}

test("complete catalog, furigana, audio and favorites survive a cold offline reload", async ({
  page,
  context,
  browserName,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (browserName === "webkit") offlineHost = await startOfflineHost();
  await initialize(page, offlineHost?.url);
  await navigate(page, "library");
  await expect(page.locator(".results-toolbar")).toContainText("7,045");
  for (const [category, count] of [
    ["Hiragana", "74"],
    ["Katakana", "74"],
    ["Radicals", "265"],
    ["Dictionary", "214,894"],
  ]) {
    await page.getByRole("tab", { name: category, exact: true }).click();
    await expect(page.locator(".results-toolbar")).toContainText(count);
  }
  await page.getByLabel("Search library").fill("学校");
  await page.locator('a[href="#word/1206730"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("学校");
  await expect(page.locator(".definition")).toContainText("school");
  await verifyAudioPlayback(page);
  await navigate(page, "character/kanji:23398");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "study, learning, science",
  );
  await expect(
    page.getByRole("img", { name: "学 stroke order, 8 of 8 strokes" }),
  ).toBeVisible();
  await page
    .locator(".stroke-card")
    .getByRole("button", { name: "Add favorite", exact: true })
    .click();
  await page.getByRole("button", { name: /^Sentences/ }).click();
  await expect(page.locator(".examples-section ruby").first()).toBeVisible();
  await expect(
    page.locator(".examples-section .sentence-row").first(),
  ).not.toContainText("{");
  await page.screenshot({
    path: testInfo.outputPath("character-detail.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);

  await navigate(page, "settings");
  await page
    .getByRole("combobox", { name: /Daily review goal/ })
    .selectOption("50");
  await expect(
    page.getByRole("combobox", { name: /Daily review goal/ }),
  ).toHaveValue("50");
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backupPath = testInfo.outputPath("study-profile.json");
  await (await downloadEvent).saveAs(backupPath);
  const backup = JSON.parse(readFileSync(backupPath, "utf8"));
  expect(backup.profile.favorites).toContain("kanji:23398");
  expect(backup.profile.settings.dailyGoal).toBe(50);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Reset study profile", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("has been reset");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByLabel("Import backup file", { exact: true })
    .setInputFiles(backupPath);
  await expect(page.getByRole("status")).toContainText("has been restored");
  await expect(
    page.getByRole("combobox", { name: /Daily review goal/ }),
  ).toHaveValue("50");

  // A new page discards the worker and its in-memory database. All resources must reopen locally.
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
  const cold = await context.newPage();
  cold.on("pageerror", (error) => errors.push(error.message));
  await cold.goto(`${offlineHost?.url || ""}/#character/kanji:23398`);
  await expect(cold.getByRole("heading", { level: 1 })).toContainText(
    "study, learning, science",
    { timeout: 60_000 },
  );
  await expect(
    cold
      .locator(".stroke-card")
      .getByRole("button", { name: "Remove favorite", exact: true }),
  ).toBeVisible();
  await navigate(cold, "word/1206730");
  await expect(cold.getByRole("heading", { level: 1 })).toHaveText("学校");
  await verifyAudioPlayback(cold);
  await cold.close();
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test("a corrupt download never activates and retry reuses verified catalog bytes", async ({
  page,
}) => {
  const audio = manifest.assets.find((asset) => asset.kind === "audio")!;
  const corrupted = Buffer.from(readFileSync(`public${audio.path}`));
  corrupted[0] ^= 0xff;
  let corrupt = true;
  let catalogRequests = 0;
  offlineHost = await startOfflineHost({
    onRequest(pathname) {
      if (pathname === manifest.catalogPath) catalogRequests += 1;
    },
    transformResponse(pathname, body) {
      return pathname === audio.path && corrupt ? corrupted : body;
    },
  });
  await page.goto(offlineHost.url);
  await page
    .getByRole("button", { name: /download & start learning/i })
    .click();
  await expect(page.getByRole("alert")).toContainText("integrity check", {
    timeout: 120_000,
  });
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText(
    "A little practice.",
  );
  expect(catalogRequests).toBe(1);
  corrupt = false;
  await page
    .getByRole("button", { name: /download & start learning/i })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little practice.",
    { timeout: 120_000 },
  );
  expect(catalogRequests).toBe(1);
});

test("canceling an installation keeps verified files available for resume", async ({
  page,
}) => {
  const audio = manifest.assets.find((asset) => asset.kind === "audio")!;
  let release!: () => void;
  let started!: () => void;
  const pendingAudio = new Promise<void>((resolve) => {
    release = resolve;
  });
  const audioRequested = new Promise<void>((resolve) => {
    started = resolve;
  });
  let pause = true;
  let catalogRequests = 0;
  offlineHost = await startOfflineHost({
    onRequest(pathname) {
      if (pathname === manifest.catalogPath) catalogRequests += 1;
    },
    async transformResponse(pathname, body) {
      if (pathname === audio.path && pause) {
        started();
        await pendingAudio;
      }
      return body;
    },
  });
  await page.goto(offlineHost.url);
  await page
    .getByRole("button", { name: /download & start learning/i })
    .click();
  await audioRequested;
  await page.getByRole("button", { name: /cancel download/i }).click();
  await expect(
    page.getByRole("button", { name: /download & start learning/i }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText(
    "A little practice.",
  );
  pause = false;
  release();
  await page
    .getByRole("button", { name: /download & start learning/i })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little practice.",
    { timeout: 120_000 },
  );
  expect(catalogRequests).toBe(1);
});
