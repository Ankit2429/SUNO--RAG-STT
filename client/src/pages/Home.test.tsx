/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RAGRun } from "@shared/rag";

const mutationSpies = vi.hoisted(() => ({
  ask: vi.fn(),
  askBrowserTranscript: vi.fn(),
  benchmark: vi.fn(),
  askOptions: undefined as { onSuccess?: (run: RAGRun) => void } | undefined,
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
      ask: { useMutation: (options: { onSuccess?: (run: RAGRun) => void }) => { mutationSpies.askOptions = options; return { mutate: mutationSpies.ask, isPending: false }; } },
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
    mutationSpies.askOptions = undefined;
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

  it("offers a one-click Marathi override after low-confidence automatic detection", async () => {
    const user = userEvent.setup();
    render(<Home />);

    mutationSpies.askOptions?.onSuccess?.({
      requestId: "mr-low-confidence",
      transcript: "प्रामाणिकपणा किंवा सचोटीची व्याख्या काय आहे?",
      detectedLanguage: "mr-IN",
      detectedScript: "Devanagari",
      detectedLanguageConfidence: 0.61,
      answer: { status: "REFUSED", answer: "No evidence was evaluated.", evidenceIds: [], confidenceBand: "NONE", refusalReason: "Automatic language detection confidence (61%) was below the 80% threshold." },
      evidence: [],
      trace: [{ stage: "detect_language", status: "REFUSED", durationMs: 0, detail: "Below threshold." }],
      latency: { sttMs: 0, ragMs: 0, endToEndMs: 0 },
    });

    const retry = await screen.findByRole("button", { name: "SELECT MARATHI & RETRY" });
    await user.click(retry);
    expect(await screen.findByText(/Marathi selected\. Record the same question again for explicit routing\./)).toBeTruthy();
  });
});
