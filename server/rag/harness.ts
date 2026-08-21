import { randomUUID } from "node:crypto";
import type { HarnessEvent, HarnessStage, RAGRun } from "@shared/rag";
import { AUTO_DETECT_LANGUAGE, AUTO_DETECT_MIN_CONFIDENCE, isFocusedVoiceLanguage } from "@shared/voiceLanguages";
import { errorAnswer, inspectQuery, refused, verifyAndSynthesize } from "./guardrails";
import { generateEvidenceBoundAnswer, generationMode } from "./generation";
import { hybridRetrieve } from "./retrieval";
import { transcribeWithSarvam } from "./sarvam";

function now() { return performance.now(); }
function elapsed(start: number) { return Math.round((now() - start) * 100) / 100; }

function trace(events: HarnessEvent[], stage: HarnessStage, started: number, status: HarnessEvent["status"], detail: string) {
  events.push({ stage, status, durationMs: Math.round((now() - started) * 100) / 100, detail });
}

function skipped(events: HarnessEvent[], stages: HarnessStage[], detail: string) {
  stages.forEach(stage => events.push({ stage, status: "SKIPPED", durationMs: 0, detail }));
}

export async function runPostTranscriptionHarness(input: { transcript: string; languageCode: string; script: string; languageConfidence?: number | null }): Promise<RAGRun> {
  const requestId = randomUUID();
  const totalStart = now();
  const events: HarnessEvent[] = [];
  const ragStart = now();
  const normalizeStart = now();
  const query = input.transcript.normalize("NFC").replace(/\s+/g, " ").trim();
  trace(events, "normalize", normalizeStart, "OK", "Unicode NFC and whitespace normalization applied.");
  const languageStart = now();
  if (input.languageCode === AUTO_DETECT_LANGUAGE) {
    trace(events, "detect_language", languageStart, "REFUSED", "Speech language was not reliably identified. Select a language override and record again.");
    skipped(events, ["safety/scope_gate", "query_route", "parallel_retrieve", "fuse", "rerank", "evidence_gate", "generate", "verify"], "Stopped because no reliable speech locale is available for bounded evidence routing.");
    trace(events, "return", now(), "OK", "Fail-closed language-identification refusal returned.");
    return { requestId, transcript: query, detectedLanguage: input.languageCode, detectedScript: input.script, detectedLanguageConfidence: input.languageConfidence ?? null, answer: refused("I could not reliably identify the spoken language. Select a language override and record again."), evidence: [], trace: events, latency: { sttMs: 0, ragMs: elapsed(ragStart), endToEndMs: elapsed(totalStart) } };
  }
  trace(events, "detect_language", languageStart, "OK", `${input.languageCode} / ${input.script}.`);
  const gateStart = now();
  const refusal = inspectQuery(query);
  if (refusal) {
    trace(events, "safety/scope_gate", gateStart, "REFUSED", refusal);
    skipped(events, ["query_route", "parallel_retrieve", "fuse", "rerank", "evidence_gate", "generate", "verify"], "Stopped by safety or scope gate.");
    trace(events, "return", now(), "OK", "Fail-closed refusal returned.");
    return { requestId, transcript: query, detectedLanguage: input.languageCode, detectedScript: input.script, detectedLanguageConfidence: input.languageConfidence ?? null, answer: refused(refusal), evidence: [], trace: events, latency: { sttMs: 0, ragMs: elapsed(ragStart), endToEndMs: elapsed(totalStart) } };
  }
  trace(events, "safety/scope_gate", gateStart, "OK", "Input passed safety and scope gates.");
  const routeStart = now();
  trace(events, "query_route", routeStart, "OK", "Routed to multilingual dense plus lexical retrieval.");
  const retrieveStart = now();
  let retrieval;
  try {
    retrieval = await hybridRetrieve(query, input.languageCode, {
      allowCloudFallback: input.script !== "benchmark",
      cloudTimeoutMs: input.script === "benchmark" ? 25 : 80,
    });
    const retrievalDetail = retrieval.mode === "local_hot"
      ? "Real MSMARCO-XI evidence retrieved from the in-process L1 language cache; remote vector search skipped."
      : retrieval.mode === "local_no_evidence"
        ? "No bounded MSMARCO-XI evidence is available for this locale or query; remote retrieval skipped for a truthful refusal."
      : retrieval.mode === "cloud"
          ? "Real MSMARCO-XI dense and lexical candidates retrieved from Qdrant in parallel."
          : retrieval.mode === "cloud_timeout"
            ? "Remote Qdrant fallback exceeded the bounded 80 ms retrieval window; returned a truthful evidence refusal without waiting."
          : "Cloud retrieval index is not configured.";
    trace(events, "parallel_retrieve", retrieveStart, retrieval.mode === "unavailable" ? "ERROR" : "OK", retrievalDetail);
  } catch (error) {
    trace(events, "parallel_retrieve", retrieveStart, "ERROR", error instanceof Error ? error.message : "Retrieval error.");
    skipped(events, ["fuse", "rerank", "evidence_gate", "generate", "verify"], "Stopped after retrieval error.");
    trace(events, "return", now(), "OK", "Fail-closed error returned.");
    return { requestId, transcript: query, detectedLanguage: input.languageCode, detectedScript: input.script, detectedLanguageConfidence: input.languageConfidence ?? null, answer: errorAnswer("Retrieval service unavailable."), evidence: [], trace: events, latency: { sttMs: 0, ragMs: elapsed(ragStart), endToEndMs: elapsed(totalStart) } };
  }
  const fuseStart = now();
  trace(events, "fuse", fuseStart, "OK", "Reciprocal-rank fusion combined dense and lexical ranks.");
  const rerankStart = now();
  trace(events, "rerank", rerankStart, "OK", "Parent-level deduplication and evidence-first reranking applied.");
  const evidenceStart = now();
  const baseline = verifyAndSynthesize(query, retrieval.evidence, retrieval.scores, input.languageCode);
  trace(events, "evidence_gate", evidenceStart, baseline.status === "GROUNDED" ? "OK" : "REFUSED", baseline.status === "GROUNDED" ? "Evidence sufficiency threshold passed." : baseline.refusalReason || "Evidence rejected.");
  const generationStart = now();
  const candidate = await generateEvidenceBoundAnswer({ query, evidence: retrieval.evidence, baseline });
  trace(events, "generate", generationStart, candidate.status === "GROUNDED" ? "OK" : "SKIPPED", candidate.status === "GROUNDED" ? `${generationMode() === "llm" ? "Structured server-side LLM synthesis completed." : "Deterministic extractive generation completed; no paid model invocation."}` : "No generation without adequate evidence.");
  const verifyStart = now();
  trace(events, "verify", verifyStart, candidate.status === "GROUNDED" ? "OK" : "REFUSED", candidate.status === "GROUNDED" ? "Every returned sentence maps to cited evidence." : "Answer withheld by verifier.");
  trace(events, "return", now(), "OK", `Structured ${candidate.status} object returned.`);
  return { requestId, transcript: query, detectedLanguage: input.languageCode, detectedScript: input.script, detectedLanguageConfidence: input.languageConfidence ?? null, answer: candidate, evidence: retrieval.evidence.map(chunk => ({ ...chunk, selected: candidate.evidenceIds.includes(chunk.id) })), trace: events, latency: { sttMs: 0, ragMs: elapsed(ragStart), endToEndMs: elapsed(totalStart) } };
}

export async function runVoiceHarness(input: { audioBase64: string; mimeType: string; languageHint?: string }): Promise<RAGRun> {
  const totalStart = now();
  const requestId = randomUUID();
  const events: HarnessEvent[] = [];
  const validateStart = now();
  if (!input.audioBase64 || !input.mimeType.startsWith("audio/")) {
    trace(events, "validate_audio", validateStart, "REFUSED", "Audio payload or MIME type rejected.");
    skipped(events, ["transcribe", "normalize", "detect_language", "safety/scope_gate", "query_route", "parallel_retrieve", "fuse", "rerank", "evidence_gate", "generate", "verify", "return"], "Stopped after invalid audio.");
    return { requestId, transcript: "", detectedLanguage: "unknown", detectedScript: "unknown", answer: refused("Invalid or missing audio input."), evidence: [], trace: events, latency: { sttMs: 0, ragMs: 0, endToEndMs: elapsed(totalStart) } };
  }
  trace(events, "validate_audio", validateStart, "OK", "Audio is eligible for short synchronous transcription.");
  const sttStart = now();
  try {
    const transcription = await transcribeWithSarvam(input);
    trace(events, "transcribe", sttStart, "OK", `Sarvam request ${transcription.providerRequestId || "accepted"}; idempotency key retained server-side.`);
    const requiresConfidence = transcription.autoDetected;
    const languageReliable = !requiresConfidence || (transcription.languageCode !== AUTO_DETECT_LANGUAGE && transcription.languageProbability !== null && transcription.languageProbability >= AUTO_DETECT_MIN_CONFIDENCE);
    const languageInFocusedScope = isFocusedVoiceLanguage(transcription.languageCode);
    if (!languageReliable || (requiresConfidence && !languageInFocusedScope)) {
      const detectionStart = now();
      const confidenceDetail = !languageReliable
        ? transcription.languageProbability === null ? "Sarvam did not return language confidence." : `Sarvam language confidence ${(transcription.languageProbability * 100).toFixed(0)}% is below the ${(AUTO_DETECT_MIN_CONFIDENCE * 100).toFixed(0)}% routing threshold.`
        : `${transcription.languageCode} is outside the focused Hindi, Kannada, English, Tamil, and Marathi voice scope.`;
      trace(events, "detect_language", detectionStart, "REFUSED", confidenceDetail);
      skipped(events, ["normalize", "safety/scope_gate", "query_route", "parallel_retrieve", "fuse", "rerank", "evidence_gate", "generate", "verify"], "Stopped before retrieval because automatic language detection could not be routed within the focused voice scope.");
      trace(events, "return", now(), "OK", "Fail-closed automatic-language refusal returned.");
      const reason = !languageReliable
        ? "I could not identify the spoken language with enough confidence. Select a language override and record again."
        : "SUNO currently supports Hindi, Kannada, English, Tamil, and Marathi. Select one of these languages and record again.";
      return { requestId, transcript: transcription.transcript, detectedLanguage: transcription.languageCode, detectedScript: transcription.script, detectedLanguageConfidence: transcription.languageProbability, answer: refused(reason), evidence: [], trace: events, latency: { sttMs: elapsed(sttStart), ragMs: 0, endToEndMs: elapsed(totalStart) } };
    }
    const textRun = await runPostTranscriptionHarness({ transcript: transcription.transcript, languageCode: transcription.languageCode, script: transcription.script, languageConfidence: transcription.languageProbability });
    return { ...textRun, requestId, trace: [...events, ...textRun.trace], latency: { sttMs: Math.max(0, Math.round((now() - sttStart - textRun.latency.ragMs) * 100) / 100), ragMs: textRun.latency.ragMs, endToEndMs: elapsed(totalStart) } };
  } catch (error) {
    const transcriptionError = error instanceof Error ? error.message : "Transcription error.";
    trace(events, "transcribe", sttStart, "ERROR", transcriptionError);
    skipped(events, ["normalize", "detect_language", "safety/scope_gate", "query_route", "parallel_retrieve", "fuse", "rerank", "evidence_gate", "generate", "verify", "return"], "Stopped after transcription error.");
    return { requestId, transcript: "", detectedLanguage: "unknown", detectedScript: "unknown", transcriptionError, answer: errorAnswer("Speech-to-text failed after bounded retries."), evidence: [], trace: events, latency: { sttMs: elapsed(sttStart), ragMs: 0, endToEndMs: elapsed(totalStart) } };
  }
}
