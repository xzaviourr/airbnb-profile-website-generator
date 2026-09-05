import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { PageSnapshot } from "./parser.js";

export interface BrowserCaptureOptions {
  headless: boolean;
  timeoutMs: number;
  delayMs: number;
}

export class BrowserCapture {
  private browser: Browser | undefined;
  private context: BrowserContext | undefined;

  constructor(private readonly options: BrowserCaptureOptions) {}

  async start(): Promise<void> {
    this.browser = await chromium.launch({ headless: this.options.headless });
    this.context = await this.browser.newContext({
      locale: "en-US",
      viewport: { width: 1440, height: 1000 },
    });
  }

  async capture(url: string): Promise<PageSnapshot> {
    if (!this.context) throw new Error("BrowserCapture.start() must be called before capture()");
    const page = await this.context.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.options.timeoutMs });
      await this.waitForContent(page);
      await this.autoScroll(page);
      return { url: page.url(), html: await page.content() };
    } finally {
      await page.close();
      if (this.options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.options.delayMs));
      }
    }
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.context = undefined;
    this.browser = undefined;
  }

  private async waitForContent(page: Page): Promise<void> {
    await page.locator("main").first().waitFor({
      state: "attached",
      timeout: this.options.timeoutMs,
    });
  }

  private async autoScroll(page: Page): Promise<void> {
    await page.evaluate(async () => {
      const delay = 200;
      for (let position = 0; position < document.body.scrollHeight; position += 700) {
        window.scrollTo(0, position);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      window.scrollTo(0, 0);
    });
  }
}
