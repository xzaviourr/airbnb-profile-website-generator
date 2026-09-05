import { describe, expect, it } from "vitest";
import type { SiteConfig } from "./schema.js";
import { createDesignBrief, designBriefSchema } from "./theme.js";

const config: SiteConfig = {
  schemaVersion: "1.0.0",
  generatedAt: "2026-08-31T00:00:00.000Z",
  source: {
    provider: "airbnb",
    hostUrl: "https://www.airbnb.com/users/profile/42",
    extractedAt: "2026-08-31T00:00:00.000Z",
  },
  host: {
    id: "42",
    name: "Priya",
    bio: "A design lover creating warm stays for families.",
    isSuperhost: true,
    languages: ["English"],
  },
  properties: [{
    id: "100",
    sourceUrl: "https://www.airbnb.com/rooms/100",
    title: "Raj Royale Retreats – Premium City Apartment",
    propertyType: "serviced apartment",
    summary: "A luxurious modern family stay.",
    description: "Raj Royale Retreats – A premium and stylish city home near the tech park.",
    location: { formatted: "Bengaluru, India" },
    capacity: { guests: 6, bedrooms: 2, beds: 3, bathrooms: 2 },
    rating: { value: 4.95, reviewCount: 100 },
    amenities: ["Wifi", "Dedicated workspace", "Kitchen"],
    labels: ["Guest favourite"],
    highlights: ["Extra spacious"],
    houseRules: [],
    safetyInformation: [],
    cancellationPolicy: [],
    images: [{
      sourceUrl: "https://images.example.com/home.jpg",
      localPath: "images/home.jpg",
      alt: "Living room",
    }],
    sections: [],
  }],
  replicaGroups: [],
  extractionWarnings: [],
};

describe("design brief generator", () => {
  it("derives a validated, evidence-based personalized direction", () => {
    const brief = createDesignBrief(config, "/tmp/site-config.json");
    expect(designBriefSchema.parse(brief)).toEqual(brief);
    expect(brief.brand.name).toBe("Priya Stays");
    expect(brief.theme.archetype).toBe("urban-luxe");
    expect(brief.audience.primary).toContain("Families");
    expect(brief.conversion.trustSignals).toContain("Superhost status");
    expect(brief.imageDirection.representativeImages).toEqual(["images/home.jpg"]);
    expect(brief.imageDirection.galleryRhythm).toContain("every unique verified property-owned photograph");
    expect(brief.theme.avoid).not.toContain("Using every extracted image without editorial selection");
  });

  it("counts only canonical properties when listings are replicas", () => {
    const replica = {
      ...config.properties[0]!,
      id: "101",
      sourceUrl: "https://www.airbnb.com/rooms/101",
      rating: { value: 4.5, reviewCount: 5 },
    };
    const brief = createDesignBrief({
      ...config,
      properties: [...config.properties, replica],
      replicaGroups: [{
        canonicalPropertyId: "100",
        replicaPropertyIds: ["101"],
        confidence: 0.98,
        evidence: ["5 shared property photos"],
      }],
    }, "/tmp/site-config.json");

    expect(brief.content.heroSupportingText).toContain("collection of 1 stays");
    expect(brief.conversion.trustSignals).toContain("1 clearly differentiated properties");
  });
});
