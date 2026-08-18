/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutationSpies = vi.hoisted(() => ({
  ask: vi.fn(),
  askBrowserTranscript: vi.fn(),
  benchmark: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    voiceRag: {
      indexStatus: {
        useQuery: () => ({
          data: {
            manifest: {
              languages: ["hi", "kn", "ta", "mr"],
              rowCounts: { hi: 1, kn: 1, ta: 1, mr: 1 },
              datasetRevision: "test-revision",
              indexVersion: "test-index",
              buildTimestamp: "2026-08-18T00:00:00.000Z",
            },
            health: "READY",
            points: 4,
            collection: "test-collection",
            mode: "L1_LOCAL",
          },
        }),
      },
      ask: { useMutation: () => ({ mutate: mutationSpies.ask, isPending: false }) },
      askBrowserTranscript: { useMutation: () => ({ mutate: mutationSpies.askBrowserTranscript, isPending: false }) },
      benchmark: { useMutation: () => ({ mutate: mutationSpies.benchmark, isPending: false }) },
    },
  },
}));

import Home from "./Home";

describe("Home typed-question submission", () => {
  beforeEach(() => {
    mutationSpies.ask.mockReset();
    mutationSpies.askBrowserTranscript.mockReset();
    mutationSpies.benchmark.mockReset();
  });

  it("submits automatic Hindi typed input to the actual browser-transcript mutation without client-only fields", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(screen.getByLabelText("Type a question for the evidence harness"), "निगम किस कानून द्वारा शासित होता है?");
    await user.click(screen.getByRole("button", { name: "CHECK TEXT" }));

    expect(mutationSpies.askBrowserTranscript).toHaveBeenCalledTimes(1);
    expect(mutationSpies.askBrowserTranscript).toHaveBeenCalledWith({
      transcript: "निगम किस कानून द्वारा शासित होता है?",
      languageCode: "hi-IN",
      script: "typed-input",
    });
    expect(Object.keys(mutationSpies.askBrowserTranscript.mock.calls[0][0]).sort()).toEqual(["languageCode", "script", "transcript"]);
  });
});
