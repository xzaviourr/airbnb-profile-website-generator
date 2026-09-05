import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Property, ReplicaGroup, SiteConfig } from "./schema.js";

export interface ReplicaCandidate {
  propertyIds: [string, string];
  evidence: string[];
}

export interface ReplicaAnalysis {
  groups: ReplicaGroup[];
  candidates: ReplicaCandidate[];
}

interface PairAnalysis {
  confirmed: boolean;
  possible: boolean;
  confidence: number;
  evidence: string[];
}

const STOP_WORDS = new Set([
  "and", "apartment", "at", "bedroom", "bhk", "by", "for", "from", "home", "in",
  "near", "of", "stay", "the", "to", "with",
]);

function normalizedTokens(value: string): Set<string> {
  return new Set(value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
}

function similarity(left: Iterable<string>, right: Iterable<string>): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size && !rightSet.size) return 1;
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  return intersection / (leftSet.size + rightSet.size - intersection);
}

function textSimilarity(left: string, right: string): number {
  return similarity(normalizedTokens(left), normalizedTokens(right));
}

function comparableCapacity(left: Property, right: Property): boolean {
  const keys = ["guests", "bedrooms", "beds", "bathrooms"] as const;
  const comparable = keys.filter((key) =>
    left.capacity[key] !== undefined && right.capacity[key] !== undefined);
  return comparable.length >= 2
    && comparable.every((key) => left.capacity[key] === right.capacity[key]);
}

function sourceFingerprint(sourceUrl: string): string {
  const pathname = new URL(sourceUrl).pathname;
  const filename = pathname.split("/").at(-1)?.replace(/\.[^.]+$/u, "");
  return filename ? `source:${filename}` : `url:${sourceUrl}`;
}

async function imageFingerprints(property: Property, outputDirectory?: string): Promise<Set<string>> {
  const fingerprints = await Promise.all(property.images.map(async (image) => {
    if (!outputDirectory || !image.localPath) return sourceFingerprint(image.sourceUrl);
    const contents = await readFile(resolve(outputDirectory, image.localPath));
    return `sha256:${createHash("sha256").update(contents).digest("hex")}`;
  }));
  return new Set(fingerprints);
}

function analyzePair(
  left: Property,
  right: Property,
  leftImages: Set<string>,
  rightImages: Set<string>,
): PairAnalysis {
  const matchingImages = [...leftImages].filter((fingerprint) => rightImages.has(fingerprint)).length;
  const imageOverlap = matchingImages / Math.max(1, Math.min(leftImages.size, rightImages.size));
  const title = textSimilarity(left.title, right.title);
  const description = textSimilarity(left.description, right.description);
  const amenities = similarity(
    left.amenities.map((value) => value.toLowerCase()),
    right.amenities.map((value) => value.toLowerCase()),
  );
  const capacity = comparableCapacity(left, right);
  const sameLocation = left.location.formatted.trim().toLowerCase()
    === right.location.formatted.trim().toLowerCase();

  const strongImageMatch = matchingImages >= 4 && imageOverlap >= 0.7;
  const corroboratedImageMatch = matchingImages >= 3
    && imageOverlap >= 0.5
    && capacity
    && sameLocation
    && Math.max(title, description) >= 0.65;
  const confirmed = strongImageMatch || corroboratedImageMatch;
  const possible = !confirmed
    && capacity
    && sameLocation
    && title >= 0.8
    && description >= 0.92
    && amenities >= 0.85;
  const confidence = strongImageMatch
    ? Math.min(0.99, 0.88 + imageOverlap * 0.11)
    : Math.min(0.95, 0.75 + imageOverlap * 0.2 + Math.max(title, description) * 0.05);
  const evidence = [
    `${matchingImages} shared property photos (${Math.round(imageOverlap * 100)}% overlap)`,
    `title similarity ${Math.round(title * 100)}%`,
    `description similarity ${Math.round(description * 100)}%`,
    `amenity similarity ${Math.round(amenities * 100)}%`,
    capacity ? "matching capacity facts" : "different or incomplete capacity facts",
    sameLocation ? "matching location" : "different location",
  ];

  return { confirmed, possible, confidence, evidence };
}

function chooseCanonical(properties: Property[]): Property {
  return [...properties].sort((left, right) =>
    (right.rating?.reviewCount ?? 0) - (left.rating?.reviewCount ?? 0)
    || right.images.length - left.images.length
    || right.amenities.length - left.amenities.length
    || (right.rating?.value ?? 0) - (left.rating?.value ?? 0)
    || left.id.localeCompare(right.id))[0]!;
}

export async function detectListingReplicas(
  properties: Property[],
  outputDirectory?: string,
): Promise<ReplicaAnalysis> {
  const fingerprints = new Map<string, Set<string>>();
  for (const property of properties) {
    fingerprints.set(property.id, await imageFingerprints(property, outputDirectory));
  }

  const parent = new Map(properties.map(({ id }) => [id, id]));
  const find = (id: string): string => {
    const current = parent.get(id)!;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  const confirmedPairs = new Map<string, PairAnalysis>();
  const candidates: ReplicaCandidate[] = [];
  for (let leftIndex = 0; leftIndex < properties.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < properties.length; rightIndex += 1) {
      const left = properties[leftIndex]!;
      const right = properties[rightIndex]!;
      const result = analyzePair(
        left,
        right,
        fingerprints.get(left.id)!,
        fingerprints.get(right.id)!,
      );
      if (result.confirmed) {
        union(left.id, right.id);
        confirmedPairs.set(`${left.id}:${right.id}`, result);
      } else if (result.possible) {
        candidates.push({ propertyIds: [left.id, right.id], evidence: result.evidence });
      }
    }
  }

  const clusters = new Map<string, Property[]>();
  for (const property of properties) {
    const root = find(property.id);
    clusters.set(root, [...(clusters.get(root) ?? []), property]);
  }

  const groups = [...clusters.values()]
    .filter((cluster) => cluster.length > 1)
    .map((cluster): ReplicaGroup => {
      const canonical = chooseCanonical(cluster);
      const clusterIds = new Set(cluster.map(({ id }) => id));
      const pairResults = [...confirmedPairs.entries()]
        .filter(([key]) => key.split(":").every((id) => clusterIds.has(id)))
        .map(([, result]) => result);
      return {
        canonicalPropertyId: canonical.id,
        replicaPropertyIds: cluster
          .map(({ id }) => id)
          .filter((id) => id !== canonical.id)
          .sort(),
        confidence: Math.min(...pairResults.map(({ confidence }) => confidence)),
        evidence: [...new Set(pairResults.flatMap(({ evidence }) => evidence))],
      };
    })
    .sort((left, right) => left.canonicalPropertyId.localeCompare(right.canonicalPropertyId));

  return { groups, candidates };
}

export function websiteProperties(config: Pick<SiteConfig, "properties" | "replicaGroups">): Property[] {
  const hiddenIds = new Set(
    config.replicaGroups.flatMap(({ replicaPropertyIds }) => replicaPropertyIds),
  );
  return config.properties.filter(({ id }) => !hiddenIds.has(id));
}
