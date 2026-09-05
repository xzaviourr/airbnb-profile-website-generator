import * as cheerio from "cheerio";
import type { Property } from "./schema.js";
import { roomIdFromUrl } from "./url.js";

export interface PageSnapshot {
  url: string;
  html: string;
}

type JsonObject = Record<string, unknown>;

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const number = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(text(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const strings = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(strings);
  }
  const item = text(value);
  return item ? [item] : [];
};

function objects(value: unknown): JsonObject[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(objects);
  const object = value as JsonObject;
  return [object, ...objects(object["@graph"])];
}

function readJsonLd($: cheerio.CheerioAPI): JsonObject[] {
  const result: JsonObject[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      result.push(...objects(JSON.parse($(element).text()) as unknown));
    } catch {
      // Ignore malformed third-party structured data blocks; the DOM remains authoritative.
    }
  });
  return result;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function canonicalImageUrl(value: string): string {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function belongsToListing(sourceUrl: string, listingId: string | undefined): boolean {
  if (!listingId) return false;
  const url = new URL(sourceUrl);
  if (!/(?:^|\.)muscache\.com$/i.test(url.hostname)) return false;
  const encodedId = Buffer.from(listingId).toString("base64").replace(/=+$/u, "");
  return url.pathname.includes(`Hosting-${listingId}`)
    || url.pathname.includes(encodedId);
}

function imageCandidates($: cheerio.CheerioAPI): string[] {
  const values: string[] = [];
  $("main img").each((_, image) => {
    const attributes = [
      $(image).attr("src"),
      $(image).attr("data-src"),
      $(image).attr("data-original"),
    ];
    values.push(...attributes.filter((value): value is string => Boolean(value)));
    const srcset = $(image).attr("srcset");
    if (srcset) {
      const candidates = srcset.split(",").map((candidate) => candidate.trim().split(/\s+/));
      const largest = candidates.sort((left, right) => number(right[1])! - number(left[1])!).at(0)?.[0];
      if (largest) values.push(largest);
    }
  });
  return values;
}

function meta($: cheerio.CheerioAPI, key: string): string {
  return $(`meta[property="${key}"], meta[name="${key}"]`).first().attr("content")?.trim() ?? "";
}

function findLodging(data: JsonObject[]): JsonObject {
  const types = new Set(["LodgingBusiness", "Accommodation", "Apartment", "House", "Hotel", "Product"]);
  return data.find((item) => strings(item["@type"]).some((type) => types.has(type))) ?? data[0] ?? {};
}

function getNested(object: JsonObject, key: string): JsonObject {
  const value = object[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function sectionText($: cheerio.CheerioAPI, pattern: RegExp): string[] {
  const contents: string[] = [];
  $("section").each((_, section) => {
    const heading = $(section).find("h1,h2,h3").first().text().trim();
    if (pattern.test(heading)) {
      $(section).find("li,p").each((__, element) => {
        contents.push($(element).text());
      });
    }
  });
  return unique(contents);
}

function sectionLeafText($: cheerio.CheerioAPI, pattern: RegExp): string[] {
  const contents: string[] = [];
  $("section").each((_, section) => {
    const heading = $(section).find("h1,h2,h3").first().text().trim();
    if (!pattern.test(heading)) return;
    $(section).find("div,span,li,p").each((__, element) => {
      const item = $(element);
      if (item.find("div,span,li,p").length > 0 || item.closest("button").length > 0) return;
      const value = item.text().trim();
      if (value && value !== heading && !/^Unavailable:/i.test(value)) contents.push(value);
    });
  });
  return unique(contents);
}

function parseCapacity(pageText: string) {
  const read = (pattern: RegExp): number | undefined => number(pageText.match(pattern)?.[1]);
  const guests = read(/(\d+)\s+guests?/i);
  const bedrooms = read(/(\d+)\s+bedrooms?/i);
  const beds = read(/(\d+)\s+beds?/i);
  const bathrooms = read(/(\d+(?:\.\d+)?)\s+(?:private\s+|shared\s+)?baths?/i);
  return {
    ...(guests !== undefined && { guests }),
    ...(bedrooms !== undefined && { bedrooms }),
    ...(beds !== undefined && { beds }),
    ...(bathrooms !== undefined && { bathrooms }),
  };
}

export function discoverListingUrls(snapshot: PageSnapshot): string[] {
  const $ = cheerio.load(snapshot.html);
  const base = new URL(snapshot.url);
  const urls: string[] = [];
  $('a[href*="/rooms/"]').each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const url = new URL(href, base);
    const id = url.pathname.match(/^\/rooms\/(\d+)/)?.[1];
    if (id) urls.push(`${base.origin}/rooms/${id}`);
  });
  return unique(urls);
}

export interface ParsedImage {
  sourceUrl: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface ParsedProperty extends Omit<Property, "images"> {
  remoteImages: ParsedImage[];
}

export function parseProperty(snapshot: PageSnapshot): ParsedProperty {
  const $ = cheerio.load(snapshot.html);
  const structured = findLodging(readJsonLd($));
  const address = getNested(structured, "address");
  const geo = getNested(structured, "geo");
  const rating = getNested(structured, "aggregateRating");
  const pageText = $("main").text() || $("body").text();
  const propertyHeading = $("h2").filter((_, heading) =>
    /^Entire .+ in .+/i.test($(heading).text().trim()),
  ).first().text().trim();
  const title = text(structured.name) || meta($, "og:title") || $("h1").first().text().trim();
  if (!title) throw new Error(`Could not find a title on ${snapshot.url}`);

  const listingId = roomIdFromUrl(snapshot.url);
  const trustedImageUrls = unique([...strings(structured.image), meta($, "og:image")]);
  const strictAirbnbFiltering = /(?:^|\.)airbnb\./i.test(new URL(snapshot.url).hostname);
  const imageUrls = unique(
    unique([
      ...trustedImageUrls,
      ...imageCandidates($).filter((value) =>
        !strictAirbnbFiltering || belongsToListing(value, listingId)),
    ]).flatMap((value) => {
      try {
        return new URL(value).protocol === "https:" ? [canonicalImageUrl(value)] : [];
      } catch {
        return [];
      }
    }),
  );
  const domImages = new Map<string, { alt: string; width?: number; height?: number }>();
  $("img").each((_, image) => {
    const sources = [
      $(image).attr("src"),
      $(image).attr("data-src"),
      $(image).attr("data-original"),
    ].filter((value): value is string => Boolean(value));
    const srcset = $(image).attr("srcset");
    if (srcset) {
      sources.push(...srcset.split(",").map((candidate) => candidate.trim().split(/\s+/)[0] ?? ""));
    }
    const width = number($(image).attr("width"));
    const height = number($(image).attr("height"));
    for (const source of sources.filter(Boolean)) {
      let key = source;
      try {
        key = canonicalImageUrl(source);
      } catch {
        continue;
      }
      domImages.set(key, {
        alt: $(image).attr("alt") ?? "",
        ...(width !== undefined && width > 0 && { width: Math.trunc(width) }),
        ...(height !== undefined && height > 0 && { height: Math.trunc(height) }),
      });
    }
  });

  const amenityFeatures = Array.isArray(structured.amenityFeature)
    ? structured.amenityFeature.flatMap((item) =>
        item && typeof item === "object" ? strings((item as JsonObject).name) : [],
      )
    : [];
  const ratingValue = number(rating.ratingValue);
  const reviewCount = number(rating.reviewCount ?? rating.ratingCount);
  const description = text(structured.description) || meta($, "og:description");
  const offer = Array.isArray(structured.offers)
    ? (structured.offers.find((item) => item && typeof item === "object") as JsonObject | undefined) ?? {}
    : getNested(structured, "offers");
  const price = number(offer.price);
  const currency = text(offer.priceCurrency);
  const sections = $("section").map((_, section) => {
    const heading = $(section).find("h1,h2,h3").first().text().trim();
    const content = unique($(section).find("p,li").map((__, element) => $(element).text()).get());
    return heading && content.length ? { heading, content } : undefined;
  }).get();

  return {
    id: listingId ?? new URL(snapshot.url).pathname,
    sourceUrl: snapshot.url,
    title,
    propertyType: propertyHeading.match(/^Entire (.+?) in /i)?.[1] ?? text(structured["@type"]),
    summary: meta($, "og:description"),
    description,
    location: {
      formatted: text(address.streetAddress)
        || text(address.addressLocality)
        || propertyHeading.match(/\bin (.+)$/i)?.[1]
        || sectionLeafText($, /where you(?:'|’)ll be/i)[0]
        || "",
      ...(text(address.addressLocality) && { locality: text(address.addressLocality) }),
      ...(text(address.addressRegion) && { region: text(address.addressRegion) }),
      ...(text(address.postalCode) && { postalCode: text(address.postalCode) }),
      ...(text(address.addressCountry) && { country: text(address.addressCountry) }),
      ...(number(geo.latitude) !== undefined && { latitude: number(geo.latitude) }),
      ...(number(geo.longitude) !== undefined && { longitude: number(geo.longitude) }),
    },
    capacity: parseCapacity(pageText),
    ...(ratingValue !== undefined && {
      rating: {
        value: ratingValue,
        ...(reviewCount !== undefined && { reviewCount: Math.trunc(reviewCount) }),
      },
    }),
    ...(price !== undefined && currency && {
      pricing: { amount: price, currency, unit: "night" },
    }),
    ...(text(structured.checkinTime) && { checkIn: text(structured.checkinTime) }),
    ...(text(structured.checkoutTime) && { checkOut: text(structured.checkoutTime) }),
    amenities: unique([
      ...amenityFeatures,
      ...sectionText($, /amenit|offers/i),
      ...sectionLeafText($, /what this place offers|amenit/i),
    ]),
    labels: unique($("[aria-label]").map((_, element) => {
      const label = $(element).attr("aria-label") ?? "";
      return /guest favou?rite|superhost/i.test(label) ? label.replace(/\s*Learn more.*$/i, "") : "";
    }).get()),
    highlights: unique([
      ...sectionText($, /highlight|guest favou?rite/i),
      ...sectionLeafText($, /listing highlights|guest favou?rite/i),
    ]),
    houseRules: unique([
      ...sectionText($, /house rules|things to know/i),
      ...sectionLeafText($, /house rules|things to know/i),
    ]),
    safetyInformation: unique([
      ...sectionText($, /safety/i),
      ...sectionLeafText($, /safety/i),
    ]),
    cancellationPolicy: unique([
      ...sectionText($, /cancell/i),
      ...sectionLeafText($, /cancell/i),
    ]),
    remoteImages: imageUrls.map((sourceUrl) => {
      const image = domImages.get(sourceUrl);
      return {
        sourceUrl,
        alt: image?.alt ?? "",
        ...(image?.width !== undefined && { width: image.width }),
        ...(image?.height !== undefined && { height: image.height }),
      };
    }),
    sections,
  };
}

export function parseHost(snapshot: PageSnapshot) {
  const $ = cheerio.load(snapshot.html);
  const pageText = $("body").text();
  const title = $("h1").first().text().trim() || meta($, "og:title") || $("title").text().trim();
  const name = title
    .replace(/\s*[-|].*$/, "")
    .replace(/^(?:meet\s+your\s+host[,:]?\s*|hosted by\s+)/i, "")
    .replace(/^about\s+/i, "")
    .trim();
  if (!name) throw new Error(`Could not find the host name on ${snapshot.url}`);
  const profileImageUrl = meta($, "og:image") || $("main img").first().attr("src") || "";
  const years = number(pageText.match(/(\d+)\s+years?\s+(?:of\s+)?hosting/i)?.[1]);
  const languageText = pageText.match(/Languages?:\s*([^.\n]+)/i)?.[1] ?? "";
  const responseRate = pageText.match(/Response rate:\s*([^.\n]+)/i)?.[1]?.trim();
  const responseTime = pageText.match(/Responds? (?:within|in)\s*([^.\n]+)/i)?.[1]?.trim();
  const bio = sectionText($, /about|bio/i).join("\n\n") || meta($, "og:description");

  return {
    name,
    bio,
    isSuperhost: /\bsuperhost\b/i.test(pageText),
    ...(years !== undefined && { yearsHosting: Math.trunc(years) }),
    languages: unique(languageText.split(/,|·/)),
    ...(responseRate && { responseRate }),
    ...(responseTime && { responseTime }),
    ...(profileImageUrl && {
      profileImage: { sourceUrl: profileImageUrl, alt: `${name} profile photo` },
    }),
  };
}
