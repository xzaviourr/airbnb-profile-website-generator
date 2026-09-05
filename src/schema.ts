import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const imageSchema = z.object({
  sourceUrl: z.url(),
  localPath: nonEmpty.optional(),
  alt: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const ratingSchema = z.object({
  value: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative().optional(),
});

export const addressSchema = z.object({
  formatted: z.string(),
  locality: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const propertySchema = z.object({
  id: nonEmpty,
  sourceUrl: z.url(),
  title: nonEmpty,
  propertyType: z.string(),
  summary: z.string(),
  description: z.string(),
  location: addressSchema,
  capacity: z.object({
    guests: z.number().int().nonnegative().optional(),
    bedrooms: z.number().int().nonnegative().optional(),
    beds: z.number().int().nonnegative().optional(),
    bathrooms: z.number().nonnegative().optional(),
  }),
  rating: ratingSchema.optional(),
  pricing: z.object({
    amount: z.number().nonnegative(),
    currency: nonEmpty,
    unit: z.string(),
  }).optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  amenities: z.array(nonEmpty),
  labels: z.array(nonEmpty),
  highlights: z.array(nonEmpty),
  houseRules: z.array(nonEmpty),
  safetyInformation: z.array(nonEmpty),
  cancellationPolicy: z.array(nonEmpty),
  images: z.array(imageSchema),
  sections: z.array(z.object({
    heading: nonEmpty,
    content: z.array(nonEmpty),
  })),
});

export const replicaGroupSchema = z.object({
  canonicalPropertyId: nonEmpty,
  replicaPropertyIds: z.array(nonEmpty).min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(nonEmpty).min(1),
});

export const siteConfigSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  generatedAt: z.iso.datetime(),
  source: z.object({
    provider: z.literal("airbnb"),
    hostUrl: z.url(),
    extractedAt: z.iso.datetime(),
  }),
  host: z.object({
    id: z.string().optional(),
    name: nonEmpty,
    bio: z.string(),
    profileImage: imageSchema.optional(),
    isSuperhost: z.boolean(),
    yearsHosting: z.number().int().nonnegative().optional(),
    languages: z.array(nonEmpty),
    responseRate: z.string().optional(),
    responseTime: z.string().optional(),
  }),
  properties: z.array(propertySchema).min(1),
  replicaGroups: z.array(replicaGroupSchema).default([]),
  extractionWarnings: z.array(nonEmpty),
}).superRefine((config, context) => {
  const propertyIds = new Set(config.properties.map(({ id }) => id));
  const groupedIds = new Set<string>();

  for (const [groupIndex, group] of config.replicaGroups.entries()) {
    const ids = [group.canonicalPropertyId, ...group.replicaPropertyIds];
    for (const id of ids) {
      if (!propertyIds.has(id)) {
        context.addIssue({
          code: "custom",
          message: `Replica group references unknown property ${id}.`,
          path: ["replicaGroups", groupIndex],
        });
      }
      if (groupedIds.has(id)) {
        context.addIssue({
          code: "custom",
          message: `Property ${id} belongs to more than one replica group.`,
          path: ["replicaGroups", groupIndex],
        });
      }
      groupedIds.add(id);
    }
  }
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type Property = z.infer<typeof propertySchema>;
export type ImageAsset = z.infer<typeof imageSchema>;
export type ReplicaGroup = z.infer<typeof replicaGroupSchema>;
