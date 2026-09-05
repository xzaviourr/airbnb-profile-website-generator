import { z } from "zod";
import { websiteProperties } from "./replicas.js";
import type { SiteConfig } from "./schema.js";

const archetypes = [
  "urban-luxe",
  "heritage-story",
  "coastal-calm",
  "nature-retreat",
  "family-warmth",
  "minimal-studio",
] as const;

type Archetype = (typeof archetypes)[number];

const archetypeSchema = z.enum(archetypes);

export const designBriefSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  generatedAt: z.iso.datetime(),
  sourceConfig: z.string(),
  brand: z.object({
    name: z.string().min(1),
    hostName: z.string().min(1),
    promise: z.string().min(1),
    personality: z.array(z.string().min(1)).min(3),
    voice: z.string().min(1),
  }),
  audience: z.object({
    primary: z.string().min(1),
    secondary: z.array(z.string().min(1)),
    needs: z.array(z.string().min(1)).min(2),
  }),
  theme: z.object({
    archetype: archetypeSchema,
    confidence: z.number().min(0).max(1),
    rationale: z.array(z.string().min(1)).min(1),
    visualDirection: z.string().min(1),
    avoid: z.array(z.string().min(1)),
  }),
  tokens: z.object({
    colors: z.object({
      ink: z.string(),
      background: z.string(),
      surface: z.string(),
      primary: z.string(),
      accent: z.string(),
      muted: z.string(),
    }),
    typography: z.object({
      displayStyle: z.string(),
      bodyStyle: z.string(),
    }),
    shape: z.object({
      radius: z.string(),
      imageTreatment: z.string(),
    }),
  }),
  content: z.object({
    heroHeadline: z.string().min(1),
    heroSupportingText: z.string().min(1),
    primaryCta: z.string().min(1),
    navigation: z.array(z.string().min(1)),
    homepageSections: z.array(z.string().min(1)).min(5),
    propertyPageSections: z.array(z.string().min(1)).min(4),
  }),
  imageDirection: z.object({
    heroCriteria: z.string().min(1),
    galleryRhythm: z.string().min(1),
    paletteInstruction: z.string().min(1),
    representativeImages: z.array(z.string().min(1)),
  }),
  conversion: z.object({
    primaryGoal: z.string().min(1),
    trustSignals: z.array(z.string().min(1)),
    bookingStrategy: z.string().min(1),
  }),
});

export type DesignBrief = z.infer<typeof designBriefSchema>;

interface ArchetypeDefinition {
  keywords: RegExp;
  personality: [string, string, string];
  visualDirection: string;
  colors: DesignBrief["tokens"]["colors"];
  typography: DesignBrief["tokens"]["typography"];
  shape: DesignBrief["tokens"]["shape"];
}

const DEFINITIONS: Record<Archetype, ArchetypeDefinition> = {
  "urban-luxe": {
    keywords: /\b(luxury|luxurious|premium|stylish|modern|city|urban|apartment|workspace|business|tech park)\b/gi,
    personality: ["polished", "assured", "welcoming"],
    visualDirection: "Editorial city hospitality with generous photography, sharp hierarchy, and restrained premium details.",
    colors: {
      ink: "#18201D",
      background: "#F6F2EA",
      surface: "#FFFFFF",
      primary: "#25483E",
      accent: "#C47A44",
      muted: "#77766F",
    },
    typography: { displayStyle: "high-contrast editorial serif", bodyStyle: "humanist sans serif" },
    shape: { radius: "soft 18px corners", imageTreatment: "large cinematic crops with occasional inset portraits" },
  },
  "heritage-story": {
    keywords: /\b(heritage|historic|traditional|restored|haveli|palace|ancestral|architecture|culture)\b/gi,
    personality: ["storied", "artisanal", "gracious"],
    visualDirection: "A richly layered editorial experience inspired by local craft, history, and the host's story.",
    colors: {
      ink: "#291B16",
      background: "#F5EBDD",
      surface: "#FFF9F0",
      primary: "#7B3527",
      accent: "#C49A4A",
      muted: "#806F63",
    },
    typography: { displayStyle: "expressive old-style serif", bodyStyle: "quiet contemporary sans serif" },
    shape: { radius: "subtle 8px corners", imageTreatment: "framed photographs with warm borders and detail crops" },
  },
  "coastal-calm": {
    keywords: /\b(beach|coast|sea|ocean|island|surf|waterfront|bay|marine|sunset)\b/gi,
    personality: ["breezy", "restorative", "unhurried"],
    visualDirection: "Light-filled coastal minimalism with open spacing, horizon-led imagery, and calm movement.",
    colors: {
      ink: "#15313A",
      background: "#F4FAF8",
      surface: "#FFFFFF",
      primary: "#1F6573",
      accent: "#E59B72",
      muted: "#70858A",
    },
    typography: { displayStyle: "light contemporary serif", bodyStyle: "open geometric sans serif" },
    shape: { radius: "flowing 24px corners", imageTreatment: "wide horizon crops and airy edge-to-edge galleries" },
  },
  "nature-retreat": {
    keywords: /\b(forest|mountain|garden|farm|cabin|lake|river|nature|outdoors|view|valley|hike)\b/gi,
    personality: ["grounded", "restful", "authentic"],
    visualDirection: "Tactile nature-led hospitality using organic rhythm, grounded color, and immersive landscape imagery.",
    colors: {
      ink: "#202820",
      background: "#F1F0E5",
      surface: "#FAFAF3",
      primary: "#526344",
      accent: "#B26D3D",
      muted: "#74786A",
    },
    typography: { displayStyle: "warm book serif", bodyStyle: "practical neo-grotesk sans serif" },
    shape: { radius: "organic 14px corners", imageTreatment: "landscape-first crops mixed with tactile detail photography" },
  },
  "family-warmth": {
    keywords: /\b(family|families|kids|child|spacious|group|home|safe|kitchen|games|friendly)\b/gi,
    personality: ["warm", "easygoing", "thoughtful"],
    visualDirection: "Bright, reassuring residential hospitality with clear information and moments of playful warmth.",
    colors: {
      ink: "#28302E",
      background: "#FFF8EC",
      surface: "#FFFFFF",
      primary: "#37675D",
      accent: "#E28A5B",
      muted: "#7A7770",
    },
    typography: { displayStyle: "friendly soft serif", bodyStyle: "high-legibility rounded sans serif" },
    shape: { radius: "friendly 20px corners", imageTreatment: "welcoming room sequences and practical feature close-ups" },
  },
  "minimal-studio": {
    keywords: /\b(minimal|studio|compact|loft|design|simple|clean|contemporary|solo)\b/gi,
    personality: ["considered", "clear", "independent"],
    visualDirection: "Design-forward restraint with a precise grid, quiet typography, and object-focused photography.",
    colors: {
      ink: "#171717",
      background: "#F5F5F2",
      surface: "#FFFFFF",
      primary: "#343B38",
      accent: "#A56A45",
      muted: "#777773",
    },
    typography: { displayStyle: "architectural grotesk", bodyStyle: "neutral sans serif" },
    shape: { radius: "precise 4px corners", imageTreatment: "structured grid crops with strong negative space" },
  },
};

function corpus(config: SiteConfig): string {
  return [
    config.host.bio,
    ...config.properties.flatMap((property) => [
      property.title,
      property.propertyType,
      property.summary,
      property.description,
      property.location.formatted,
      ...property.amenities,
      ...property.highlights,
      ...property.labels,
    ]),
  ].join(" ");
}

function scoreArchetypes(value: string): Array<{ archetype: Archetype; score: number }> {
  return archetypes.map((archetype) => ({
    archetype,
    score: value.match(DEFINITIONS[archetype].keywords)?.length ?? 0,
  })).sort((left, right) => right.score - left.score);
}

function inferBrandName(config: SiteConfig): string {
  const candidates = config.properties.flatMap((property) =>
    [...property.description.matchAll(/\b([A-Z][\p{L}'&]+(?:\s+[A-Z][\p{L}'&]+){1,3})\s*[–—-]/gu)]
      .map((match) => match[1]?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  const counts = new Map<string, number>();
  for (const candidate of candidates) counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  const repeated = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return repeated && repeated[1] >= 2 ? repeated[0] : `${config.host.name} Stays`;
}

function locations(config: SiteConfig): string[] {
  return [...new Set(config.properties.map((property) => property.location.formatted).filter(Boolean))];
}

function inferAudience(config: SiteConfig, value: string): DesignBrief["audience"] {
  const maxGuests = Math.max(...config.properties.map((property) => property.capacity.guests ?? 0));
  const hasWorkspace = /\b(workspace|business|tech park|wifi)\b/i.test(value);
  const primary = maxGuests >= 5
    ? "Families and small groups seeking a dependable, elevated stay"
    : "Couples and independent travellers seeking a distinctive local stay";
  return {
    primary,
    secondary: [
      ...(hasWorkspace ? ["Business travellers and extended-stay guests"] : []),
      "Guests who value a responsive, trusted host",
    ],
    needs: [
      "Quickly compare properties and sleeping capacity",
      "Understand the character and practical comforts of each stay",
      "Feel confident through ratings, reviews, and clear host credibility",
    ],
  };
}

export function createDesignBrief(config: SiteConfig, sourceConfig: string): DesignBrief {
  config = { ...config, properties: websiteProperties(config) };
  const value = corpus(config);
  const scores = scoreArchetypes(value);
  const winner = scores[0] ?? { archetype: "minimal-studio" as const, score: 0 };
  const runnerUp = scores[1]?.score ?? 0;
  const definition = DEFINITIONS[winner.archetype];
  const confidence = winner.score === 0
    ? 0.35
    : Math.min(0.95, 0.55 + (winner.score - runnerUp) / Math.max(winner.score, 1) * 0.4);
  const brandName = inferBrandName(config);
  const place = locations(config).join(" and ") || "the destination";
  const imagePaths = config.properties.flatMap((property) =>
    property.images.slice(0, 3).map((image) => image.localPath ?? image.sourceUrl),
  );
  const averageRating = config.properties
    .map((property) => property.rating?.value)
    .filter((rating): rating is number => rating !== undefined)
    .reduce((sum, rating, _, ratings) => sum + rating / ratings.length, 0);

  return designBriefSchema.parse({
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    sourceConfig,
    brand: {
      name: brandName,
      hostName: config.host.name,
      promise: `Thoughtful stays in ${place}, hosted with personal care.`,
      personality: definition.personality,
      voice: "Specific, confident, warm, and locally grounded; never generic, inflated, or corporate.",
    },
    audience: inferAudience(config, value),
    theme: {
      archetype: winner.archetype,
      confidence,
      rationale: [
        `${winner.score} content signals matched the ${winner.archetype} direction.`,
        `${config.properties.length} properties share a coherent host story and destination.`,
        `The final palette must be reconciled with dominant colors from representative photography.`,
      ],
      visualDirection: definition.visualDirection,
      avoid: [
        "Airbnb visual imitation or Airbnb red as a default brand color",
        "Generic luxury clichés, fake awards, and unsupported claims",
        "Padding galleries with avatars, platform assets, map tiles, unrelated listings, or duplicate image variants",
        "Hiding practical property differences behind decorative layouts",
      ],
    },
    tokens: {
      colors: definition.colors,
      typography: definition.typography,
      shape: definition.shape,
    },
    content: {
      heroHeadline: `${brandName}, made for the way you travel`,
      heroSupportingText: `A considered collection of ${config.properties.length} stays in ${place}, personally hosted by ${config.host.name}.`,
      primaryCta: "Explore the stays",
      navigation: ["Stays", "Our story", "The neighbourhood", "Contact"],
      homepageSections: [
        "Immersive hero with one clear promise",
        "Property collection with meaningful comparison details",
        "Why guests choose these stays",
        "Host story and credibility",
        "Destination or neighbourhood narrative",
        "Closing booking or enquiry call to action",
      ],
      propertyPageSections: [
        "Property-specific hero and quick facts",
        "Editorial gallery",
        "Story and highlights",
        "Amenities grouped by guest need",
        "Sleeping arrangements and house information",
        "Location context and enquiry call to action",
      ],
    },
    imageDirection: {
      heroCriteria: "Choose the strongest wide image with a clear focal point, natural light, and enough negative space for readable copy.",
      galleryRhythm: "Lead with strong establishing views, then present every unique verified property-owned photograph without introducing unrelated thumbnails or platform imagery.",
      paletteInstruction: "Inspect representative images and adjust the seed palette toward recurring architectural/material colors while preserving accessible contrast.",
      representativeImages: imagePaths.slice(0, 12),
    },
    conversion: {
      primaryGoal: "Help visitors choose a property and continue to an authorized booking or direct-enquiry channel.",
      trustSignals: [
        ...(config.host.isSuperhost ? ["Superhost status"] : []),
        ...(averageRating > 0 ? [`Portfolio average rating of ${averageRating.toFixed(2)}`] : []),
        `${config.properties.length} clearly differentiated properties`,
        "Real property photography and transparent practical information",
      ],
      bookingStrategy: "Use property-specific Airbnb source links as the safe default. Add direct booking only when the host supplies an authorized booking engine and policies.",
    },
  });
}
