import { expect, test, type Page } from "@playwright/test";
import type { UserProfile } from "../../src/domain/types";
import { startOfflineHost } from "./offline-host";

async function persistedProfile(page: Page): Promise<UserProfile> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("kanji-study-web");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<UserProfile>((resolve, reject) => {
        const request = database
          .transaction("profile")
          .objectStore("profile")
          .get("current");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  });
}

test("a second shell release waits for study exit and preserves its checkpoint offline", async ({
  page,
}) => {
  let release = "A";
  const host = await startOfflineHost({
    transformResponse(pathname, body) {
      if (pathname === "/" || pathname === "/index.html") {
        return Buffer.from(
          body
            .toString()
            .replace(
              "</head>",
              `<meta name="test-release" content="${release}"></head>`,
            ),
        );
      }
      if (pathname === "/sw.js") {
        // Root release A uses the pre-Pages cache name to cover existing installs.
        if (release === "A" && !process.env.KANJI_TEST_BASE) {
          return Buffer.from(
            body
              .toString()
              .replace(
                "const SHELL_CACHE = SHELL_CACHE_PREFIX + SHELL_VERSION;",
                'const SHELL_CACHE = "kanji-shell-" + SHELL_VERSION;',
              ),
          );
        }
        if (release !== "B") return body;
        return Buffer.from(
          body
            .toString()
            .replace(
              /const SHELL_VERSION = "([^"]+)";/,
              'const SHELL_VERSION = "$1-release-b";',
            ),
        );
      }
      return body;
    },
  });
  try {
    await page.goto(host.url);
    await page
      .getByRole("button", { name: /download & start learning/i })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A little practice.",
      {
        timeout: 120_000,
      },
    );
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
      "content",
      "A",
    );

    await page.evaluate(() => {
      location.hash = "sets";
    });
    await page
      .getByRole("button", { name: "New study set", exact: true })
      .click();
    await page
      .getByLabel("New set name", { exact: true })
      .fill("Preserved through update");
    await page.getByRole("button", { name: "Create set", exact: true }).click();
    await page
      .locator(".set-card")
      .filter({ hasText: "Preserved through update" })
      .click();
    await page
      .getByLabel("Japanese text for set", { exact: true })
      .fill("学日本");
    await page
      .getByRole("button", { name: "Add characters", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Study this set", exact: true })
      .click();
    await page.getByLabel("Shuffle the order", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Start flashcards", exact: true })
      .click();
    await expect(page.locator(".flashcard-glyph")).toHaveText("学");
    await page
      .getByRole("button", { name: /reveal meaning & readings/i })
      .click();
    await page
      .getByRole("button", { name: "Good Remembered it", exact: true })
      .click();
    await expect(page.locator(".flashcard-glyph")).toHaveText("日");
    const before = await persistedProfile(page);
    expect(before.events).toHaveLength(1);
    expect(before.savedSession?.index).toBe(1);
    expect(before.sets[0].keys).toEqual([
      "kanji:23398",
      "kanji:26085",
      "kanji:26412",
    ]);

    // Serve a distinct, coherent second shell at the same origin. The catalog
    // version stays unchanged, as it does for a normal application-only release.
    release = "B";
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration!.update();
    });
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.waiting?.state;
        }),
      )
      .toBe("installed");
    await expect(
      page.getByRole("button", { name: "Update app", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".flashcard-glyph")).toHaveText("日");
    await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
      "content",
      "A",
    );

    await page
      .getByRole("button", { name: "Save & exit", exact: true })
      .click();
    const saved = await persistedProfile(page);
    expect(saved.events).toEqual(before.events);
    expect(saved.progress).toEqual(before.progress);
    expect(saved.savedSession?.index).toBe(1);
    await page.getByRole("button", { name: "Update app", exact: true }).click();
    await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
      "content",
      "B",
    );
    await expect.poll(() => persistedProfile(page)).toEqual(saved);
    await expect
      .poll(() =>
        page.evaluate(async () =>
          (await caches.keys()).filter((key) => key.startsWith("kanji-shell-")),
        ),
      )
      .toEqual([expect.stringMatching(/-release-b$/)]);

    await host.close();
    await expect
      .poll(async () => {
        try {
          await fetch(host.url);
          return true;
        } catch {
          return false;
        }
      })
      .toBe(false);
    await page.goto(`${host.url}/#home`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A little practice.",
      {
        timeout: 60_000,
      },
    );
    await expect(page.locator('meta[name="test-release"]')).toHaveAttribute(
      "content",
      "B",
    );
    await page
      .getByRole("button", { name: "Resume session", exact: true })
      .click();
    await expect(page.locator(".flashcard-glyph")).toHaveText("日");
    const restored = await persistedProfile(page);
    expect(restored.events).toEqual(saved.events);
    expect(restored.progress).toEqual(saved.progress);
    expect(restored.sets).toEqual(saved.sets);
    expect(restored.savedSession?.sessionId).toBe(
      saved.savedSession?.sessionId,
    );
    expect(restored.savedSession?.index).toBe(1);
  } finally {
    await host.close();
  }
});
