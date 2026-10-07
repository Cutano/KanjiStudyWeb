import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { startOfflineHost } from "./offline-host";

const fakeKey = "test-only-key-never-valid-for-a-provider";

/** A generated tone exercises browser audio decoding without any external fixture. */
function waveFixture() {
  const sampleRate = 8_000;
  const samples = sampleRate;
  const wave = Buffer.alloc(44 + samples * 2);
  wave.write("RIFF", 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(sampleRate, 24);
  wave.writeUInt32LE(sampleRate * 2, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(samples * 2, 40);
  for (let sample = 0; sample < samples; sample++) {
    wave.writeInt16LE(
      Math.round(Math.sin((sample * Math.PI * 2 * 440) / sampleRate) * 1_000),
      44 + sample * 2,
    );
  }
  return wave;
}

async function startSpeechProvider() {
  const requests: {
    authorization: string | undefined;
    path: string | undefined;
    body: Record<string, unknown>;
  }[] = [];
  let status = 200;
  const audio = waveFixture();
  const server = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push({
      authorization: request.headers.authorization,
      path: request.url,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    });
    if (status !== 200) {
      response.writeHead(status, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          error: { message: "Test provider rejected this request." },
        }),
      );
      return;
    }
    response
      .writeHead(200, {
        "Content-Type": "audio/wav",
        "Content-Length": audio.length,
      })
      .end(audio);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test provider port.");
  let closed = false;
  return {
    endpoint: `http://127.0.0.1:${address.port}/v1/audio/speech`,
    requests,
    failWith(nextStatus: number) {
      status = nextStatus;
    },
    async close() {
      if (closed) return;
      closed = true;
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

async function startProductionPolicyHost() {
  const csp = /add_header Content-Security-Policy "([^"]+)"/.exec(
    readFileSync("nginx.conf", "utf8"),
  )?.[1];
  if (!csp)
    throw new Error("The production Content Security Policy was not found.");
  return startOfflineHost({
    responseHeaders: { "Content-Security-Policy": csp },
  });
}

async function observePlayback(page: Page) {
  await page.addInitScript(() => {
    const OriginalAudio = window.Audio;
    window.Audio = class extends OriginalAudio {
      constructor(source?: string) {
        super(source);
        this.addEventListener("playing", () => {
          document.documentElement.dataset.playedAudio = String(
            Number(document.documentElement.dataset.playedAudio || "0") + 1,
          );
          document.documentElement.dataset.audioDuration = String(
            this.duration,
          );
        });
      }
    };
    // The provider fallback is tested independently of installed host OS voices.
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [
          { lang: "ja-JP", name: "Test local voice", localService: true },
        ],
        cancel: () => {},
        speak: (utterance: SpeechSynthesisUtterance) => {
          document.documentElement.dataset.spokenText = utterance.text;
          document.documentElement.dataset.browserSpeechCount = String(
            Number(document.documentElement.dataset.browserSpeechCount || "0") +
              1,
          );
        },
      },
    });
  });
}

async function initialize(page: Page, url: string) {
  await observePlayback(page);
  await page.goto(url);
  await page
    .getByRole("button", { name: /download & start learning/i })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little practice.",
    { timeout: 120_000 },
  );
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
}

async function navigate(page: Page, hash: string) {
  await page.evaluate((destination) => {
    location.hash = destination;
  }, hash);
  const heading = hash.startsWith("sentence/")
    ? "Example sentence."
    : hash === "word/1206730"
      ? "学校"
      : hash === "word/1001490"
        ? "おまじない"
        : "Make yourself at home.";
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  await expect(page.locator(".loading")).toHaveCount(0);
}

async function configure(page: Page, endpoint: string) {
  await navigate(page, "settings");
  await page.getByLabel("Speech API endpoint", { exact: true }).fill(endpoint);
  await page.getByLabel("API key", { exact: true }).fill(fakeKey);
  await page.getByLabel("Model", { exact: true }).fill("gpt-4o-mini-tts");
  await page.getByLabel("Voice", { exact: true }).fill("coral");
  await page
    .getByRole("button", { name: "Save AI speech settings", exact: true })
    .click();
  await expect(
    page.getByText("AI speech settings saved.", { exact: true }),
  ).toBeVisible();
}

async function playMedia(page: Page, button: Locator) {
  const previous = Number(
    await page.locator("html").getAttribute("data-played-audio"),
  );
  await button.click();
  await expect
    .poll(async () =>
      Number(await page.locator("html").getAttribute("data-played-audio")),
    )
    .toBeGreaterThan(previous);
  expect(
    Number(await page.locator("html").getAttribute("data-audio-duration")),
  ).toBeGreaterThan(0.5);
  await expect(page.getByRole("alert")).toHaveCount(0);
}

function sentenceAudio(page: Page) {
  return page
    .locator(".sentence-detail > .page-heading")
    .getByRole("button", { name: "Read aloud", exact: true });
}

test("native, configured AI and browser speech follow priority and cached AI survives cold offline reload", async ({
  page,
  context,
}, testInfo) => {
  const host = await startProductionPolicyHost();
  const provider = await startSpeechProvider();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await initialize(page, host.url);
    await navigate(page, "sentence/31");
    await sentenceAudio(page).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-spoken-text",
      "きっと万事うまくいく。",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-browser-speech-count",
      "1",
    );

    await configure(page, provider.endpoint);
    await navigate(page, "word/1206730");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("学校");
    await playMedia(
      page,
      page
        .getByRole("button", { name: "Play pronunciation", exact: true })
        .first(),
    );
    expect(provider.requests).toHaveLength(0);

    // This real catalog entry has no bundled recording.
    await navigate(page, "word/1001490");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "おまじない",
    );
    await playMedia(
      page,
      page
        .getByRole("button", { name: "Play pronunciation", exact: true })
        .first(),
    );
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]).toMatchObject({
      authorization: `Bearer ${fakeKey}`,
      path: "/v1/audio/speech",
      body: {
        input: "おまじない",
        model: "gpt-4o-mini-tts",
        voice: "coral",
        response_format: "mp3",
      },
    });
    await playMedia(
      page,
      page
        .getByRole("button", { name: "Play pronunciation", exact: true })
        .first(),
    );
    expect(provider.requests).toHaveLength(1);

    await navigate(page, "sentence/2381");
    await playMedia(page, sentenceAudio(page));
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1].body.input).toBe(
      "今日は漢字の書き取りがある。",
    );
    await playMedia(page, sentenceAudio(page));
    expect(provider.requests).toHaveLength(2);
    await expect(page.locator("html")).toHaveAttribute(
      "data-browser-speech-count",
      "1",
    );

    await navigate(page, "settings");
    await expect(page.getByText(/2 \/ 10 clips/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("API key", { exact: true })).toHaveValue(
      fakeKey,
    );
    await expect(
      page.getByLabel("Speech API endpoint", { exact: true }),
    ).toHaveValue(provider.endpoint);
    const downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export backup", exact: true })
      .click();
    const backupPath = testInfo.outputPath(
      "profile-without-ai-credentials.json",
    );
    await (await downloadEvent).saveAs(backupPath);
    const backup = readFileSync(backupPath, "utf8");
    expect(backup).not.toContain(fakeKey);
    expect(backup).not.toContain(provider.endpoint);

    await provider.close();
    await host.close();
    const cold = await context.newPage();
    await observePlayback(cold);
    cold.on("pageerror", (error) => errors.push(error.message));
    await cold.goto(`${host.url}/#sentence/2381`);
    await expect(cold.getByRole("heading", { level: 1 })).toHaveText(
      "Example sentence.",
      { timeout: 60_000 },
    );
    await playMedia(cold, sentenceAudio(cold));
    expect(provider.requests).toHaveLength(2);
    await navigate(cold, "word/1001490");
    await playMedia(
      cold,
      cold
        .getByRole("button", { name: "Play pronunciation", exact: true })
        .first(),
    );
    await expect(cold.locator("html")).not.toHaveAttribute(
      "data-browser-speech-count",
    );
    expect(provider.requests).toHaveLength(2);
    await cold.screenshot({
      path: testInfo.outputPath("cached-ai-pronunciation-offline.png"),
      fullPage: true,
    });
    await cold.close();
    expect(errors).toEqual([]);
  } finally {
    await provider.close();
    await host.close();
  }
});

test("AI errors are explicit, cache controls work and speech settings remain accessible", async ({
  page,
}, testInfo) => {
  const host = await startProductionPolicyHost();
  const provider = await startSpeechProvider();
  try {
    await initialize(page, host.url);
    await configure(page, provider.endpoint);
    await expect(page.getByLabel("API key", { exact: true })).toHaveAttribute(
      "type",
      "password",
    );
    provider.failWith(401);
    await navigate(page, "sentence/31");
    await sentenceAudio(page).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(provider.requests).toHaveLength(1);
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-browser-speech-count",
    );
    await expect(page.getByRole("alert")).not.toContainText(fakeKey);
    await navigate(page, "settings");
    await expect(page.getByText(/0 \/ 10 clips/)).toBeVisible();
    expect(provider.requests).toHaveLength(1); // No background retry after leaving the failed request.

    provider.failWith(200);
    await navigate(page, "sentence/31");
    await playMedia(page, sentenceAudio(page));
    expect(provider.requests).toHaveLength(2);
    await navigate(page, "settings");
    await expect(page.getByText(/1 \/ 10 clips/)).toBeVisible();
    await page
      .getByRole("button", { name: "Clear generated audio", exact: true })
      .click();
    await expect(
      page.getByText("Generated audio cleared.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/0 \/ 10 clips/)).toBeVisible();
    await navigate(page, "sentence/31");
    await playMedia(page, sentenceAudio(page));
    expect(provider.requests).toHaveLength(3);
    await navigate(page, "settings");

    for (const theme of ["light", "dark"]) {
      await page
        .getByRole("combobox", { name: "Appearance", exact: true })
        .selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      await testInfo.attach(`speech-settings-axe-${theme}.json`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });
      expect(
        results.violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map(({ target }) => target),
        })),
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
    await page
      .getByRole("heading", { name: "AI speech", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("ai-speech-settings.png"),
    });
    await page
      .getByRole("button", { name: "Clear API key", exact: true })
      .click();
    await expect(
      page.getByText("API key removed. AI speech is disabled.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("API key", { exact: true })).toHaveValue("");
    await navigate(page, "sentence/31");
    await sentenceAudio(page).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-spoken-text",
      "きっと万事うまくいく。",
    );
    expect(provider.requests).toHaveLength(3);
  } finally {
    await provider.close();
    await host.close();
  }
});
