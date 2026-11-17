import { describe, expect, it } from "vitest";
import { originAllowed } from "./origin";

const ALLOWED = "https://www.janicodes.dev, https://janicodes.dev,https://janicodes-*-team.vercel.app";

describe("which pages may use the game server", () => {
  it("allows a listed site", () => {
    expect(originAllowed("https://www.janicodes.dev", ALLOWED)).toBe(true);
    expect(originAllowed("https://janicodes.dev", ALLOWED)).toBe(true);
  });

  it("refuses a site that is not listed", () => {
    expect(originAllowed("https://example.com", ALLOWED)).toBe(false);
  });

  it("refuses a request that names no site", () => {
    expect(originAllowed(null, ALLOWED)).toBe(false);
    expect(originAllowed("", ALLOWED)).toBe(false);
  });

  it("refuses a site whose name only contains a listed name", () => {
    expect(originAllowed("https://www.janicodes.dev.evil.com", ALLOWED)).toBe(false);
    expect(originAllowed("https://evil-www.janicodes.dev", ALLOWED)).toBe(false);
    expect(originAllowed("http://www.janicodes.dev", ALLOWED)).toBe(false);
  });

  it("lets a star stand for one part of a name", () => {
    expect(originAllowed("https://janicodes-abc123-team.vercel.app", ALLOWED)).toBe(true);
    expect(originAllowed("https://janicodes-dev-git-my-branch-team.vercel.app", ALLOWED)).toBe(true);
  });

  it("does not let a star cross a dot", () => {
    expect(originAllowed("https://janicodes-x.evil.com-team.vercel.app", ALLOWED)).toBe(false);
  });

  it("always allows a page on the developer's own computer", () => {
    expect(originAllowed("http://127.0.0.1:3417", "")).toBe(true);
    expect(originAllowed("http://localhost:3000", "")).toBe(true);
    expect(originAllowed("http://localhost.evil.com", "")).toBe(false);
  });

  it("allows nothing else when the list is empty", () => {
    expect(originAllowed("https://www.janicodes.dev", "")).toBe(false);
  });
});
