---
name: airbnb-website
description: Import an authorized Airbnb host profile and build a complete, personalized hospitality website whose theme is derived from the host, properties, destination, amenities, and photography.
---

# Airbnb Website

Use this skill when the user provides an Airbnb host/profile URL and asks to create, generate, redesign, or preview a website for that host.

## Outcome

Produce a complete responsive website, not a mockup or design proposal. The final deliverables are:

- `site-config.json` and local property media
- `design-brief.json` documenting evidence-based design decisions
- a runnable three-file static website in the requested directory
- a visual QA pass at mobile and desktop sizes
- a concise report of extracted properties, personalization decisions, warnings, and run instructions

The default lifecycle is:

```text
authorized Airbnb profile
  → canonical extracted package
  → replica consolidation
  → evidence-led three-file website
  → complete local QA
  → operator approval
  → operator-managed hosting
```

Do not publish or deploy generated websites from this repository.

## Non-negotiable boundaries

- Require the user to own/manage the listings or have authorization to reuse the content. If the user asks to build from a supplied profile and authorization is already established in the conversation, do not ask again; otherwise confirm before extraction.
- Access only public pages without signing in.
- Never bypass CAPTCHAs, access controls, rate limits, or private APIs.
- Preserve source attribution URLs in data.
- Do not invent prices, reviews, awards, availability, policies, contact details, or host claims.
- Do not infer precise coordinates, neighbourhood character, professional background, or cultural themes from a city/name alone.
- Use Airbnb property URLs as booking CTAs unless the user provides an authorized direct-booking destination.
- Do not imitate Airbnb's interface or use Airbnb red as the automatic palette.
- The finished website is the owner's first-party brand. Never mention extraction, conversion, source listings, scraped data, imported content, platform handoffs, or phrases such as “the listing says/places/shows” in visitor-facing copy.

## Repository contract

Run commands from the repository root, identified by the `package.json` whose name is `airbnb-convertor`. The expected tools are:

| Capability | File or command |
| --- | --- |
| Extract host/listings/media | `npm run extract -- <url> ...` |
| Generate seed design brief | `npm run theme -- <site-config> ...` |
| Type-check | `npm run check` |
| Tests | `npm test` |
| Production build | `npm run build` |
| Extracted schema | `src/schema.ts` |
| Theme schema | `src/theme.ts` |

### Fresh-session preflight

A new session must not rely on prior conversation history. Before starting:

1. Read this entire skill.
2. Confirm the repository root is the folder containing the `airbnb-convertor` package.
3. Check `node_modules`; install only if missing or validation reports a missing dependency.
4. Keep generated output, downloaded media, credentials, and deployment
   infrastructure outside version control.

Use this output layout so each owner is immediately identifiable and media works from both `file://` and static hosting:

```text
output/<brand-slug>--<host-slug>/
  site-config.json
  design-brief.json
  images/
    host/
    properties/
  website/
    index.html
    styles.css
    app.js
```

The website sits beside `images`, so browser paths from `website/` must begin with `../images/`. Do not move or duplicate hundreds of extracted images into the three-file website directory.

### Canonical output naming

The final folder name is part of the deliverable. Use lowercase kebab-case in this exact order:

```text
output/<brand-slug>--<host-slug>/
```

For example, Raj Royale Retreats hosted by Ajay Raj belongs in:

```text
output/raj-royale-retreats--ajay-raj/
```

Derive `<host-slug>` from the normalized host display name. Derive `<brand-slug>` only from a recurring, evidence-supported portfolio or hospitality name. If no distinct brand is supported, use `stays-by-<host-slug>`. Never use opaque final names such as `sample-profile`, `website-final`, `output-1`, a timestamp, or only the numeric profile ID.

If extraction must begin before the host and brand are known, write to `output/profile-<profile-id>.importing/`, validate the package, derive the canonical name, and move the complete package to its final folder. Remove the staging folder after a successful move. If the canonical folder already belongs to the same profile, audit and reuse it unless the user explicitly requests a clean acceptance run. If it belongs to a different source profile, append the source profile ID to prevent a collision.

## Workflow

### 1. Inspect and prepare

1. Verify the repository contains `package.json`, `src/cli.ts`, and `src/theme-cli.ts`.
2. Run `npm install` only when `node_modules` is missing or a validation command reports missing packages.
3. Install Chromium with `npx playwright install chromium` only if browser launch reports a missing executable.
4. Choose the canonical `output/<brand-slug>--<host-slug>/` path using the naming rules above. Reuse an existing path only when it is clearly the same host; never overwrite unrelated output.
5. If a valid existing extraction for the same source URL already contains local media, audit and reuse it instead of hitting Airbnb again.

### 2. Extract the source package

Run:

```bash
npm run extract -- "<AIRBNB_PROFILE_URL>" \
  --acknowledge-site-terms \
  --headless \
  --output "./output/<brand-slug>--<host-slug>"
```

Then validate:

- at least one property exists
- `replicaGroups` has been reviewed before counting or presenting the portfolio
- property titles and host name are meaningful, not generic page titles
- local image paths exist and files are non-empty
- amenities do not contain navigation/calendar noise
- `extractionWarnings` are reviewed rather than ignored
- every property `sourceUrl` points to its own Airbnb room, not the host or another property
- host identity, tenure, rating labels, and Superhost claims agree across profile and listing evidence
- no `.part` files remain from interrupted downloads

Run a programmatic audit rather than relying only on a successful CLI exit. At minimum, parse `site-config.json`, verify `properties.length > 0`, and `stat` every declared `localPath`. Count local images per property and report discrepancies.

#### Consolidate replica listings

Airbnb hosts sometimes publish multiple listing records for the same physical stay. The extractor preserves every source property in `properties` for traceability, while `replicaGroups` identifies high-confidence copies:

```json
{
  "canonicalPropertyId": "most-established-listing-id",
  "replicaPropertyIds": ["copy-listing-id"],
  "confidence": 0.98,
  "evidence": ["5 shared property photos (100% overlap)"]
}
```

Treat each replica group as one stay everywhere guests can see:

- Build the theme, portfolio counts, cards, routes, structured data, navigation, and booking choices from canonical properties only.
- Exclude every `replicaPropertyId` from the website's public property collection. Never create a second card or detail route for it.
- Use the canonical listing's facts, gallery, reviews, and booking URL. The extractor selects the listing with the most reviews, then the richest media/amenity record, rating, and stable ID.
- Keep replica records and URLs in `site-config.json`; do not delete source evidence.
- Never merge listings merely because titles, city, host, capacity, or amenities are similar. Multi-unit hosts commonly have genuinely distinct apartments with those same facts.
- Automatic consolidation requires strong shared-photo evidence with corroborating content/facts. Text-identical but visually unconfirmed pairs stay visible and produce an `extractionWarnings` review candidate.
- If the host confirms an ambiguous pair is the same physical stay, record it as a replica group before building. If evidence is uncertain and no confirmation exists, preserve both rather than hiding real inventory.

In code, use `websiteProperties(config)` from `src/replicas.ts` or apply the same `replicaGroups[].replicaPropertyIds` exclusion. Do not recalculate a looser duplicate heuristic in website code.

#### Live extraction realities

Airbnb markup is not uniform:

- Host pages may render inside a dialog and may use generic document titles such as `Host profile · Airbnb`. Prefer the visible profile `h1`; strip harmless prefixes such as `About`, `Hosted by`, or `Meet your host`.
- Host URLs may use `/users/profile/<id>`, `/users/show/<id>`, or query IDs and can redirect to country domains. Preserve the accepted source URL while extracting IDs defensively.
- Tenure may appear as `2 years hosting` or `2 years of hosting`.
- A headless profile capture may omit a Superhost label even when every listing for the same host shows it. Reconcile the claim only from consistent property evidence tied to that host.
- Amenities are often leaf text under a `What this place offers` heading rather than list items. Exclude unavailable/deleted amenities.
- Broad `[aria-label]` collection captures calendars, navigation, and controls. Keep only meaningful property badges such as Guest Favourite or Superhost.
- Gallery images may come from `src`, `srcset`, `data-src`, or `data-original`. Preserve remote metadata when a download fails and record a warning instead of dropping the property.
- Never treat every `<main> img` as property media. Airbnb property pages also contain reviewer avatars, host portraits, recommendation thumbnails, platform badges, and map resources.
- For DOM-discovered Airbnb media, require the current listing ID in the `muscache.com` media identity, either as the plain listing ID or Airbnb's base64 supply-listing identifier. Reject media tied to another listing.
- Trusted JSON-LD and Open Graph property images may remain candidates. Canonicalize every accepted URL by removing query and hash components before deduplication so resized `?im_w=` variants do not become duplicate files.
- Audit remote origins after extraction. Property galleries must contain no `User/original` avatars, platform assets, map tiles, unrelated listing IDs, or duplicate resized variants.

If extracted content looks thin or noisy, fix or adapt the extractor and add a fixture test before building the site. Do not normalize bad extraction manually only in the website.

Stop and report a blocked import if Airbnb presents verification or access controls. Do not evade them.

### 3. Generate the seed design brief

Run:

```bash
npm run theme -- \
  "./output/<brand-slug>--<host-slug>/site-config.json" \
  --output "./output/<brand-slug>--<host-slug>/design-brief.json"
```

The brief is a seed, not permission to produce a generic preset. Read both JSON files before implementation.

Before accepting the brief, check:

- inferred brand name is repeated in source copy rather than guessed from one title
- all portfolio counts and representative images use canonical properties only
- audience follows capacity, amenity, and description evidence
- the winning archetype's rationale cites real content signals
- representative image paths exist
- trust metrics are mathematically correct and sourced

### 4. Add visual intelligence

Inspect 6–12 representative images spanning all properties. Do not assume image `001` is always the strongest. Select:

- one strongest portfolio-level hero
- one hero candidate per property
- material/detail images that reveal character
- destination or exterior images where available

Refine the brief based on visible evidence:

- dominant materials: timber, concrete, stone, tile, textiles, metal
- light: warm/cool, high/low contrast, airy/moody
- geometry: soft/organic versus angular/architectural
- setting: urban, coastal, heritage, mountain, rural, residential
- photographic consistency and crop quality

Adjust seed colors toward colors repeated in the actual photos. Preserve WCAG AA text contrast. Never infer cultural motifs, luxury positioning, or destination character from a name alone.

After inspection, update `design-brief.json` with the final palette, visual direction, hero criteria, and concrete photographic evidence. Keep the JSON valid against `designBriefSchema`; rerun a schema parse after editing it.

Example of evidence-led refinement:

- Seed says `urban-luxe`.
- Photos repeatedly show warm ivory tile/walls, dark walnut furniture, green plants, teal upholstery, bold artwork, and strong daylight.
- Refined direction becomes bright editorial city hospitality using ivory, bottle green, walnut, and restrained peacock blue—not an unrelated black-and-gold “luxury” template.

### 5. Define the personalized story

Make the site's visual system traceable to extracted evidence across five dimensions:

| Dimension | Evidence | Design consequence |
| --- | --- | --- |
| Place | locations, descriptions, surroundings | palette, local guide, map context |
| Property | type, materials, room imagery, amenities | layout density, card style, gallery rhythm |
| Host | bio, tenure, Superhost status, interests | voice, about section, portrait treatment |
| Guest | capacity, workspace, family features, highlights | hierarchy, comparison facts, calls to action |
| Portfolio | number and similarity of listings | homepage information architecture and filters |

Write the final rationale into `design-brief.json`. Prefer a coherent primary archetype with subtle secondary influences over mixing several themes.

#### Maintain an evidence ledger

Before writing marketing copy, mentally or explicitly map every claim to its source:

| Claim type | Allowed evidence |
| --- | --- |
| Capacity, beds, baths | matching property config |
| Rating/review count | matching property or profile evidence |
| Host status/tenure | host config or reconciled listing evidence |
| Nearby place/commute | extracted description |
| Visual/material language | inspected photos |
| Contact channel | user-provided authorization or Airbnb profile |

If no evidence exists, omit or soften the claim. For example, host interests in architecture and design support “an interest in architecture and design,” not “a professional architectural background.” A city name does not justify invented coordinates or local-guide recommendations.

### 6. Build the website

Build a static website with no framework, package dependency, bundler, or backend. Keep authored website code to three files:

```text
website/
  index.html
  styles.css
  app.js
```

Images and generated data are content assets and do not count toward this file budget. Prefer embedding the normalized public-facing property data in `app.js` so the site works when `index.html` is opened locally as well as from static hosting. Do not duplicate the full extraction payload: include only fields rendered by the site.

Do not use `fetch("site-config.json")` in the website: it fails under many `file://` contexts and exposes extraction-only fields. Embed a minimized public projection in `app.js` containing only:

- IDs, display names, descriptions, and location text used on-page
- capacity, rating, amenities, highlights, and rules actually rendered
- local image paths and useful authored alt text
- exact property `sourceUrl` and host profile URL

Do not embed extraction warnings, unused remote image URLs, internal provenance, or hundreds of images that the editorial site never presents.

Use client-side hash routing so every view works on GitHub Pages, Netlify, S3, and other static hosts without rewrite configuration:

```text
#/                    home
#/stays               all properties
#/stays/<property-id> property detail
#/contact             contact
```

Required experience:

- responsive header and navigation
- distinctive hero with real property imagery
- an all-properties route with comparison-friendly cards and optional filters only when useful
- dedicated property detail experience for every canonical stay, never for replica listing records
- gallery/lightbox or an accessible equivalent
- amenity and sleeping information
- host story and trust signals
- destination/neighbourhood section grounded in extracted text
- persistent property-specific “Book on Airbnb” CTA linking to that property's `sourceUrl`
- contact route with host portrait, useful enquiry guidance, and an Airbnb profile/contact CTA
- footer with transparent outbound booking/contact actions but no provenance narration
- keyboard focus, semantic headings, useful alt text, reduced-motion support
- metadata, Open Graph tags, and structured lodging data where supported
- no broken image paths, horizontal mobile overflow, or placeholder content

Personalize composition, not only tokens. For example, a four-property urban portfolio should emphasize comparison and consistent service; a single heritage home should emphasize narrative sequence and architectural detail.

#### Static application state requirements

Hash-route changes must:

- render the requested view and scroll to the top
- update document title, description, Open Graph data, and structured data
- update `aria-current` navigation state
- close the mobile menu
- close any open lightbox/dialog so it cannot cover the next page
- move focus to `main` without unexpectedly scrolling

The mobile menu must synchronize its visual state with `aria-expanded`. Galleries must support close, previous/next controls, Escape, and arrow keys. Property previous/next navigation should wrap or terminate intentionally rather than produce dead ends.

Do not duplicate the brand in page titles (for example `Raj Royale Retreats — Raj Royale Retreats`). Home may use only the brand; inner views may use `<view> — <brand>`.

#### Page responsibilities

**Home**

- communicate the collection's distinct promise within the first viewport
- feature a curated subset of properties rather than reproducing the entire stays page
- establish host credibility and the destination
- end with a clear choice between exploring stays and contacting the host

**All stays**

- show every canonical property exactly once
- surface differences that help selection: type, capacity, bedrooms, standout amenity, rating
- do not add filters when the portfolio is too small for them to improve selection

**Property detail**

- use a property-specific hero, story, facts, highlights, amenities, and gallery
- render every unique, verified property-owned photograph unless the user explicitly asks for editorial curation; never pad galleries with avatars, thumbnails from other listings, maps, or platform UI
- keep the “Book on Airbnb” destination tied to that exact property's `sourceUrl`
- include links to previous/next properties so browsing does not dead-end

**Contact**

- explain what information a guest should include: property, dates, guest count, and questions
- default to “Message the host on Airbnb” linking to the profile source URL
- only show phone, email, WhatsApp, or a working form when the user explicitly supplies and authorizes it
- never create a form that appears to submit but has no delivery endpoint

#### Relevant optional content

Keep optional content as homepage sections instead of creating more pages unless the source material is substantial:

- host story
- neighbourhood/location context
- portfolio-wide amenities or service promise
- concise FAQ derived from actual house rules and policies
- “Which stay suits you?” comparison for portfolios with meaningfully different properties

Do not create empty About, Journal, Experiences, FAQ, or Local Guide pages merely to make the navigation look larger.

### 7. Content rules

- Rewrite extracted copy for clarity and web scanning while preserving meaning.
- Keep property-specific facts attached to the correct property.
- Treat missing information as missing; do not fill it with plausible fiction.
- Avoid phrases such as “unforgettable luxury” unless supported by source content.
- Prefer concrete proof: “2 bedrooms, workspace, 4.97 rating” over generic claims.
- Keep source URLs available for traceability, but do not surface extraction jargon to visitors.
- Write entirely in the owner's first-party voice. Say “Stay in RT Nagar, close to…” rather than “The listing places this stay in RT Nagar…”; say “Check availability and reserve” rather than explaining that pricing or booking is handled by another platform.
- Platform names may appear only where functionally necessary and transparent, such as the final button label “Book on Airbnb.” Do not add surrounding copy that narrates redirection, provenance, or the conversion process.
- Author useful image alt text from the visible room/scene; extracted Airbnb alt text may be empty.
- Never show a portfolio average without calculating it from current property ratings. Distinguish a host-profile rating from a computed property average.
- If a location statement is only “Bengaluru, India,” do not manufacture a street, coordinates, commute time, or neighbourhood description.

### 8. Verify

Run repository-native tests, type checks, and builds. Start the site and use browser tools to inspect:

- desktop around 1440px
- mobile around 390px
- home, all stays, contact, and every property route
- navigation, galleries, CTAs, focus states, and missing media
- direct local-file loading and static HTTP serving

Compare screenshots against `design-brief.json`. Fix generic-looking sections, awkward crops, low contrast, overflow, and repeated content before completing.

#### Exact QA sequence

1. Run `node --check output/<slug>/website/app.js`.
2. Assert `website/` contains exactly `index.html`, `styles.css`, and `app.js`.
3. Verify every referenced local image exists and is non-empty.
   Also assert each gallery's count matches that property's canonical media count and every path belongs to that same property.
   Assert no `replicaPropertyId` appears in cards, routes, structured data, page headings, or booking CTAs.
4. Run `npm run check && npm test && npm run build`.
5. Validate the final `design-brief.json` with the production `designBriefSchema`.
6. Start a static server from `output/<slug>` so `website/` and sibling `images/` share one root. Verify the HTML and a representative image with HTTP requests.
7. Set browser viewports explicitly to `1440×1000` and `390×844`; do not infer CSS width from screenshot pixel dimensions or device scale.
8. Visit home, all stays, contact, and every canonical property hash route. Record the primary heading, horizontal overflow state, and number of Airbnb links.
   Scan rendered visitor text for forbidden provenance phrases including “the listing,” “extracted,” “converted,” “source data,” “redirected,” “provided through Airbnb,” and “booking journey.”
9. Open a gallery, navigate to another hash route, and assert the dialog closes.
10. On mobile, open the menu, follow a link, and assert `aria-expanded` becomes `false`.
11. Scroll property pages before checking `naturalWidth`: offscreen lazy images can report width `0` before they load and are not necessarily broken.
12. Confirm each “Book on Airbnb” URL contains that page's exact property ID.
13. Open `index.html#/stays` directly with `file://` and verify styles, data, images, and routing.

Keep the local preview server running when the user is expected to review it; use a detached process and report the preview URL.

A dependency-free local preview command is:

```bash
python3 -m http.server 4173 --directory "output/<slug>"
```

Then verify both roots before opening the browser:

```bash
curl --fail http://127.0.0.1:4173/website/ >/dev/null
curl --fail http://127.0.0.1:4173/images/host/profile.jpg >/dev/null
```

If port `4173` is occupied, choose another explicit port and use the same port for all browser checks. Never start a second server blindly when a verified preview server for the same output is already running.

### 9. Hand off for operator-managed hosting

Local completion and public publication are separate states. Finish every
extraction, content, visual, browser, and direct-file check, keep the local
preview running, and give the user its URL.

Do not upload, publish, or promote websites from this repository. Remote
deployment credentials, SSH receivers, service definitions, and upload scripts
are intentionally excluded. After the operator approves the exact build, hand
off the canonical output folder to their separately managed hosting workflow.

The optional Flask application in `hosting/` can serve approved packages and
inject a preview watermark, but configuring and deploying that service is
outside this skill.

#### Protection limitations

A browser must download HTML, CSS, JavaScript, and images to render an interactive preview. No implementation can make those delivered assets impossible to inspect or reproduce. Right-click blockers, source obfuscation, and disabled developer tools are not security controls and must not be added.

The sales-preview controls reduce casual copying and search discovery through watermarking, non-indexing, cache prevention, and referrer protection. The clean URL is deliberately public to anyone who knows or guesses it. For prospects who must not receive runnable frontend assets at all, provide screenshots or a recorded walkthrough instead of an interactive preview.

Never tell the operator that the preview tag prevents source download. State accurately that it is a deterrent and access control, while screenshots/video are the source-protecting preview format.

## Personalization quality bar

A result is not personalized if another host's photos and name could be substituted without changing the layout or story. At least three structural or art-direction choices must be tied to this host's evidence and documented in the brief.

Good:

- urban multi-property portfolio → comparison-led collection, commute/workspace facts, polished editorial grid
- heritage residence → story-led scroll, material details, restrained historic palette
- family coastal homes → capacity-first cards, open gallery rhythm, practical beach/family information

Bad:

- same beige template for every host
- deriving the palette from one arbitrary image
- adding local recommendations that were not extracted or researched
- hiding all properties behind identical cards

## Known failure modes and recovery

| Symptom | Likely cause | Required response |
| --- | --- | --- |
| Host name is `Host profile` or `About Name` | document title/dialog markup won | prefer visible `h1`, strip known prefixes, add fixture |
| Amenities are empty | section uses nested generic leaf nodes | parse section leaf text and filter unavailable values |
| Hundreds of labels | broad accessibility-label scrape | restrict labels to property badges |
| Gallery contains avatars, map tiles, badges, recommendations, or duplicates | all `<main> img` elements were accepted or resizing parameters were deduplicated too late | require current-listing media identity, accept trusted metadata candidates, canonicalize before deduplication, and add a contamination fixture |
| Same physical stay appears more than once | source listing records were rendered directly without applying `replicaGroups` | build all public surfaces from `websiteProperties(config)`; retain replica records only for traceability |
| Distinct units were incorrectly merged | title/location/capacity similarity was treated as proof | require strong shared-photo evidence and preserve ambiguous pairs for host review |
| Prospect copied browser-delivered assets | interactive frontend was treated as DRM-protected | use watermarking as deterrence; use screenshots/video when runnable assets cannot be disclosed |
| One image failure aborts import | fail-fast batch download | retain remote image metadata and append an extraction warning |
| Rerun removes good media | direct overwrite/cleanup | write to `.part`, then atomically rename |
| Gallery remains over a new route | route renderer did not reset UI state | close open dialogs during route render |
| Mobile images appear broken in automation | lazy images were never scrolled into view | scroll, wait, then inspect `complete`/`naturalWidth` |
| Static hosting route returns 404 | history routing requires rewrites | use hash routes |
| Local file shows no data | runtime fetch blocked by file origin | embed minimized public data in `app.js` |
| Website feels interchangeable | only colors/name changed | tie at least three composition or art-direction choices to evidence |
| Copy says “the listing,” “extracted,” or explains a redirect | internal provenance leaked into the guest experience | rewrite in the owner's direct first-party hospitality voice; retain platform wording only on necessary outbound CTA labels |

## Completion report

State:

- host, raw listing count, canonical stay count, and any replica groups or review candidates
- selected archetype and the strongest evidence behind it
- the three or more meaningful personalization decisions
- routes/pages created
- confirmation that authored website code is limited to `index.html`, `styles.css`, and `app.js`
- validation commands and visual breakpoints checked
- extraction warnings, missing data, and any claims requiring host confirmation
- local preview URL and direct file path
- canonical output folder in the form `output/<brand-slug>--<host-slug>/`
- confirmation that each booking CTA was checked against its property ID
- publication status: local preview ready for operator-managed hosting
