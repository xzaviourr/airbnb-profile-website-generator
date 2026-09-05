import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { discoverListingUrls, parseHost, parseProperty } from "./parser.js";

const fixture = async (name: string) =>
  readFile(fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url)), "utf8");

describe("host parser", () => {
  it("extracts host details and unique canonical listing URLs", async () => {
    const snapshot = {
      url: "https://www.airbnb.com/users/show/42",
      html: await fixture("host.html"),
    };
    expect(parseHost(snapshot)).toMatchObject({
      name: "Priya",
      bio: "I love introducing guests to Jaipur.",
      isSuperhost: true,
      yearsHosting: 6,
    });
    expect(discoverListingUrls(snapshot)).toEqual([
      "https://www.airbnb.com/rooms/12345",
      "https://www.airbnb.com/rooms/67890",
    ]);
  });
});

describe("property parser", () => {
  it("normalizes structured data and semantic sections", async () => {
    const property = parseProperty({
      url: "https://www.airbnb.com/rooms/12345",
      html: await fixture("property.html"),
    });
    expect(property).toMatchObject({
      id: "12345",
      title: "Pink City Haveli",
      propertyType: "LodgingBusiness",
      description: "A lovingly restored heritage home.",
      location: {
        formatted: "Jaipur",
        locality: "Jaipur",
        region: "Rajasthan",
        country: "IN",
        latitude: 26.9124,
        longitude: 75.7873,
      },
      capacity: { guests: 4, bedrooms: 2, beds: 2, bathrooms: 1.5 },
      rating: { value: 4.91, reviewCount: 87 },
      pricing: { amount: 125, currency: "USD", unit: "night" },
      checkIn: "15:00",
      checkOut: "11:00",
      amenities: ["Wifi", "Kitchen", "Air conditioning"],
      labels: [],
      houseRules: ["No smoking"],
      safetyInformation: ["Smoke alarm installed"],
    });
    expect(property.remoteImages).toHaveLength(2);
    expect(property.remoteImages[0]).toMatchObject({
      sourceUrl: "https://images.example.com/haveli-1.jpg",
      alt: "Courtyard",
      width: 1200,
      height: 800,
    });
  });

  it("keeps only canonical photos owned by the current Airbnb listing", async () => {
    const property = parseProperty({
      url: "https://www.airbnb.com/rooms/12345",
      html: await fixture("airbnb-property.html"),
    });

    expect(property.remoteImages.map(({ sourceUrl }) => sourceUrl)).toEqual([
      "https://a0.muscache.com/im/pictures/hosting/Hosting-12345/original/property-one.jpeg",
      "https://a0.muscache.com/im/pictures/miso/Hosting-12345/original/property-two.jpeg",
    ]);
  });
});
