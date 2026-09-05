import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ImageAsset } from "./schema.js";
import type { ParsedImage } from "./parser.js";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const CONTENT_EXTENSIONS: Record<string, string> = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function safeExtension(sourceUrl: string, contentType: string): string {
  const fromType = CONTENT_EXTENSIONS[contentType.split(";")[0]?.trim() ?? ""];
  if (fromType) return fromType;
  const extension = extname(new URL(sourceUrl).pathname).toLowerCase();
  return [".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"].includes(extension)
    ? extension
    : ".jpg";
}

export async function downloadImage(
  image: ParsedImage,
  outputDirectory: string,
  directory: string,
  fileStem: string,
): Promise<ImageAsset> {
  const url = new URL(image.sourceUrl);
  if (url.protocol !== "https:") throw new Error(`Refusing non-HTTPS image: ${url}`);

  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
    headers: { "user-agent": "AirbnbConvertor/0.1 (host-authorized import)" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Image download failed (${response.status}): ${url}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Expected image content but received ${contentType || "unknown"}: ${url}`);
  }
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) {
    throw new Error(`Image exceeds ${MAX_IMAGE_BYTES} bytes: ${url}`);
  }

  await mkdir(directory, { recursive: true });
  const destination = join(directory, `${fileStem}${safeExtension(image.sourceUrl, contentType)}`);
  const temporary = `${destination}.part`;
  let received = 0;
  const limited = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream)
    .map((chunk: Uint8Array) => {
      received += chunk.byteLength;
      if (received > MAX_IMAGE_BYTES) throw new Error(`Image exceeds ${MAX_IMAGE_BYTES} bytes: ${url}`);
      return chunk;
    });
  try {
    await pipeline(limited, createWriteStream(temporary, { flags: "w" }));
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }

  return {
    sourceUrl: image.sourceUrl,
    localPath: relative(outputDirectory, destination).split("\\").join("/"),
    alt: image.alt,
    ...(image.width !== undefined && { width: image.width }),
    ...(image.height !== undefined && { height: image.height }),
  };
}

export function imageStem(index: number): string {
  return `image-${String(index + 1).padStart(3, "0")}`;
}
