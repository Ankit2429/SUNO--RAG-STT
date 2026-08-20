/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BenchmarkReport, RAGRun } from "@shared/rag";

const mutationSpies = vi.hoisted(() => ({
  ask: vi.fn(),
  askBrowserTranscript: vi.fn(),
  benchmark: vi.fn(),
  askOptions: undefined as { onSuccess?: (run: RAGRun) => void } | undefined,
  benchmarkOptions: undefined as { onSuccess?: (report: BenchmarkReport) => void } | undefined,
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
      benchmark: { useMutation: (options: { onSuccess?: (report: BenchmarkReport) => void }) => { mutationSpies.benchmarkOptions = options; return { mutate: mutationSpies.benchmark, isPending: false }; } },
    },
  },
}));

import Home from "./Home";

describe("Home typed-question submission", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mutationSpies.ask.mockReset();
    mutationSpies.askBrowserTranscript.mockReset();
    mutationSpies.benchmark.mockReset();
    mutationSpies.askOptions = undefined;
    mutationSpies.benchmarkOptions = undefined;
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

  it("shows the focused voice scope and the manifest-backed index version", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: /SUNO, ask by voice and answer by evidence/i })).toBeTruthy();
    expect(screen.getByText(/FIVE GROUNDED ROUTES/)).toBeTruthy();
    expect(screen.getByRole("option", { name: /Hindi/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Kannada/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /English/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Tamil/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Marathi/ })).toBeTruthy();
    expect(screen.getByText(/INDEX VERSION: test-index/)).toBeTruthy();
  });

  it("keeps the primary voice action and typed evidence route in a shared responsive control rail", () => {
    render(<Home />);

    const controlRail = screen.getByTestId("voice-text-actions");
    expect(controlRail.className).toContain("sm:flex-row");
    expect(screen.getByRole("button", { name: "START RECORDING" })).toBeTruthy();
    expect(screen.getByLabelText("Type a question for the evidence harness")).toBeTruthy();
  });

  it("connects typed submission to a focused in-flow answer reveal panel", () => {
    render(<Home />);

    const revealPanel = screen.getByTestId("answer-reveal-panel");
    expect(revealPanel.getAttribute("id")).toBe("answer-output");
    expect(revealPanel.getAttribute("data-state")).toBe("idle");
    expect(screen.getByRole("button", { name: "CHECK TEXT" }).getAttribute("aria-controls")).toBe("answer-output");
    expect(screen.getByText("02 / ANSWER REVEAL")).toBeTruthy();
  });

  it("renders the complete warm latency percentile set after an audit", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: "RUN 115-CASE AUDIT" }));
    mutationSpies.benchmarkOptions?.onSuccess?.({
      queryCount: 115,
      cold: { p50: 0.3, p70: 0.4, p90: 0.5, p95: 0.6, p100: 0.7, sampleCount: 115, failureCount: 0 },
      warm: { p50: 0.1, p70: 0.2, p90: 0.3, p95: 0.4, p100: 0.5, sampleCount: 115, failureCount: 0 },
      coldStageTimings: [],
      warmStageTimings: [],
      postTranscriptionTargetMs: 200,
      evaluatedAt: "2026-08-18T00:00:00.000Z",
    });

    expect(await screen.findByText("P90 / warm")).toBeTruthy();
    expect(screen.getByText("P95 / warm")).toBeTruthy();
    expect(screen.getByText("0.3 ms")).toBeTruthy();
    expect(screen.getByText("0.4 ms")).toBeTruthy();
  });
});
