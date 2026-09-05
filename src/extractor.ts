import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import slugify from "slugify";
import { BrowserCapture } from "./browser.js";
import { downloadImage, imageStem } from "./media.js";
import { discoverListingUrls, parseHost, parseProperty } from "./parser.js";
import { detectListingReplicas } from "./replicas.js";
import { siteConfigSchema, type ImageAsset, type SiteConfig } from "./schema.js";
import { hostIdFromUrl, parseAirbnbUrl } from "./url.js";

export interface ExtractOptions {
  outputDirectory: string;
  headless?: boolean;
  timeoutMs?: number;
  delayMs?: number;
  maxListings?: number;
  skipImages?: boolean;
}

export async function extractHost(
  hostUrlValue: string,
  options: ExtractOptions,
): Promise<{ config: SiteConfig; configPath: string }> {
  const hostUrl = parseAirbnbUrl(hostUrlValue).toString();
  const capture = new BrowserCapture({
    headless: options.headless ?? false,
    timeoutMs: options.timeoutMs ?? 45_000,
    delayMs: options.delayMs ?? 2_000,
  });

  await mkdir(options.outputDirectory, { recursive: true });
  await capture.start();
  try {
    const extractionWarnings: string[] = [];
    const hostSnapshot = await capture.capture(hostUrl);
    const listingUrls = discoverListingUrls(hostSnapshot).slice(0, options.maxListings);
    if (!listingUrls.length) {
      throw new Error(
        "No listing links were found. Confirm the public host page shows listings and is fully loaded.",
      );
    }

    const parsedHost = parseHost(hostSnapshot);
    let profileImage: ImageAsset | undefined;
    if (parsedHost.profileImage && !options.skipImages) {
      try {
        profileImage = await downloadImage(
          parsedHost.profileImage,
          options.outputDirectory,
          join(options.outputDirectory, "images", "host"),
          "profile",
        );
      } catch (error) {
        extractionWarnings.push(
          `Host image was not downloaded (${parsedHost.profileImage.sourceUrl}): ${errorMessage(error)}`,
        );
        profileImage = parsedHost.profileImage;
      }
    } else if (parsedHost.profileImage) {
      profileImage = parsedHost.profileImage;
    }

    const properties = [];
    for (const listingUrl of listingUrls) {
      const parsed = parseProperty(await capture.capture(listingUrl));
      const propertySlug = slugify(`${parsed.title}-${parsed.id}`, { lower: true, strict: true });
      const images: ImageAsset[] = [];
      for (const [index, image] of parsed.remoteImages.entries()) {
        if (options.skipImages) {
          images.push(image);
          continue;
        }
        try {
          images.push(await downloadImage(
            image,
            options.outputDirectory,
            join(options.outputDirectory, "images", "properties", propertySlug),
            imageStem(index),
          ));
        } catch (error) {
          extractionWarnings.push(
            `Property ${parsed.id} image was not downloaded (${image.sourceUrl}): ${errorMessage(error)}`,
          );
          images.push(image);
        }
      }
      const { remoteImages: _, ...property } = parsed;
      properties.push({ ...property, images });
    }

    const replicaAnalysis = await detectListingReplicas(properties, options.outputDirectory);
    for (const candidate of replicaAnalysis.candidates) {
      extractionWarnings.push(
        `Possible replica listings require review (${candidate.propertyIds.join(", ")}): ${candidate.evidence.join("; ")}.`,
      );
    }

    const now = new Date().toISOString();
    const config = siteConfigSchema.parse({
      schemaVersion: "1.0.0",
      generatedAt: now,
      source: { provider: "airbnb", hostUrl, extractedAt: now },
      host: {
        id: hostIdFromUrl(hostUrl),
        name: parsedHost.name,
        bio: parsedHost.bio,
        isSuperhost: parsedHost.isSuperhost
          || properties.some((property) =>
            property.labels.some((label) => /\bsuperhost\b/i.test(label))),
        languages: parsedHost.languages,
        ...(parsedHost.yearsHosting !== undefined && { yearsHosting: parsedHost.yearsHosting }),
        ...(profileImage && { profileImage }),
      },
      properties,
      replicaGroups: replicaAnalysis.groups,
      extractionWarnings,
    });
    const configPath = join(options.outputDirectory, "site-config.json");
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    return { config, configPath };
  } finally {
    await capture.close();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
