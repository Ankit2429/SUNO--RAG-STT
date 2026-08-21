import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const projectConfig = JSON.parse(
  readFileSync(new URL("../.project-config.json", import.meta.url), "utf8"),
) as { name: string };

const packageManifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string };

describe("managed application title", () => {
  it("uses the SUNO title configured for the deployed project", () => {
    expect(process.env.VITE_APP_TITLE).toBe("SUNO — Voice Evidence Console");
  });

  it("uses SUNO for the managed project and package identities", () => {
    expect(projectConfig.name).toBe("SUNO");
    expect(packageManifest.name).toBe("suno");
  });
});
