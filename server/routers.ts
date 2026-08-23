import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { EVALUATION_MANIFEST } from "@shared/evaluationManifest";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { recordRagRun } from "./db";
import { runBenchmark, runFiveLanguageBenchmark } from "./rag/benchmark";
import { runPostTranscriptionHarness, runVoiceHarness } from "./rag/harness";
import { getIndexCapability } from "./rag/retrieval";
import { typedResponseCache } from "./rag/responseCache";
import { AUTO_DETECT_LANGUAGE, FOCUSED_VOICE_LANGUAGE_CODES } from "@shared/voiceLanguages";
import type { DeliveryTrace, RAGRun } from "@shared/rag";
import { randomUUID } from "node:crypto";

const focusedLanguageHint = z.enum(FOCUSED_VOICE_LANGUAGE_CODES);
const voiceLanguageHint = z.union([focusedLanguageHint, z.literal(AUTO_DETECT_LANGUAGE)]);

const voiceInput = z.object({
  audioBase64: z.string().min(16).max(5_600_000),
  mimeType: z.string().regex(/^audio\//),
  languageHint: voiceLanguageHint.default(AUTO_DETECT_LANGUAGE),
});

const browserTranscriptInput = z.object({
  transcript: z.string().trim().min(1).max(2_000),
  languageCode: voiceLanguageHint.default(AUTO_DETECT_LANGUAGE),
  script: z.string().max(32).default("browser-native"),
});

function elapsed(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

function withDelivery(run: RAGRun, serverMs: number, cache: DeliveryTrace["cache"], cacheAgeMs?: number): RAGRun {
  return { ...run, delivery: { serverMs, cache, ...(cacheAgeMs === undefined ? {} : { cacheAgeMs }) } };
}

function setTimingHeader(res: { setHeader(name: string, value: string): unknown }, run: RAGRun) {
  const delivery = run.delivery;
  if (!delivery) return;
  res.setHeader("Server-Timing", `suno;dur=${delivery.serverMs.toFixed(2)}, rag;dur=${run.latency.ragMs.toFixed(2)}, cache;desc=\"${delivery.cache.toLowerCase()}\"`);
}

function persistAfterResponse(run: RAGRun) {
  void recordRagRun(run).catch(() => undefined);
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => (ctx.getUser ? ctx.getUser() : ctx.user)),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  voiceRag: router({
    // A deliberately trivial same-origin request used only after the page is idle.
    // It primes the API route without invoking retrieval, providers, or telemetry.
    warmup: publicProcedure.query(() => ({ ready: true as const })),
    ask: publicProcedure.input(voiceInput).mutation(async ({ input, ctx }) => {
      const startedAt = performance.now();
      const run = withDelivery(await runVoiceHarness(input), elapsed(startedAt), "BYPASS");
      setTimingHeader(ctx.res, run);
      persistAfterResponse(run);
      return run;
    }),
    askBrowserTranscript: publicProcedure.input(browserTranscriptInput).mutation(async ({ input, ctx }) => {
      const startedAt = performance.now();
      const hit = typedResponseCache.get(input.transcript, input.languageCode);
      const run = hit
        ? withDelivery({ ...hit.run, requestId: randomUUID(), latency: { ...hit.run.latency, ragMs: elapsed(startedAt) } }, elapsed(startedAt), "HIT", hit.ageMs)
        : withDelivery(await runPostTranscriptionHarness(input), elapsed(startedAt), "MISS");

      if (!hit && run.answer.status === "GROUNDED") {
        typedResponseCache.set(input.transcript, input.languageCode, run);
      }
      setTimingHeader(ctx.res, run);
      persistAfterResponse(run);
      return run;
    }),
    indexStatus: publicProcedure.query(async () => ({
      ...(await getIndexCapability()),
      dataset: "ai4bharat/MSMARCO-XI",
      indexVersion: EVALUATION_MANIFEST.indexVersion,
      manifest: EVALUATION_MANIFEST,
      chunkFamilies: ["semantic_sentence_window", "paragraph_section", "answer_centered_window", "fixed_window_fallback", "query_linked_evaluation"],
      costMode: "No-cost evaluation profile; external provider secrets remain server-side.",
    })),
    benchmark: publicProcedure.mutation(async () => runBenchmark()),
    benchmarkFiveLanguages: publicProcedure
      .input(z.object({ queriesPerLanguage: z.number().int().min(5).max(1_000).default(200) }).default({ queriesPerLanguage: 200 }))
      .mutation(async ({ input }) => runFiveLanguageBenchmark({ queriesPerLanguage: input.queriesPerLanguage })),
  }),
});

export type AppRouter = typeof appRouter;
