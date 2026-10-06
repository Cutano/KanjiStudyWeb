import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ExtensionPack } from "../../src/domain/types";
import { startOfflineHost } from "./offline-host";

const pack: ExtensionPack = {
  schemaVersion: 1,
  id: "personal-reading-fixture",
  name: "Personal reading notes",
  author: "Test learner",
  license: "Original test content",
  readings: [
    {
      id: "morning-study",
      code: 23398,
      text: "日本語を学ぶ。",
      translation: "Study Japanese.",
    },
  ],
  entries: [
    {
      code: 23398,
      explanation: "My own reminder: learn a little every morning.",
      etymology: "This is an original mnemonic, not a historical etymology.",
    },
  ],
};
async function navigate(page: Page, hash: string) {
  await page.evaluate((value) => {
    location.hash = value;
  }, hash);
}

test("user extension readings and explanations import offline and survive backup restoration", async ({
  page,
}, testInfo) => {
  const host = await startOfflineHost();
  try {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(host.url);
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
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);
    await host.close();
    await expect
      .poll(async () => {
        try {
          await fetch(host.url);
          return false;
        } catch {
          return true;
        }
      })
      .toBe(true);
    await page.reload();
    await navigate(page, "settings");
    await page.getByLabel("Import extension file").setInputFiles({
      name: "personal-extension.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(pack)),
    });
    await expect(page.getByRole("status")).toContainText(
      "Your extension is ready",
    );
    await expect(page.locator(".extension-item")).toContainText(
      `${pack.author} · ${pack.license}`,
    );

    const extensionDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: `Export ${pack.name}`, exact: true })
      .click();
    const extensionPath = testInfo.outputPath("extension-export.json");
    await (await extensionDownload).saveAs(extensionPath);
    expect(JSON.parse(readFileSync(extensionPath, "utf8"))).toEqual(pack);

    // A malformed replacement must leave the existing pack intact.
    await page.getByLabel("Import extension file").setInputFiles({
      name: "invalid-extension.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          ...pack,
          readings: [pack.readings[0], pack.readings[0]],
        }),
      ),
    });
    await expect(page.getByRole("alert")).toContainText(/duplicate/i);
    await expect(page.locator(".extension-item")).toHaveCount(1);
    await navigate(page, "character/kanji:23398");
    await expect(
      page.getByText(pack.entries[0].explanation, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(pack.entries[0].etymology!, { exact: true }),
    ).toBeVisible();
    await navigate(page, "reading");
    await page
      .getByRole("button", { name: "Imported reading sets", exact: true })
      .click();
    await expect(page.locator(".reading-card")).toHaveCount(1);
    await expect(page.locator(".japanese-text")).toHaveText(
      pack.readings[0].text,
    );
    await page
      .getByRole("button", { name: "Reveal meaning", exact: true })
      .click();
    await expect(page.locator(".sentence-translation")).toHaveText(
      pack.readings[0].translation,
    );
    await page
      .getByRole("button", { name: "Mark as read", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Read", exact: true }),
    ).toBeVisible();

    await navigate(page, "settings");
    const backupDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export backup", exact: true })
      .click();
    const backupPath = testInfo.outputPath("extension-profile.json");
    await (await backupDownload).saveAs(backupPath);
    const backup = JSON.parse(readFileSync(backupPath, "utf8"));
    expect(backup.profile.extensions).toEqual([pack]);
    expect(backup.profile.readingProgress).toContain(
      `${pack.id}:${pack.readings[0].id}`,
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Reset study profile", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("has been reset");
    await expect(page.locator(".extension-item")).toHaveCount(0);
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByLabel("Import backup file", { exact: true })
      .setInputFiles(backupPath);
    await expect(page.getByRole("status")).toContainText("has been restored");
    await expect(page.locator(".extension-item")).toHaveCount(1);
    await page.reload();
    await navigate(page, "reading");
    await page
      .getByRole("button", { name: "Imported reading sets", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Read", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".japanese-text")).toHaveText(
      pack.readings[0].text,
    );
    await navigate(page, "character/kanji:23398");
    await expect(
      page.getByText(pack.entries[0].explanation, { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await host.close();
  }
});
