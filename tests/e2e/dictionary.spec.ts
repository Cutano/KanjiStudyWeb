import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { startOfflineHost } from "./offline-host";

async function initialize(page: Page, url: string) {
  await page.goto(url);
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
}

async function navigate(page: Page, destination: string) {
  await page.evaluate((hash) => {
    location.hash = hash;
  }, destination);
}

async function word(page: Page, id: number, title: string) {
  await navigate(page, `word/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
}

async function dotHeights(diagram: Locator) {
  return diagram
    .locator("circle")
    .evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute("cy"))),
    );
}

test("dictionary ranking, lexical senses, pitch and standalone sentences work offline", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  const host = await startOfflineHost();
  try {
    await initialize(page, host.url);
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
    const offline = await context.newPage();
    offline.on("pageerror", (error) => errors.push(error.message));
    await offline.goto(`${host.url}/#library?tab=words`);
    await expect(offline.getByRole("heading", { level: 1 })).toContainText(
      "Your Japanese library",
      { timeout: 60_000 },
    );

    for (const [query, id] of [
      ["今日", 1579110],
      ["漢字", 1213170],
      ["学校", 1206730],
    ] as const) {
      await offline.getByLabel("Search library", { exact: true }).fill(query);
      await expect(
        offline.locator("article.word-row .word-main > a").first(),
      ).toHaveAttribute("href", `#word/${id}`);
    }
    await offline.getByLabel("Search library", { exact: true }).fill("学");
    await expect(
      offline.locator("article.word-row .word-main > a").first(),
    ).toHaveAttribute("href", "#word/1955900");
    expect(
      await offline
        .locator("article.word-row .word-main > a")
        .evaluateAll((links) =>
          links.slice(0, 5).map((link) => link.getAttribute("href")),
        ),
    ).toEqual([
      "#word/1955900", // Exact form 学 precedes more elementary compounds.
      "#word/1206730", // N5 compounds follow available example count: 73,47,37,1.
      "#word/1206900",
      "#word/1413240",
      "#word/1552750",
    ]);
    await offline.getByLabel("Search library", { exact: true }).fill("school");
    await expect(
      offline.locator('.word-main > a[href="#word/1237150"]'),
    ).toBeVisible();
    await expect(
      offline.locator('.word-main > a[href="#word/1236950"]'),
    ).toBeVisible();
    const schoolResults = await offline
      .locator("article.word-row .word-main > a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    // N5 教室 precedes N4 教育 despite having fewer available examples.
    expect(schoolResults.indexOf("#word/1237150")).toBeLessThan(
      schoolResults.indexOf("#word/1236950"),
    );
    await offline.getByLabel("Search library", { exact: true }).fill("今日");
    const today = offline
      .locator("article.word-row")
      .filter({ has: offline.locator('a[href="#word/1579110"]') });
    await expect(today).toBeVisible();
    await expect(today.locator(".vocabulary-sense")).toHaveCount(2);
    const labels = today.locator(".sense-labels").first();
    const gloss = today.locator(".sense-gloss").first();
    await expect(labels).toContainText(/Noun/i);
    await expect(labels).toContainText(/Adverb/i);
    await expect(gloss).toContainText("today, this day");
    const labelBox = await labels.boundingBox();
    const glossBox = await gloss.boundingBox();
    expect(labelBox).not.toBeNull();
    expect(glossBox!.y).toBeGreaterThanOrEqual(
      labelBox!.y + labelBox!.height - 1,
    );
    expect(
      await labels.evaluate((node) => getComputedStyle(node).color),
    ).not.toBe(await gloss.evaluate((node) => getComputedStyle(node).color));
    await expect(today.locator(".vocabulary-sense").nth(1)).toContainText(
      "こんにち only",
    );
    await today.locator('.word-main > a[href="#word/1579110"]').click();
    await expect(offline.getByRole("heading", { level: 1 })).toHaveText("今日");
    await expect(offline.locator(".definition .vocabulary-sense")).toHaveCount(
      2,
    );
    const kyou = offline.getByRole("img", { name: /きょう.*1/ });
    await expect(kyou).toBeVisible();
    await expect(kyou.locator("circle")).toHaveCount(3); // きょ + う + following particle.
    const kyouPronunciation = offline
      .locator(".form-pronunciation")
      .filter({ has: offline.getByText("きょう", { exact: true }) });
    await expect(kyouPronunciation.locator(".form-flags")).toHaveText(
      "Special reading",
    );
    const konnichiPronunciation = offline
      .locator(".form-pronunciation")
      .filter({ has: offline.getByText("こんにち", { exact: true }) });
    await expect(konnichiPronunciation.locator(".form-flags")).toHaveCount(0);

    // Template notes can occur between two gloss slots belonging to one sense.
    // They must retain their reading order inside the same visible paragraph.
    await word(offline, 1014440, "アイビースタイル");
    await expect(offline.locator(".definition .vocabulary-sense")).toHaveCount(
      1,
    );
    await expect(
      offline.locator(".definition .sense-gloss-body"),
    ).toContainText("Ivy League (clothing) style");
    await word(offline, 1001490, "おまじない");
    await expect(offline.locator(".definition .vocabulary-sense")).toHaveCount(
      2,
    );
    await expect(
      offline.locator(".definition .sense-gloss-body").nth(1),
    ).toContainText(
      "code that is not (yet) necessary to understand, required boilerplate code",
    );
    await word(offline, 1171120, "右手");
    await expect(offline.locator(".definition .vocabulary-sense")).toHaveCount(
      2,
    );
    await expect(
      offline.locator(".definition .sense-gloss-body").nth(1),
    ).toContainText("right-hand side, right-hand direction, (on) the right");
    await word(offline, 1008070, "掴み取る");
    await expect(
      offline
        .locator(".form-flags")
        .filter({ hasText: "Outdated kanji spelling" }),
    ).toBeVisible();
    await word(offline, 1000320, "あそこ");
    await expect(
      offline
        .locator(".form-flags")
        .filter({ hasText: "Outdated kana spelling" })
        .first(),
    ).toBeVisible();

    await word(offline, 1206730, "学校");
    const school = offline.getByRole("img", { name: /がっこう.*0/ });
    await expect(school).toBeVisible();
    const schoolHeights = await dotHeights(school);
    expect(schoolHeights).toHaveLength(5); // Small っ and long vowel う are separate morae.
    expect(schoolHeights[0]).toBeGreaterThan(schoolHeights[1]);
    expect(
      schoolHeights.slice(1).every((height) => height === schoolHeights[1]),
    ).toBe(true);

    await word(offline, 1352130, "上");
    await expect(offline.locator(".definition .vocabulary-sense")).toHaveCount(
      12,
    );
    await expect(offline.locator(".definition")).toContainText(
      "emperor, sovereign, shogun, daimyo",
    );
    const unaccented = await dotHeights(
      offline.getByRole("img", { name: /うえ.*0/ }),
    );
    const finalAccent = await dotHeights(
      offline.getByRole("img", { name: /うえ.*2/ }),
    );
    expect(unaccented).toHaveLength(3);
    expect(finalAccent).toHaveLength(3);
    expect(unaccented[2]).toBe(unaccented[1]);
    expect(finalAccent[2]).toBeGreaterThan(finalAccent[1]);

    await word(offline, 1213170, "漢字");
    const kanjiPitch = offline.getByRole("img", { name: /かんじ.*0/ });
    await expect(kanjiPitch.locator("circle")).toHaveCount(4);
    const sentenceLink = offline
      .locator('a[href="#sentence/2381"]')
      .filter({ hasText: "Open sentence" });
    await sentenceLink.focus();
    await offline.keyboard.press("Enter");
    await expect(offline).toHaveURL(/#sentence\/2381$/);
    await expect(offline.getByRole("heading", { level: 1 })).toHaveText(
      "Example sentence.",
    );
    await expect(offline.locator(".sentence-detail-text")).toContainText(
      "今日",
    );
    await expect(
      offline.locator(".sentence-detail-text ruby").first(),
    ).toBeVisible();
    await expect(
      offline.locator(".sentence-detail-text .sentence-word"),
    ).toHaveCount(3);
    expect(
      await offline
        .locator(".sentence-detail-text .sentence-word")
        .evaluateAll((links) =>
          links.map((link) => {
            const copy = link.cloneNode(true) as HTMLElement;
            copy.querySelectorAll("rt").forEach((reading) => reading.remove());
            return copy.textContent;
          }),
        ),
    ).toEqual(["今日", "漢字", "書き取り"]);
    await offline
      .getByRole("button", { name: "Separate linked words", exact: true })
      .click();
    await expect(
      offline.locator(".sentence-detail-text .linked-sentence"),
    ).toHaveClass(/divided-words/);
    await offline
      .getByRole("button", { name: "Furigana", exact: true })
      .click();
    await expect(offline.locator(".sentence-detail-text ruby")).toHaveCount(0);
    await offline
      .getByRole("button", { name: "Furigana", exact: true })
      .click();
    await offline
      .getByRole("button", { name: "Mark as read", exact: true })
      .click();
    await expect(
      offline.getByText("We have a kanji dictation test today.", {
        exact: true,
      }),
    ).toBeVisible();
    const words = offline.locator("section").filter({
      has: offline.getByRole("heading", { name: /^Words in this sentence/ }),
    });
    await expect(words.locator("article.word-row")).toHaveCount(3);
    for (const id of [1579110, 1213170, 1343780])
      await expect(words.locator(`a[href="#word/${id}"]`)).toBeVisible();
    const characters = offline.locator("section").filter({
      has: offline.getByRole("heading", { name: /^Kanji in this sentence/ }),
    });
    await expect(characters.locator(".character-card")).toHaveCount(6);
    await offline
      .locator(".sentence-detail > .page-heading")
      .getByRole("button", { name: "Add favorite", exact: true })
      .click();
    await offline
      .locator(".note-panel textarea")
      .fill("A standalone sentence note, saved offline.");
    await offline
      .getByRole("button", { name: "Save note", exact: true })
      .click();
    await expect(
      offline.getByRole("button", { name: "Saved", exact: true }),
    ).toBeVisible();
    await offline.reload();
    await expect(offline.getByRole("heading", { level: 1 })).toHaveText(
      "Example sentence.",
    );
    await expect(
      offline
        .locator(".sentence-detail > .page-heading")
        .getByRole("button", { name: "Remove favorite", exact: true }),
    ).toBeVisible();
    await expect(
      offline.getByRole("button", { name: "Read", exact: true }),
    ).toBeVisible();
    await expect(offline.locator(".note-panel textarea")).toHaveValue(
      "A standalone sentence note, saved offline.",
    );
    expect(
      await offline.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await offline.screenshot({
      path: testInfo.outputPath("sentence-detail-offline.png"),
      fullPage: true,
    });
    await words.locator('a[href="#word/1579110"]').click();
    await expect(offline.getByRole("heading", { level: 1 })).toHaveText("今日");
    expect(errors).toEqual([]);
    await offline.close();
  } finally {
    await host.close();
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme} dictionary senses, pitch graphs and sentence detail pass accessibility checks`, async ({
    page,
  }, testInfo) => {
    const host = await startOfflineHost();
    try {
      await initialize(page, host.url);
      await navigate(page, "settings");
      await page
        .getByRole("combobox", { name: "Appearance", exact: true })
        .selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const [route, heading] of [
        ["word/1579110", "今日"],
        ["word/1352130", "上"],
        ["word/1008070", "掴み取る"],
        ["sentence/2381", "Example sentence."],
      ]) {
        await navigate(page, route);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          heading,
        );
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          // The requested maximum-scale=1 policy intentionally limits user zoom.
          .disableRules(["meta-viewport"])
          .analyze();
        await testInfo.attach(`axe-${theme}-${route.replace("/", "-")}.json`, {
          body: JSON.stringify(results.violations, null, 2),
          contentType: "application/json",
        });
        expect(
          results.violations.map(({ id, nodes }) => ({
            id,
            nodes: nodes.map(({ target, failureSummary }) => ({
              target,
              failureSummary,
            })),
          })),
          route,
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
      }
    } finally {
      await host.close();
    }
  });
}
