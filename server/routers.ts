import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { EVALUATION_MANIFEST } from "@shared/evaluationManifest";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { recordRagRun } from "./db";
import { runBenchmark } from "./rag/benchmark";
import { runPostTranscriptionHarness, runVoiceHarness } from "./rag/harness";
import { getIndexCapability } from "./rag/retrieval";

const voiceInput = z.object({
  audioBase64: z.string().min(16).max(5_600_000),
  mimeType: z.string().regex(/^audio\//),
  languageHint: z.string().max(16).optional(),
});

const browserTranscriptInput = z.object({
  transcript: z.string().trim().min(1).max(2_000),
  languageCode: z.string().max(16).default("unknown"),
  script: z.string().max(32).default("browser-native"),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  voiceRag: router({
    ask: publicProcedure.input(voiceInput).mutation(async ({ input }) => {
      const run = await runVoiceHarness(input);
      await recordRagRun(run).catch(() => undefined);
      return run;
    }),
    askBrowserTranscript: publicProcedure.input(browserTranscriptInput).mutation(async ({ input }) => {
      const run = await runPostTranscriptionHarness(input);
      await recordRagRun(run).catch(() => undefined);
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
  }),
});

export type AppRouter = typeof appRouter;
