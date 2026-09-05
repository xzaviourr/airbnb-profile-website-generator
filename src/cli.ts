#!/usr/bin/env node
import { resolve } from "node:path";
import { Command, InvalidArgumentError } from "commander";
import { extractHost } from "./extractor.js";

function positiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("Expected a positive integer.");
  }
  return parsed;
}

const program = new Command()
  .name("airbnb-convertor")
  .description("Convert a host-owned Airbnb profile and listings into a portable website config.")
  .argument("<host-url>", "Public Airbnb host profile URL")
  .requiredOption(
    "--acknowledge-site-terms",
    "Confirm you own/manage the listings and are authorized to import their content",
  )
  .option("-o, --output <directory>", "Output directory", "./output")
  .option("--headless", "Run without showing the browser (visible browser is the default)")
  .option("--skip-images", "Write config without downloading image files")
  .option("--max-listings <count>", "Limit listings imported", positiveInteger)
  .option("--timeout <milliseconds>", "Page timeout", positiveInteger, 45_000)
  .option("--delay <milliseconds>", "Delay between page visits", positiveInteger, 2_000)
  .action(async (hostUrl: string, flags: {
    output: string;
    headless?: boolean;
    skipImages?: boolean;
    maxListings?: number;
    timeout: number;
    delay: number;
  }) => {
    const result = await extractHost(hostUrl, {
      outputDirectory: resolve(flags.output),
      timeoutMs: flags.timeout,
      delayMs: flags.delay,
      ...(flags.headless !== undefined && { headless: flags.headless }),
      ...(flags.skipImages !== undefined && { skipImages: flags.skipImages }),
      ...(flags.maxListings !== undefined && { maxListings: flags.maxListings }),
    });
    process.stdout.write(
      `Imported ${result.config.properties.length} properties.\nConfig: ${result.configPath}\n`,
    );
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Extraction failed: ${message}\n`);
  process.exitCode = 1;
});
