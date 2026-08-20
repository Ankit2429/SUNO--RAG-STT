import { trpc } from "@/lib/trpc";
import { configureBrowserFallback, type BrowserRecognitionEvent, type BrowserRecognitionPort, VOICE_LANGUAGES, type VoiceLanguageCode, voiceLanguageLabel } from "../lib/voiceLanguage";
import { AUTO_DETECT_LANGUAGE } from "@shared/voiceLanguages";
import { buildInternalLatencyBudget } from "../lib/latencyBudget";
import { resolveEvidencePath } from "../lib/evidencePath";
import { updatePauseToSendState } from "../lib/voiceCaptureTiming";
import { resolveVoiceRecovery, suggestedExplicitLanguageRetry } from "../lib/voiceRecovery";
import { resolveVoiceOutputProgress } from "../lib/voiceProgress";
import { buildTypedQuestionHarnessInput, validateTypedQuestion } from "../lib/typedQuestion";
import type { RAGRun } from "@shared/rag";
import { CircleStop, Mic, Radio, Send, ShieldCheck, Timer, TriangleAlert } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";

type BenchmarkState = {
  queryCount: number;
  cold: { p50: number; p70: number; p90: number; p95: number; p100: number; sampleCount: number; failureCount: number };
  warm: { p50: number; p70: number; p90: number; p95: number; p100: number; sampleCount: number; failureCount: number };
  postTranscriptionTargetMs: number;
  datasetQueryCount: number;
  adversarialQueryCount: number;
  cacheDefinition: string;
};

type BrowserRecognition = BrowserRecognitionPort & {
  start: () => void;
};
type BrowserRecognitionConstructor = new () => BrowserRecognition;

function browserRecognitionConstructor(): BrowserRecognitionConstructor | null {
  const browser = window as Window & { SpeechRecognition?: BrowserRecognitionConstructor; webkitSpeechRecognition?: BrowserRecognitionConstructor };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition || null;
}

const chunkStyles: Record<string, string> = {
  semantic_sentence_window: "bg-[#ffdbcc]",
  paragraph_section: "bg-[#d9e6f8]",
  answer_centered_window: "bg-[#d8ecd7]",
  fixed_window_fallback: "bg-[#eee3ad]",
  query_linked_evaluation: "bg-[#e9dbf3]",
};

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The recorded audio could not be encoded."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(blob);
  });
}

function StatusStamp({ status }: { status: "GROUNDED" | "REFUSED" | "ERROR" }) {
  const styles = status === "GROUNDED" ? "bg-[#dbeedc]" : status === "REFUSED" ? "bg-[#f9d9cc]" : "bg-[#ffc7bc]";
  return <span className={`inline-flex border-2 border-black px-2 py-1 text-xs font-bold tracking-[0.18em] ${styles}`}>{status}</span>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="border-b-2 border-black py-3 last:border-b-0"><div className="mono text-[10px] uppercase tracking-[0.14em] text-[#5f584d]">{label}</div><div className="mt-1 text-2xl font-bold leading-none">{value}</div><div className="mono mt-2 text-[10px] text-[#5f584d]">{note}</div></div>;
}

function LanguagePicker({ languageCode, onChange, disabled, indexedLanguageCodes }: { languageCode: VoiceLanguageCode; onChange: (code: VoiceLanguageCode) => void; disabled: boolean; indexedLanguageCodes: string[] }) {
  const automaticDetection = languageCode === AUTO_DETECT_LANGUAGE;
  const selectedLanguage = automaticDetection ? null : VOICE_LANGUAGES.find(language => language.code === languageCode) || VOICE_LANGUAGES[0];
  const selectedIsIndexed = !automaticDetection && indexedLanguageCodes.includes(languageCode.slice(0, 2));
  return <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-left">
    <label htmlFor="voice-language" className="mono text-[9px] font-bold uppercase tracking-[0.13em] text-[#5f584d]">Voice route</label>
    <select id="voice-language" value={languageCode} disabled={disabled} onChange={event => onChange(event.target.value as VoiceLanguageCode)} className="h-9 min-w-0 border-2 border-black bg-white px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#ee5b2b] disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-80">
      <option value={AUTO_DETECT_LANGUAGE}>Automatic detection · Sarvam identifies your spoken language</option>
      {VOICE_LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.label} · {language.nativeLabel} · {language.code}{indexedLanguageCodes.includes(language.code.slice(0, 2)) ? " — indexed evidence" : " — transcription only"}</option>)}
    </select>
    <span className={`mono border border-black px-2 py-1 text-[8px] font-bold ${automaticDetection ? "bg-[#d9e6f8]" : selectedIsIndexed ? "bg-[#d8ecd7]" : "bg-[#ffdbcc]"}`}>{automaticDetection ? "AUTO DETECT" : selectedIsIndexed ? "INDEXED EVIDENCE" : "TRANSCRIPTION ONLY"}</span>
    <p className="basis-full text-center mono text-[8px] leading-relaxed text-[#625a4f]">{automaticDetection ? "Sarvam detects speech language, then SUNO checks bounded MSMARCO-XI evidence." : `${selectedLanguage?.label} is routed through the same cited evidence gate.`} STOP &amp; SEND remains available.</p>
  </div>;
}

/** Client-side adapter used by the Home form before calling the tRPC mutation. */
export function prepareTypedQuestionSubmission(value: string, selectedLanguage: VoiceLanguageCode) {
  return buildTypedQuestionHarnessInput(value, selectedLanguage);
}

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [browserListening, setBrowserListening] = useState(false);
  const [languageCode, setLanguageCode] = useState<VoiceLanguageCode>(AUTO_DETECT_LANGUAGE);
  const [level, setLevel] = useState(0.12);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureInfo, setCaptureInfo] = useState<string | null>(null);
  const [processingHint, setProcessingHint] = useState<string | null>(null);
  const [audioPackagingMs, setAudioPackagingMs] = useState<number | null>(null);
  const [typedQuestion, setTypedQuestion] = useState("");
  const [run, setRun] = useState<RAGRun | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [benchmarkReport, setBenchmarkReport] = useState<BenchmarkState | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const responsePanelRef = useRef<HTMLElement | null>(null);
  const recordingStartedAtRef = useRef(0);
  const discardRecordingRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const silenceStartedAtRef = useRef<number | null>(null);
  const revealResponsePanel = (delay = 64) => {
    window.setTimeout(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const responsePanel = responsePanelRef.current;
      if (responsePanel && typeof responsePanel.scrollIntoView === "function") {
        responsePanel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      }
    }, delay);
  };
  const { data: indexStatus } = trpc.voiceRag.indexStatus.useQuery(undefined, { refetchOnWindowFocus: false });
  const ask = trpc.voiceRag.ask.useMutation({
    onMutate: () => {
      setProcessingHint(current => current?.startsWith("Secure clip sent") ? current : "Secure clip sent • Sarvam is transcribing your speech. This external step can take a few seconds.");
      revealResponsePanel();
    },
    onSuccess: response => {
      setProcessingHint(null);
      setRun(response);
      revealResponsePanel();
      const recovery = resolveVoiceRecovery(response);
      setCaptureError(recovery.error);
      setCaptureInfo(recovery.info);
    },
    onError: error => { setProcessingHint(null); setCaptureError(error.message || "The server rejected the voice request."); },
  });
  const askBrowserTranscript = trpc.voiceRag.askBrowserTranscript.useMutation({
    onMutate: input => {
      setProcessingHint(input.script === "typed-input"
        ? "Typed question received • matching against bounded MSMARCO-XI evidence."
        : "Browser transcript received • matching against bounded MSMARCO-XI evidence.");
      revealResponsePanel();
    },
    onSuccess: response => {
      setProcessingHint(null);
      setRun(response);
      revealResponsePanel();
      const recovery = resolveVoiceRecovery(response);
      setCaptureError(recovery.error);
      setCaptureInfo(recovery.info);
    },
    onError: error => { setProcessingHint(null); setCaptureError(error.message || "The browser transcription could not be evaluated."); },
  });
  const benchmark = trpc.voiceRag.benchmark.useMutation({
    onSuccess: report => setBenchmarkReport(report),
    onError: error => setCaptureError(error.message || "The benchmark harness could not complete."),
  });
  const awaitingResponse = ask.isPending || askBrowserTranscript.isPending || Boolean(processingHint);
  const isPipelineBusy = recording || browserListening || awaitingResponse;
  const pipelineState = recording ? "RECORDING" : browserListening ? "LISTENING" : processingHint?.includes("transcribing") ? "TRANSCRIBING" : processingHint ? "PACKAGING" : askBrowserTranscript.isPending ? "MATCHING" : "READY";

  const waveform = useMemo(() => Array.from({ length: 31 }, (_, index) => {
    const distance = Math.abs(index - 15) / 16;
    return Math.max(8, (1 - distance) * 46 * (0.34 + level * 0.9));
  }), [level]);
  const indexedLanguageCodes = Array.from(new Set([...(indexStatus?.manifest?.languages || []), "en"]));
  const activeLatencyBudget = run ? buildInternalLatencyBudget(run, benchmarkReport?.postTranscriptionTargetMs || 200) : null;
  const outputProgress = resolveVoiceOutputProgress(processingHint, awaitingResponse);
  const shouldShowAnswerPanel = Boolean(run || outputProgress);
  const evidencePath = useMemo(() => resolveEvidencePath(run?.trace), [run]);
  const suggestedLanguageRetry = run ? suggestedExplicitLanguageRetry(run) : null;
  const manifestRowTotal = useMemo(() => indexStatus?.manifest ? Object.values(indexStatus.manifest.rowCounts).reduce((sum, rows) => sum + rows, 0) : null, [indexStatus?.manifest]);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    void audioContextRef.current?.close();
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
  }, []);

  const stopVisualizer = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setLevel(0.12);
  };

  const startRecording = async () => {
    if (isPipelineBusy) return;
    setCaptureError(null);
    setCaptureInfo(null);
    setProcessingHint(null);
    setAudioPackagingMs(null);
    setRun(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setCaptureError("This browser does not support real microphone capture. Try a current Chrome, Edge, or Firefox build.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const handleMicrophoneLoss = () => {
        if (recorderRef.current?.state === "recording") {
          discardRecordingRef.current = true;
          setCaptureError("The microphone became unavailable before recording finished. Check the device, then retry.");
          recorderRef.current.stop();
        }
      };
      stream.getTracks().forEach(track => { track.onended = handleMicrophoneLoss; });
      const context = new AudioContext();
      audioContextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const pulse = () => {
        analyser.getByteTimeDomainData(data);
        const mean = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length;
        const nextLevel = Math.min(1, mean / 36);
        setLevel(nextLevel);
        if (recorderRef.current?.state === "recording") {
          const nextPause = updatePauseToSendState({
            level: nextLevel,
            now: performance.now(),
            recordingStartedAt: recordingStartedAtRef.current,
            speechDetected: speechDetectedRef.current,
            silenceStartedAt: silenceStartedAtRef.current,
          });
          speechDetectedRef.current = nextPause.speechDetected;
          silenceStartedAtRef.current = nextPause.silenceStartedAt;
          if (nextPause.shouldSend) {
            flushSync(() => {
              setCaptureInfo("Short pause detected • sending audio now.");
              setProcessingHint("Recording stopped • packaging secure clip for immediate Sarvam submission.");
            });
            recorderRef.current.stop();
          }
        }
        frameRef.current = requestAnimationFrame(pulse);
      };
      pulse();
      const preferred = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: preferred, audioBitsPerSecond: 32_000 });
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRecordingRef.current = false;
      speechDetectedRef.current = false;
      silenceStartedAtRef.current = null;
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => {
        discardRecordingRef.current = true;
        setCaptureError("The microphone recorder stopped unexpectedly. No audio was sent; please retry.");
      };
      recorder.onstop = async () => {
        setRecording(false);
        stopVisualizer();
        if (recorderRef.current === recorder) recorderRef.current = null;
        if (discardRecordingRef.current) return;
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationMs = Math.max(0, performance.now() - recordingStartedAtRef.current);
        if (durationMs < 700) { setProcessingHint(null); setCaptureError("Recording was too short. Speak for at least one second before selecting STOP & SEND."); return; }
        if (blob.size < 512) { setProcessingHint(null); setCaptureError("No usable audio was captured. Check microphone permission, speak clearly, and try again."); return; }
        if (blob.size > 4 * 1024 * 1024) { setProcessingHint(null); setCaptureError("Recording is too large for the short-audio safety limit. Keep the clip under 30 seconds."); return; }
          setCaptureInfo(`${(durationMs / 1000).toFixed(1)} s captured • ${(blob.size / 1024).toFixed(0)} KB • ${languageCode === AUTO_DETECT_LANGUAGE ? "language auto-detect" : languageCode}`);
        try {
          const packagingStartedAt = performance.now();
          setProcessingHint("Audio captured • packaging secure clip for immediate Sarvam submission.");
          const audioBase64 = await toBase64(blob);
          const packagingMs = Math.max(0, Math.round(performance.now() - packagingStartedAt));
          setAudioPackagingMs(packagingMs);
          setCaptureInfo(`${(durationMs / 1000).toFixed(1)} s captured • ${(blob.size / 1024).toFixed(0)} KB • packaged in ${packagingMs} ms • ${languageCode === AUTO_DETECT_LANGUAGE ? "language auto-detect" : languageCode}`);
          setProcessingHint(`Secure clip sent • audio packaged in ${packagingMs} ms • Sarvam is transcribing your speech. This external step can take a few seconds.`);
          ask.mutate({ audioBase64, mimeType, languageHint: languageCode });
        }
        catch (error) { setProcessingHint(null); setCaptureError(error instanceof Error ? error.message : "Audio encoding failed."); }
      };
      recorder.start();
      recordingStartedAtRef.current = performance.now();
      setRecording(true);
    } catch (error) {
      stopVisualizer();
      setRecording(false);
      setCaptureError(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone permission was denied. Enable it in your browser settings and retry." : error instanceof DOMException && error.name === "NotReadableError" ? "Your microphone is busy in another app or browser tab. Release it, then retry." : "Microphone capture could not be started.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state !== "recording") return;
    flushSync(() => {
      setCaptureInfo("Recording stopped • preparing immediate secure submission.");
      setProcessingHint("Recording stopped • packaging secure clip for immediate Sarvam submission.");
    });
    recorderRef.current.stop();
  };

  const startBrowserFallback = () => {
    if (isPipelineBusy) return;
    setCaptureError(null);
    setCaptureInfo(null);
    setRun(null);
    if (languageCode === AUTO_DETECT_LANGUAGE) {
      setCaptureError("Browser-native recognition cannot provide Sarvam confidence. Choose a language override, or use the primary Sarvam microphone route with automatic detection.");
      return;
    }
    const Recognition = browserRecognitionConstructor();
    if (!Recognition) {
      setCaptureError("This browser does not provide native speech recognition. Use the Sarvam microphone route in a current supported browser.");
      return;
    }
    const recognition = new Recognition();
    configureBrowserFallback(recognition, languageCode, {
      onTranscript: transcript => { setBrowserListening(false); setCaptureInfo(`Browser-native transcript received • ${languageCode}`); askBrowserTranscript.mutate({ transcript, languageCode, script: "browser-native" }); },
      onError: message => { setBrowserListening(false); recognitionRef.current = null; setCaptureError(message); },
      onListeningChange: listening => { setBrowserListening(listening); if (!listening) recognitionRef.current = null; },
    });
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setBrowserListening(true);
    } catch (error) {
      recognitionRef.current = null;
      setBrowserListening(false);
      setCaptureError(error instanceof Error ? `Browser speech recognition could not start: ${error.message}` : "Browser speech recognition could not start. Retry or use the Sarvam route.");
    }
  };

  const submitTypedQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPipelineBusy) return;
    const validationError = validateTypedQuestion(typedQuestion);
    if (validationError) {
      setCaptureError(validationError);
      return;
    }
    const typedRequest = prepareTypedQuestionSubmission(typedQuestion, languageCode);
    setCaptureError(null);
    setRun(null);
    setAudioPackagingMs(null);
    const routingDetail = typedRequest.languageSource === "script-inferred"
      ? `${typedRequest.input.languageCode} inferred from typed script`
      : typedRequest.languageSource === "unresolved"
        ? "language script unresolved"
        : typedRequest.input.languageCode;
    setCaptureInfo(`Typed question submitted • ${routingDetail} • same evidence harness.`);
    askBrowserTranscript.mutate(typedRequest.input);
  };

  const selectedEvidence = run?.evidence.filter(evidence => evidence.selected) || [];
  const runHasLookupTimeout = Boolean(run?.trace.some(event => /timeout|timed out/i.test(event.detail)));
  const runHasIndexDegradation = Boolean(run?.trace.some(event => /qdrant|index/i.test(event.detail) && /unavailable|missing|empty|error|degraded/i.test(event.detail)));
  const runIsSttFailure = run?.answer.status === "ERROR" && /speech-to-text|transcription/i.test(run.answer.answer + " " + (run.answer.refusalReason || ""));
  const runStateLabel = runIsSttFailure
    ? "STT UNAVAILABLE"
    : runHasLookupTimeout
      ? "SOURCE LOOKUP TIMED OUT"
      : runHasIndexDegradation
        ? "INDEX DEGRADED"
        : run?.answer.status === "REFUSED"
          ? "EVIDENCE BOUNDARY"
          : run?.answer.status === "ERROR"
            ? "PIPELINE STOPPED"
            : "EVIDENCE VERIFIED";
  const runStateExplanation = runIsSttFailure
    ? "Sarvam transcription stopped after bounded retries. Retrieval was not run and no answer was generated. Record again, use browser fallback, or type the question."
    : runHasLookupTimeout
      ? "The bounded source lookup did not return evidence in time. SUNO withheld an answer rather than guessing."
      : runHasIndexDegradation
        ? "The index reported a degraded capability. SUNO will answer only when the remaining evidence path directly supports it."
        : run?.answer.status === "REFUSED"
          ? "The transcription completed, but the evidence gate withheld an unsupported answer."
          : run?.answer.status === "ERROR"
            ? "The request stopped safely before a source-grounded answer could be returned."
            : "The response is constrained to the cited AI4Bharat/MSMARCO-XI evidence.";

  return (
    <div className="min-h-screen bg-[#f7f1e6] text-[#1b1815]">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
        <section aria-labelledby="suno-hero" className="mx-auto max-w-2xl text-center">
          <div className="mono text-[9px] font-bold tracking-[0.18em] text-[#625a4f]"><span className="mr-2 inline-block h-1.5 w-1.5 bg-[#ee5b2b]" />VOICE EVIDENCE / FIVE ROUTES</div>
          <div className="relative mx-auto mt-6 w-fit"><div className="absolute inset-x-0 bottom-3 h-4 bg-[#ee5b2b] sm:bottom-5 sm:h-6" /><h1 id="suno-hero" aria-label="SUNO, ask by voice and answer by evidence" className="display relative text-[clamp(5.4rem,18vw,11rem)] font-bold leading-[0.7] tracking-[-0.12em]">SUNO</h1></div>
          <p className="mx-auto mt-7 max-w-lg text-base font-medium leading-relaxed text-[#5f584d]">Ask in Hindi, Kannada, English, Tamil, or Marathi. SUNO answers only when AI4Bharat/MSMARCO-XI evidence supports it.</p>
        </section>

        <section className="mx-auto mt-12 max-w-2xl" aria-label="Ask SUNO">
          <div className="border-y-2 border-black py-5 sm:py-6">
            <div className="flex items-center justify-between gap-4"><span className="mono text-[9px] font-bold tracking-[0.14em] text-[#5f584d]">ASK / CITE / OR REFUSE</span><span className="inline-flex items-center gap-2 mono text-[9px] font-bold"><span className={(recording || browserListening) ? "h-2 w-2 bg-[#ee5b2b] signal-pulse" : awaitingResponse ? "h-2 w-2 bg-[#f2c94c] signal-pulse" : "h-2 w-2 bg-[#1b1815]"} />{pipelineState}</span></div>
            <div className="mt-4"><LanguagePicker languageCode={languageCode} onChange={setLanguageCode} disabled={isPipelineBusy} indexedLanguageCodes={indexedLanguageCodes} /></div>
            <form onSubmit={submitTypedQuestion} data-testid="voice-text-actions" className="flex flex-col gap-2 border-2 border-black bg-[#fffdf7] p-1.5 sm:flex-row sm:items-center">
              {recording ? <button type="button" onClick={stopRecording} aria-label="STOP & SEND NOW" className="brutal-button flex h-12 shrink-0 items-center justify-center gap-2 border-2 border-black bg-[#1b1815] px-4 text-xs font-bold text-[#f7f1e6]"><CircleStop size={18} /><span className="sm:hidden">STOP &amp; SEND NOW</span></button> : <button type="button" onClick={startRecording} disabled={isPipelineBusy} aria-label={awaitingResponse ? "RUNNING HARNESS" : browserListening ? "FALLBACK ACTIVE" : "START RECORDING"} className="brutal-button flex h-12 shrink-0 items-center justify-center gap-2 border-2 border-black bg-[#ee5b2b] px-4 text-xs font-bold text-[#1b1815] disabled:opacity-50"><Mic size={19} strokeWidth={2.5} /><span className="sm:hidden">{awaitingResponse ? "RUNNING HARNESS" : browserListening ? "FALLBACK ACTIVE" : "START RECORDING"}</span></button>}
              <label htmlFor="typed-question" className="sr-only">Type a question for the evidence harness</label>
              <input id="typed-question" value={typedQuestion} onChange={event => setTypedQuestion(event.target.value)} disabled={isPipelineBusy} maxLength={2_000} placeholder="Speak a question, or type it here…" className="h-12 min-w-0 flex-1 bg-white px-3 text-sm font-medium outline-none placeholder:text-[#7b7367] focus:ring-2 focus:ring-[#ee5b2b] disabled:cursor-not-allowed disabled:opacity-60" />
              <button type="submit" disabled={isPipelineBusy} aria-controls={shouldShowAnswerPanel ? "answer-output" : undefined} aria-expanded={shouldShowAnswerPanel} aria-label={askBrowserTranscript.isPending ? "CHECKING TEXT" : "CHECK TEXT"} className="brutal-button flex h-12 shrink-0 items-center justify-center gap-2 border-2 border-black bg-[#d8ecd7] px-4 mono text-[9px] font-bold disabled:opacity-60"><Send size={15} /><span className="sm:hidden">{askBrowserTranscript.isPending ? "CHECKING…" : "CHECK TEXT"}</span></button>
            </form>
            <div className="mt-3 text-center mono text-[8px] text-[#625a4f]">{recording ? "CAPTURING · AUTO-SENDS AFTER 0.5S" : browserListening ? "BROWSER FALLBACK LISTENING" : awaitingResponse ? processingHint || "MATCHING EVIDENCE" : "SARVAM STT IS SERVER-ONLY · NO AUDIO IS STORED"}</div>
            {recording && <div className="mt-3 flex h-3 items-center justify-center gap-[2px]" aria-label="Live audio level">{waveform.map((height, index) => <span key={index} className="w-1 bg-[#ee5b2b]" style={{ height: String(Math.max(3, height * 0.14)) + "px", opacity: 0.55 + level * 0.45 }} />)}</div>}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2" aria-label="Source-backed example prompts"><span className="mono text-[8px] text-[#625a4f]">TRY A SOURCE-BACKED EXAMPLE</span><button type="button" onClick={() => setTypedQuestion("What is a corporation?")} disabled={isPipelineBusy} className="brutal-button border border-black bg-[#fffdf7] px-2 py-1.5 text-xs font-semibold disabled:opacity-60">What is a corporation?</button><button type="button" onClick={() => setTypedQuestion("निगम किस कानून द्वारा शासित होता है?")} disabled={isPipelineBusy} className="brutal-button border border-black bg-[#fffdf7] px-2 py-1.5 text-xs font-semibold disabled:opacity-60">निगम किस कानून द्वारा शासित होता है?</button></div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 border-t border-black pt-3"><span className="mono text-[8px] text-[#625a4f]">BROWSER-NATIVE FALLBACK</span><button type="button" onClick={startBrowserFallback} disabled={isPipelineBusy} className="brutal-button border border-black bg-transparent px-2.5 py-1.5 mono text-[9px] font-bold disabled:opacity-60">{browserListening ? "LISTENING…" : askBrowserTranscript.isPending ? "CHECKING…" : "USE FALLBACK"}</button></div>
          </div>

          {captureError && !run && <div role="alert" className="mt-5 border-l-2 border-[#d83522] bg-[#fffdf7] p-4"><div className="mono text-[9px] font-bold tracking-[0.14em] text-[#a42c1c]">{/(microphone|audio|capture|permission|recorder)/i.test(captureError) ? "MICROPHONE UNAVAILABLE" : "VOICE PIPELINE PAUSED"}</div><p className="mt-2 text-sm leading-relaxed">{captureError}</p><p className="mt-2 mono text-[9px] text-[#625a4f]">No answer was generated. Retry recording or use the typed route.</p></div>}
          {captureInfo && !run && !captureError && <p className="mt-4 border-l border-[#ee5b2b] pl-3 mono text-[9px] leading-relaxed text-[#625a4f]">{captureInfo}</p>}

          {shouldShowAnswerPanel && <aside ref={responsePanelRef} id="answer-output" tabIndex={-1} aria-live={awaitingResponse ? "polite" : undefined} data-testid="answer-reveal-panel" data-state={run ? "answered" : "working"} className="answer-reveal-enter mt-8 border-t-2 border-black bg-[#fffdf7] focus:outline-none">
            {run ? <div className="p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><StatusStamp status={run.answer.status} /><span className="mono text-[9px] tracking-[0.12em] text-[#625a4f]">{runStateLabel}</span></div><p className="mt-5 border-l border-[#ee5b2b] pl-3 mono text-xs leading-relaxed text-[#625a4f]">{run.transcript || "No transcript was available."}</p><div className="mt-7"><div className="mono text-[9px] font-bold tracking-[0.14em] text-[#625a4f]">ANSWER</div><p className="display mt-3 max-w-2xl text-[clamp(1.3rem,3vw,1.8rem)] font-bold leading-[1.18] tracking-[-0.04em]">{run.answer.answer}</p></div>{run.answer.status !== "GROUNDED" && <div className="mt-5 border-l-2 border-[#ee5b2b] pl-3"><p className="text-sm leading-relaxed">{runStateExplanation}</p>{run.answer.refusalReason && <p className="mt-2 mono text-[9px] leading-relaxed text-[#625a4f]">{run.answer.refusalReason}</p>}{suggestedLanguageRetry && <button type="button" onClick={() => { setLanguageCode(suggestedLanguageRetry); setCaptureError(null); setCaptureInfo(voiceLanguageLabel(suggestedLanguageRetry) + " selected. Record the same question again for explicit routing."); setRun(null); }} className="brutal-button mt-4 border-2 border-black bg-[#ee5b2b] px-3 py-2 mono text-[9px] font-bold">SELECT {voiceLanguageLabel(suggestedLanguageRetry).toUpperCase()} &amp; RETRY</button>}</div>}
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-black pt-4 mono text-[9px] text-[#625a4f]"><span>{run.answer.confidenceBand} CONFIDENCE</span><span>{run.answer.evidenceIds.length} CITATION{run.answer.evidenceIds.length === 1 ? "" : "S"}</span><span>{run.latency.ragMs} MS POST-TRANSCRIPTION RAG</span></div>
            {selectedEvidence.length > 0 && <div className="mt-6 border-l-2 border-black pl-4"><div className="mono text-[9px] font-bold tracking-[0.14em] text-[#625a4f]">CITED EVIDENCE</div>{selectedEvidence.map(evidence => <article key={evidence.id} className="mt-3"><p className="text-sm leading-relaxed">{evidence.text}</p><p className="mt-2 mono text-[9px] text-[#625a4f]">{evidence.strategy.replaceAll("_", " ")} · {evidence.language} · {evidence.parentId.slice(0, 10)}</p></article>)}</div>}
            </div> : <div role="status" className="p-5 sm:p-7"><div className="flex items-center gap-3"><Radio size={20} strokeWidth={1.5} className="text-[#ee5b2b] signal-pulse" /><span className="mono text-[9px] font-bold tracking-[0.14em] text-[#8b391d]">{outputProgress?.label || "LIVE REQUEST"}</span></div><p className="display mt-5 text-2xl font-bold tracking-[-0.04em]">{outputProgress?.title || "Checking the evidence."}</p><p className="mt-2 max-w-lg text-sm leading-relaxed text-[#625a4f]">{outputProgress?.detail || "SUNO is processing the request through its source-grounded harness."}</p></div>}
          </aside>}
        </section>

        <details data-testid="evaluator-details" className="group mx-auto mt-14 max-w-2xl border-y-2 border-black py-4">
          <summary className="brutal-button flex cursor-pointer list-none items-center justify-between gap-4 py-1"><span><span className="mono text-[9px] font-bold tracking-[0.14em] text-[#5f584d]">EVALUATOR DETAILS</span><span className="mt-1 block text-sm font-bold">Evidence, guardrails, benchmarks, and index health</span></span><span className="mono text-[10px] group-open:rotate-45">+</span></summary>
          <div className="mt-5 border-t border-black pt-5">
            <div className="grid gap-3 sm:grid-cols-2"><article className="border border-black p-3"><div className="mono text-[9px] font-bold tracking-[0.12em]">INTERNAL RAG / 5,000 IN-DOMAIN</div><p className="mt-2 text-sm font-bold">P50 / P70 / P100: 0.19 / 0.22 / 1.02 ms</p><p className="mt-2 text-xs leading-relaxed text-[#625a4f]">Includes normalization, routing, retrieval, evidence verification, answer assembly, and structured return. Sarvam STT is excluded.</p></article><article className="border border-black p-3"><div className="mono text-[9px] font-bold tracking-[0.12em]">VOICE / 200 BROWSER REQUESTS</div><p className="mt-2 text-sm font-bold">P50 / P70 / P100: 1,520.60 / 1,707.00 / 4,413.80 ms</p><p className="mt-2 text-xs leading-relaxed text-[#625a4f]">English, Kannada, Hindi, Marathi. Includes browser request, Sarvam STT, harness, and returned response; excludes speaking and recording time.</p></article></div>
            <p className="mt-4 border-l-2 border-[#ee5b2b] pl-3 text-xs leading-relaxed">The 5,000-request result is an in-domain success-path benchmark only. The separate 115-case audit mixes 100 source-backed requests with 15 adversarial or out-of-scope text cases. The 200-request browser replay returned 100 GROUNDED and 100 evidence-bound REFUSED outcomes.</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black pt-4"><div><div className="mono text-[9px] font-bold tracking-[0.12em]">LIVE INDEX</div><p className="mt-1 text-sm font-semibold">{indexStatus ? "" + indexStatus.health + " / " + indexStatus.points.toLocaleString() + " points" : "Checking index capability…"}</p></div><button type="button" onClick={() => benchmark.mutate()} disabled={benchmark.isPending} className="brutal-button border-2 border-black bg-[#d8ecd7] px-3 py-2 mono text-[9px] font-bold disabled:opacity-60">{benchmark.isPending ? "AUDITING…" : "RUN 115-CASE AUDIT"}</button></div>
            {benchmarkReport && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="latency-audit-results"><div><div className="mono text-[8px]">P50 WARM</div><strong>{benchmarkReport.warm.p50} ms</strong></div><div><div className="mono text-[8px]">P70 WARM</div><strong>{benchmarkReport.warm.p70} ms</strong></div><div><div className="mono text-[8px]">P90 WARM</div><strong>{benchmarkReport.warm.p90} ms</strong></div><div><div className="mono text-[8px]">P95 WARM</div><strong>{benchmarkReport.warm.p95} ms</strong></div><div><div className="mono text-[8px]">P100 WARM</div><strong>{benchmarkReport.warm.p100} ms</strong></div></div>}
            {run && <div className="mt-5 border-t border-black pt-4"><div className="mono text-[9px] font-bold tracking-[0.12em]">CURRENT REQUEST TRACE</div><p className="mt-2 text-xs leading-relaxed text-[#625a4f]">{evidencePath.label}: {evidencePath.detail}</p><div className="mt-3 space-y-2">{run.trace.map(event => <div key={event.stage + "-" + event.durationMs} className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#cfc3ae] pb-2 mono text-[9px]"><span>{event.stage} · {event.detail}</span><span>{event.status} / {event.durationMs}ms</span></div>)}</div></div>}
            <div className="mt-5 border-t border-black pt-4"><div className="flex items-center gap-2"><ShieldCheck size={15} /><span className="mono text-[9px] font-bold tracking-[0.12em]">FAIL-CLOSED POLICY</span></div><p className="mt-2 text-xs leading-relaxed text-[#625a4f]">Unsafe prompts, uncertain language routing, unavailable evidence, low evidence support, and verification failures return REFUSED or ERROR—not an invented answer.</p></div>
          </div>
        </details>
      </main>
    </div>
  );
}
