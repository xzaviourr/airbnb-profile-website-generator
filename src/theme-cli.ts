#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { siteConfigSchema } from "./schema.js";
import { createDesignBrief } from "./theme.js";

const program = new Command()
  .name("airbnb-theme")
  .description("Create an evidence-based website design brief from an extracted host config.")
  .argument("<site-config>", "Path to site-config.json")
  .option("-o, --output <file>", "Design brief output path")
  .action(async (configValue: string, flags: { output?: string }) => {
    const configPath = resolve(configValue);
    const outputPath = resolve(flags.output ?? dirname(configPath), flags.output ? "" : "design-brief.json");
    const config = siteConfigSchema.parse(JSON.parse(await readFile(configPath, "utf8")) as unknown);
    const brief = createDesignBrief(config, configPath);
    await writeFile(outputPath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
    process.stdout.write(`Theme: ${brief.theme.archetype} (${Math.round(brief.theme.confidence * 100)}% confidence)\n`);
    process.stdout.write(`Design brief: ${outputPath}\n`);
  });

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(`Theme generation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
