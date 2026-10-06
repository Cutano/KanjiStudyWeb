import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { startOfflineHost } from "./offline-host";

test("onboarding satisfies automated WCAG checks", async ({ page }) => {
  const host = await startOfflineHost();
  try {
    await page.goto(host.url);
    await expect(
      page.getByRole("button", { name: /download & start learning/i }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, failureSummary }) => ({
          target,
          failureSummary,
        })),
      })),
    ).toEqual([]);
  } finally {
    await host.close();
  }
});

async function initialize(page: Page, url: string) {
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
  const headings: Record<string, string> = {
    home: "A little practice.",
    study: "Practice with intention",
    library: "Your Japanese library",
    "character/kanji:23398": "study, learning, science",
    "word/1206730": "学校",
    sets: "Make the journey yours",
    progress: "Look how far you’ve come",
    reading: "Let Japanese tell a story",
    settings: "Make yourself at home",
  };
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    headings[hash]!,
  );
  await expect(page.locator(".loading")).toHaveCount(0);
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme} main pages satisfy automated WCAG checks`, async ({
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
      const findings: {
        route: string;
        id: string;
        impact: string | null | undefined;
        nodes: {
          target: string[];
          summary: string | undefined;
          checks: unknown;
        }[];
      }[] = [];
      for (const route of [
        "home",
        "study",
        "library",
        "character/kanji:23398",
        "word/1206730",
        "sets",
        "progress",
        "reading",
        "settings",
      ]) {
        await navigate(page, route);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        findings.push(
          ...results.violations.map((violation) => ({
            route,
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => ({
              target: node.target.map(String),
              summary: node.failureSummary,
              checks: node.any,
            })),
          })),
        );
      }
      await navigate(page, "sets");
      await page
        .getByRole("button", { name: "New study set", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const dialogResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      findings.push(
        ...dialogResults.violations.map((violation) => ({
          route: "new-collection-dialog",
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => ({
            target: node.target.map(String),
            summary: node.failureSummary,
            checks: node.any,
          })),
        })),
      );
      await testInfo.attach(`accessibility-${theme}.json`, {
        body: JSON.stringify(findings, null, 2),
        contentType: "application/json",
      });
      const summary = findings
        .map(
          (finding) =>
            `${finding.route}: ${finding.id} (${finding.nodes.length} affected elements)\n${finding.nodes
              .slice(0, 3)
              .map((node) => `${node.target.join(" ")}: ${node.summary}`)
              .join("\n")}`,
        )
        .join("\n\n");
      expect(findings.length, summary).toBe(0);
    } finally {
      await host.close();
    }
  });
}

test("collection dialog supports keyboard entry, focus containment and focus return", async ({
  page,
}) => {
  const host = await startOfflineHost();
  try {
    await initialize(page, host.url);
    await navigate(page, "sets");
    const opener = page.getByRole("button", {
      name: "New study set",
      exact: true,
    });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    await dialog
      .getByLabel("New set name", { exact: true })
      .fill("Keyboard collection");
    await dialog.getByRole("button", { name: "Close dialog" }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", { name: "Create set", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Close dialog" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    await page.keyboard.press("Enter");
    await dialog
      .getByLabel("New set name", { exact: true })
      .fill("Keyboard collection");
    await dialog
      .getByRole("button", { name: "Create set", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Keyboard collection", exact: true }),
    ).toBeVisible();
  } finally {
    await host.close();
  }
});
