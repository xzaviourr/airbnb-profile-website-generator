import { describe, expect, it } from "vitest";
import { hostIdFromUrl, parseAirbnbUrl, roomIdFromUrl } from "./url.js";

describe("Airbnb URL validation", () => {
  it("accepts supported HTTPS URLs and extracts identifiers", () => {
    expect(roomIdFromUrl("https://www.airbnb.com/rooms/12345?foo=bar")).toBe("12345");
    expect(hostIdFromUrl("https://www.airbnb.com/users/show/42")).toBe("42");
    expect(hostIdFromUrl("https://airbnb.co.in/users/show?id=84")).toBe("84");
    expect(hostIdFromUrl("https://www.airbnb.co.in/users/profile/1470649075329150535"))
      .toBe("1470649075329150535");
    expect(roomIdFromUrl("https://www.airbnb.fr/rooms/67890")).toBe("67890");
  });

  it.each([
    "http://www.airbnb.com/users/show/42",
    "https://airbnb.example/users/show/42",
    "https://user:password@www.airbnb.com/users/show/42",
    "not-a-url",
  ])("rejects unsafe input: %s", (value) => {
    expect(() => parseAirbnbUrl(value)).toThrow();
  });
});
