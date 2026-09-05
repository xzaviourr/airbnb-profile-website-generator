import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Property } from "./schema.js";
import { detectListingReplicas, websiteProperties } from "./replicas.js";

function property(
  id: string,
  imageNames: string[],
  overrides: Partial<Property> = {},
): Property {
  return {
    id,
    sourceUrl: `https://www.airbnb.com/rooms/${id}`,
    title: "Bright 2BHK near the tech park",
    propertyType: "serviced apartment",
    summary: "A bright city stay.",
    description: "A spacious city apartment for families and business travellers.",
    location: { formatted: "Bengaluru, India" },
    capacity: { guests: 6, bedrooms: 2, beds: 2, bathrooms: 2 },
    amenities: ["Kitchen", "Wifi", "Dedicated workspace", "Free parking"],
    labels: [],
    highlights: [],
    houseRules: [],
    safetyInformation: [],
    cancellationPolicy: [],
    images: imageNames.map((name) => ({
      sourceUrl: `https://a0.muscache.com/im/pictures/hosting/Hosting-${id}/original/${name}.jpg`,
      alt: "",
    })),
    sections: [],
    ...overrides,
  };
}

describe("listing replica detection", () => {
  it("groups copied listings and chooses the most established source as canonical", async () => {
    const original = property("100", ["a", "b", "c", "d", "e"], {
      rating: { value: 4.8, reviewCount: 12 },
    });
    const copy = property("200", ["a", "b", "c", "d", "e"], {
      rating: { value: 4.7, reviewCount: 48 },
    });

    const analysis = await detectListingReplicas([original, copy]);

    expect(analysis.candidates).toEqual([]);
    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0]?.canonicalPropertyId).toBe("200");
    expect(analysis.groups[0]?.replicaPropertyIds).toEqual(["100"]);
    expect(websiteProperties({
      properties: [original, copy],
      replicaGroups: analysis.groups,
    }).map(({ id }) => id)).toEqual(["200"]);
  });

  it("matches downloaded photo content even when source URLs differ", async () => {
    const directory = await mkdtemp(join(tmpdir(), "airbnb-replicas-"));
    try {
      const first = property("100", ["a", "b", "c", "d"]);
      const second = property("200", ["w", "x", "y", "z"]);
      for (const [index, image] of first.images.entries()) {
        image.localPath = `first-${index}.jpg`;
        await writeFile(join(directory, image.localPath), `shared-photo-${index}`);
      }
      for (const [index, image] of second.images.entries()) {
        image.localPath = `second-${index}.jpg`;
        await writeFile(join(directory, image.localPath), `shared-photo-${index}`);
      }

      const analysis = await detectListingReplicas([first, second], directory);

      expect(analysis.groups).toHaveLength(1);
      expect(analysis.groups[0]?.replicaPropertyIds).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("does not merge similar units without shared-photo evidence", async () => {
    const first = property("100", ["a", "b", "c", "d"]);
    const second = property("200", ["w", "x", "y", "z"], {
      title: "Modern 2BHK near the tech park",
      description: "A different apartment with a park view and modern interiors.",
    });

    const analysis = await detectListingReplicas([first, second]);

    expect(analysis.groups).toEqual([]);
    expect(analysis.candidates).toEqual([]);
  });

  it("combines transitively linked copies into one replica group", async () => {
    const first = property("100", ["a", "b", "c", "d"]);
    const second = property("200", ["a", "b", "c", "d", "e"], {
      rating: { value: 4.9, reviewCount: 60 },
    });
    const third = property("300", ["b", "c", "d", "e"]);

    const analysis = await detectListingReplicas([first, second, third]);

    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0]?.canonicalPropertyId).toBe("200");
    expect(analysis.groups[0]?.replicaPropertyIds).toEqual(["100", "300"]);
  });

  it("flags text-identical listings without enough photo evidence for review", async () => {
    const first = property("100", ["a"]);
    const second = property("200", ["z"]);

    const analysis = await detectListingReplicas([first, second]);

    expect(analysis.groups).toEqual([]);
    expect(analysis.candidates).toHaveLength(1);
    expect(analysis.candidates[0]?.propertyIds).toEqual(["100", "200"]);
  });
});
