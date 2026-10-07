import { expect, test } from "@playwright/test";
import { startOfflineHost } from "./offline-host";

test("deployment scope contains every resource and supports cold offline dictionary and audio", async ({
  page,
  context,
}, testInfo) => {
  const requests: string[] = [];
  const errors: string[] = [];
  const host = await startOfflineHost({
    onRequest: (path) => requests.push(path),
  });
  const url = `${host.url}/`;
  const base = new URL(url).pathname;
  const otherCache = "kanji-shell-%2Fanother-project%2F-sentinel";
  const legacyCache = "kanji-shell-0123456789abcdef";
  try {
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.evaluate(
      async ({ otherCache, legacyCache }) => {
        await (
          await caches.open(otherCache)
        ).put(
          "/another-project/index.html",
          new Response("Keep other project"),
        );
        await (
          await caches.open(legacyCache)
        ).put("/index.html", new Response("Legacy root"));
      },
      { otherCache, legacyCache },
    );
    await page
      .getByRole("button", { name: /download & start learning/i })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A little practice.",
      { timeout: 120_000 },
    );
    await expect
      .poll(() =>
        page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
      )
      .toBe(`${url}sw.js`);
    expect(
      await page.evaluate(
        async () => (await navigator.serviceWorker.ready).scope,
      ),
    ).toBe(url);
    const cachesAfterInstall = await page.evaluate(() => caches.keys());
    expect(cachesAfterInstall).toContain(otherCache);
    expect(cachesAfterInstall.includes(legacyCache)).toBe(base !== "/");

    const manifestURL = await page
      .locator('link[rel="manifest"]')
      .evaluate((link: HTMLLinkElement) => link.href);
    expect(manifestURL).toBe(`${url}manifest.webmanifest`);
    const manifest = await (await page.request.get(manifestURL)).json();
    for (const path of [manifest.id, manifest.start_url, manifest.scope]) {
      expect(new URL(path, manifestURL).href).toBe(url);
    }
    for (const icon of manifest.icons) {
      const iconURL = new URL(icon.src, manifestURL);
      expect(iconURL.pathname.startsWith(base)).toBe(true);
      expect((await page.request.get(iconURL.href)).ok()).toBe(true);
    }
    for (const shortcut of manifest.shortcuts) {
      expect(
        new URL(shortcut.url, manifestURL).href.startsWith(`${url}#`),
      ).toBe(true);
    }
    for (const path of [
      "missing.js",
      "assets/missing.wasm",
      "data/missing.bin",
    ]) {
      expect((await page.request.get(`${url}${path}`)).status()).toBe(404);
    }
    await page.evaluate(() => {
      location.hash = "settings";
    });
    const licenses = page.locator('a[href*="/licenses/"]');
    await expect(licenses).toHaveCount(3);
    for (const link of await licenses.all()) {
      const href = await link.getAttribute("href");
      expect(href!.startsWith(`${base}licenses/`)).toBe(true);
      expect((await page.request.get(new URL(href!, url).href)).ok()).toBe(
        true,
      );
    }
    await page.evaluate(() => {
      location.hash = "character/kanji:23398";
    });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "study, learning, science",
    );
    await page
      .locator(".stroke-card")
      .getByRole("button", { name: "Add favorite", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("deployment-character.png"),
      fullPage: true,
    });
    expect(requests.every((path) => path.startsWith(base))).toBe(true);
    expect(requests.some((path) => path.endsWith(".wasm"))).toBe(true);
    expect(requests).toContain(`${base}data/manifest.json`);
    await host.close();
    const cold = await context.newPage();
    cold.on("pageerror", (error) => errors.push(error.message));
    await page.close();
    await cold.goto(`${url}#character/kanji:23398`);
    await expect(cold.getByRole("heading", { level: 1 })).toContainText(
      "study, learning, science",
      { timeout: 60_000 },
    );
    await expect(
      cold
        .locator(".stroke-card")
        .getByRole("button", { name: "Remove favorite", exact: true }),
    ).toBeVisible();
    await cold.evaluate(() => {
      const OriginalAudio = window.Audio;
      window.Audio = class extends OriginalAudio {
        constructor(source?: string) {
          super(source);
          this.addEventListener("loadedmetadata", () => {
            document.documentElement.dataset.audioDuration = String(
              this.duration,
            );
          });
        }
      };
      location.hash = "word/1206730";
    });
    await expect(cold.getByRole("heading", { level: 1 })).toHaveText("学校");
    await cold.getByRole("button", { name: "Play pronunciation" }).click();
    await expect
      .poll(async () =>
        Number(await cold.locator("html").getAttribute("data-audio-duration")),
      )
      .toBeGreaterThan(0.5);
    await expect(cold.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
    await cold.close();
  } finally {
    await host.close();
  }
});
