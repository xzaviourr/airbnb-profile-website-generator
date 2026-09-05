const AIRBNB_HOSTS = new Set([
  "airbnb.com",
  "www.airbnb.com",
  "airbnb.co.in",
  "www.airbnb.co.in",
]);

export function parseAirbnbUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid URL: ${value}`);
  }

  if (url.protocol !== "https:") {
    throw new Error("Airbnb URLs must use HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not allowed");
  }
  if (!AIRBNB_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`Unsupported Airbnb hostname: ${url.hostname}`);
  }

  url.hash = "";
  return url;
}

export function roomIdFromUrl(value: string): string | undefined {
  try {
    return new URL(value).pathname.match(/^\/rooms\/(\d+)/)?.[1];
  } catch {
    return undefined;
  }
}

export function hostIdFromUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.searchParams.get("id") ?? url.pathname.match(/^\/users\/(?:show|profile)\/(\d+)/)?.[1];
  } catch {
    return undefined;
  }
}
