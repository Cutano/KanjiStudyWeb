import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { startOfflineHost } from "./offline-host";

async function navigate(page: Page, hash: string) {
  await page.evaluate((value) => {
    location.hash = value;
  }, hash);
}

test("collections split, merge, move and round-trip through files offline", async ({
  page,
}, testInfo) => {
  const host = await startOfflineHost({
    directory: process.env.KANJI_COLLECTIONS_DIST,
  });
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
      .poll(async () =>
        fetch(`${host.url}/network-probe`).then(
          () => false,
          () => true,
        ),
      )
      .toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A little practice.",
    );
    await navigate(page, "sets");
    await page
      .getByRole("button", { name: "New study set", exact: true })
      .click();
    await page
      .getByLabel("New set name", { exact: true })
      .fill("Source collection");
    await page.getByRole("button", { name: "Create set", exact: true }).click();
    await page
      .getByRole("link")
      .filter({
        has: page.getByRole("heading", {
          name: "Source collection",
          exact: true,
        }),
      })
      .click();
    await page.getByLabel("Japanese text for set").fill("日本語学一");
    await page
      .getByRole("button", { name: "Add characters", exact: true })
      .click();
    await expect(
      page.getByText("5 characters in your order", { exact: true }),
    ).toBeVisible();

    let download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV / Anki" }).click();
    const csvPath = testInfo.outputPath("Roundtrip.csv");
    await (await download).saveAs(csvPath);
    expect(readFileSync(csvPath, "utf8")).toContain("kanji:23398");
    download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export JSON", exact: true })
      .click();
    const jsonPath = testInfo.outputPath("collection.json");
    await (await download).saveAs(jsonPath);

    await page.getByRole("button", { name: "Split into batches" }).click();
    await page.getByLabel("Characters per batch").fill("2");
    await page.getByRole("button", { name: "Create batches" }).click();
    await expect(page.getByRole("status")).toContainText(
      "3 new batches created",
    );
    await expect(
      page.getByText("5 characters in your order", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Copy all to a set" }).click();
    await page.getByLabel("New set name", { exact: true }).fill("Destination");
    await page.getByRole("button", { name: "Create set", exact: true }).click();
    await page.getByRole("button", { name: "Arrange & remove" }).click();
    await page.getByLabel("Select 日", { exact: true }).check();
    await page.getByLabel("Select 学", { exact: true }).check();
    await page
      .getByRole("button", { name: "Copy selected", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Destination/ })
      .click();
    await page
      .getByRole("button", { name: "Move selected", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Destination/ })
      .click();
    await expect(
      page.getByText("3 characters in your order", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("3 characters in your order", { exact: true }),
    ).toBeVisible();

    await navigate(page, "sets");
    await expect(page.locator(".set-card")).toHaveCount(5);
    await page.getByLabel("Import collection file").setInputFiles(jsonPath);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Source collection",
    );
    await expect(
      page.getByText("5 characters in your order", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit set" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Name", { exact: true })
      .fill("JSON restored");
    await page.getByRole("button", { name: "Save collection" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "JSON restored",
    );

    await navigate(page, "sets");
    await page.getByLabel("Import collection file").setInputFiles(csvPath);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Roundtrip",
    );
    await expect(
      page.getByText("5 characters in your order", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Arrange & remove" }).click();
    await page.getByRole("button", { name: "Move 一 earlier" }).click();
    await page.getByLabel("Select 本", { exact: true }).check();
    await page
      .getByRole("button", { name: "Remove selected", exact: true })
      .click();
    await expect(
      page.getByText("4 characters in your order", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("collection-tools.png"),
      fullPage: true,
    });

    await navigate(page, "sets");
    await page.getByLabel("Import collection file").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"app":"wrong"}'),
    });
    await expect(page.getByRole("alert")).toContainText("version 1");
    await expect(page.locator(".set-card")).toHaveCount(7);
    await navigate(page, "settings");
    download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export backup", exact: true })
      .click();
    const profilePath = testInfo.outputPath("collections-profile.json");
    await (await download).saveAs(profilePath);
    const sets = JSON.parse(readFileSync(profilePath, "utf8")).profile.sets as {
      name: string;
      keys: string[];
    }[];
    expect(
      sets.find((set) => set.name === "Source collection")?.keys,
    ).toHaveLength(3);
    expect(sets.find((set) => set.name === "Destination")?.keys).toHaveLength(
      5,
    );
    expect(
      sets.find((set) => set.name === "Source collection · 3")?.keys,
    ).toHaveLength(1);
    expect(sets.find((set) => set.name === "Roundtrip")?.keys).toEqual([
      "kanji:26085",
      "kanji:35486",
      "kanji:19968",
      "kanji:23398",
    ]);
    expect(errors).toEqual([]);
  } finally {
    await host.close();
  }
});
