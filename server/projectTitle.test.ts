import { describe, expect, it } from "vitest";

describe("managed application title", () => {
  it("uses the SUNO title configured for the deployed project", () => {
    expect(process.env.VITE_APP_TITLE).toBe("SUNO — Voice Evidence Console");
  });
});
