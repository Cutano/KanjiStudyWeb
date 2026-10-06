import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const svg = await readFile(path.join(root, "public/icon.svg"), "utf8");
const output = path.join(root, "public/icons");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<html><head><style>html,body{margin:0;width:100%;height:100%;background:#244c40}svg{display:block;width:100%;height:100%}</style></head><body>${svg}</body></html>`,
    );
    await page.screenshot({
      path: path.join(output, `icon-${size}.png`),
      animations: "disabled",
    });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log("Rendered local vector artwork to 192px and 512px PWA icons.");
