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
import { Activity, ChevronDown, CircleStop, Database, FileText, Mic, Radio, Send, ShieldCheck, Timer, TriangleAlert, Zap } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-[#f7f1e6] text-[#1b1815]">
      <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
        <section aria-labelledby="suno-hero" className="mx-auto max-w-4xl pb-8 text-center sm:pb-10">
          <div className="mono text-[9px] font-bold tracking-[0.18em] text-[#625a4f]"><span className="mr-2 inline-block h-1.5 w-1.5 bg-[#ee5b2b]" />VOICE EVIDENCE / FIVE GROUNDED ROUTES</div>
          <div className="relative mx-auto mt-6 w-fit"><div className="absolute inset-x-0 bottom-3 h-4 bg-[#ee5b2b] sm:bottom-5 sm:h-6" /><h1 id="suno-hero" aria-label="SUNO, ask by voice and answer by evidence" className="display relative text-[clamp(5.7rem,18vw,13.5rem)] font-bold leading-[0.7] tracking-[-0.12em]">SUNO</h1></div>
          <h2 className="display mt-6 text-3xl font-bold tracking-[-0.06em] sm:text-5xl">Ask by voice. <span className="text-[#8b391d]">Answer by evidence.</span></h2>
          <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-relaxed text-[#5f584d] sm:text-base">A source-first multilingual RAG console for AI4Bharat/MSMARCO-XI. Every response is cited; unsupported claims stop at the evidence boundary.</p>
          <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2 mono text-[9px]"><span className="border border-black bg-[#d8ecd7] px-2.5 py-1">AI4BHARAT / MSMARCO-XI</span><span className="border border-black bg-[#d9e6f8] px-2.5 py-1">L1 CACHE → QDRANT</span><span className="border border-black bg-[#ffdbcc] px-2.5 py-1">{manifestRowTotal ? `${manifestRowTotal.toLocaleString()} SOURCE ROWS` : "INDEX CHECKING"}</span></div>
        </section>

        <section className="mx-auto max-w-4xl">
          <div className="border-y-2 border-black py-5 sm:py-6">
            <div className="flex items-center justify-between gap-4"><div className="mono text-[9px] font-bold tracking-[0.14em] text-[#5f584d]">ASK / CITE / OR REFUSE</div><div className="flex items-center gap-2 mono text-[9px] font-bold"><span className={`h-2 w-2 ${recording || browserListening ? "bg-[#ee5b2b] signal-pulse" : awaitingResponse ? "bg-[#f2c94c] signal-pulse" : "bg-[#1b1815]"}`} />{pipelineState}</div></div>
            <div className="mt-4"><LanguagePicker languageCode={languageCode} onChange={setLanguageCode} disabled={isPipelineBusy} indexedLanguageCodes={indexedLanguageCodes} /></div>
            <form onSubmit={submitTypedQuestion} data-testid="voice-text-actions" className="flex flex-col gap-2 border-2 border-black bg-[#fffdf7] p-1.5 sm:flex-row sm:items-center">
              {recording ? <button type="button" onClick={stopRecording} aria-label="STOP & SEND NOW" className="brutal-button flex h-12 shrink-0 items-center justify-center gap-2 border-2 border-black bg-[#1b1815] px-4 text-xs font-bold text-[#f7f1e6]"><CircleStop size={18} /> <span className="sm:hidden">STOP &amp; SEND NOW</span></button> : <button type="button" onClick={startRecording} disabled={isPipelineBusy} aria-label={awaitingResponse ? "RUNNING HARNESS" : browserListening ? "FALLBACK ACTIVE" : "START RECORDING"} className="brutal-button flex h-12 shrink-0 items-center justify-center gap-2 border-2 border-black bg-[#ee5b2b] px-4 text-xs font-bold text-[#1b1815] disabled:opacity-50"><Mic size={19} strokeWidth={2.5} /> <span className="sm:hidden">{awaitingResponse ? "RUNNING HARNESS" : browserListening ? "FALLBACK ACTIVE" : "START RECORDING"}</span></button>}
              <label htmlFor="typed-question" className="sr-only">Type a question for the evidence harness</label>
              <input id="typed-question" value={typedQuestion} onChange={event => setTypedQuestion(event.target.value)} disabled={isPipelineBusy} maxLength={2_000} placeholder="Speak a question, or type it here…" className="h-12 min-w-0 flex-1 bg-white px-3 text-sm font-medium outline-none placeholder:text-[#7b7367] focus:ring-2 focus:ring-[#ee5b2b] disabled:cursor-not-allowed disabled:opacity-60" />
              <button type="submit" disabled={isPipelineBusy} aria-controls="answer-output" aria-label={askBrowserTranscript.isPending ? "CHECKING TEXT" : "CHECK TEXT"} className="brutal-button flex h-12 shrink-0 items-center justify-center gap-2 border-2 border-black bg-[#d8ecd7] px-4 mono text-[9px] font-bold disabled:opacity-60"><Send size={15} /><span className="sm:hidden">{askBrowserTranscript.isPending ? "CHECKING…" : "CHECK TEXT"}</span></button>
            </form>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mono text-[8px] text-[#625a4f]"><span className="inline-flex items-center gap-1.5">{recording ? <span className="h-1.5 w-1.5 bg-[#ee5b2b] signal-pulse" /> : <span className="h-1.5 w-1.5 bg-black" />}{recording ? `CAPTURING ${voiceLanguageLabel(languageCode).toUpperCase()} · AUTO-SENDS AFTER 0.5S` : browserListening ? `LISTENING FOR ${voiceLanguageLabel(languageCode).toUpperCase()}` : awaitingResponse ? processingHint || "MATCHING EVIDENCE" : "PRESS MIC & SPEAK, OR TYPE & SEND"}</span><span>·</span><span>SARVAM STT / SERVER-ONLY</span><span>·</span><span>NO AUDIO STORED</span></div>
            {recording && <div className="mt-3 flex h-3 items-center justify-center gap-[2px]" aria-label="Live audio level">{waveform.map((height, index) => <span key={index} className="w-1 bg-[#ee5b2b]" style={{ height: `${Math.max(3, height * 0.14)}px`, opacity: 0.55 + level * 0.45 }} />)}</div>}
            {captureInfo && <div data-audio-packaging-ms={audioPackagingMs ?? undefined} className={`mt-4 border-2 border-black p-3 mono text-[10px] font-bold uppercase tracking-[0.08em] ${run?.answer.status === "REFUSED" ? "bg-[#ffdbcc]" : "bg-[#d8ecd7]"}`}>AUDIO / EVIDENCE STATUS / {captureInfo}</div>}
            {captureError && <div className="mt-4 flex gap-2 border-2 border-black bg-[#ffc7bc] p-3"><TriangleAlert className="mt-0.5 shrink-0" size={17} /><div><div className="mono text-[10px] font-bold tracking-[0.12em]">CAPTURE / PIPELINE ERROR</div><p className="mt-1 text-sm leading-snug">{captureError}</p></div></div>}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 border-t-2 border-black pt-3"><span className="mono text-[8px] text-[#625a4f]">BROWSER-NATIVE FALLBACK → SAME FAIL-CLOSED HARNESS</span><button type="button" onClick={startBrowserFallback} disabled={isPipelineBusy} className="brutal-button border-2 border-black bg-[#f4eedf] px-2.5 py-1.5 mono text-[9px] font-bold disabled:opacity-60">{browserListening ? "LISTENING…" : askBrowserTranscript.isPending ? "CHECKING…" : "USE FREE FALLBACK"}</button></div>
          </div>

          <aside ref={responsePanelRef} id="answer-output" tabIndex={-1} aria-live={awaitingResponse ? "polite" : undefined} data-testid="answer-reveal-panel" data-state={run ? "answered" : outputProgress ? "working" : "idle"} className="brutal-border scroll-mt-24 bg-[#1b1815] text-[#f7f1e6] shadow-[4px_4px_0_#1b1815] focus:outline-none">
            <div className="border-b-2 border-[#f4eedf] p-4 sm:p-5"><div className="mono text-[10px] tracking-[0.15em] text-[#ffb293]">02 / ANSWER REVEAL</div><div className="mt-3 flex items-center justify-between gap-3">{run ? <StatusStamp status={run.answer.status} /> : outputProgress ? <span className="border-2 border-[#ffb293] bg-[#ffdbcc] px-2 py-1 text-xs font-bold tracking-[0.18em] text-[#1b1815]">LIVE RUN</span> : <span className="border-2 border-[#f4eedf] px-2 py-1 text-xs font-bold tracking-[0.18em]">AWAITING QUESTION</span>}<span className="mono text-[10px]">{run ? `REQ ${run.requestId.slice(0, 8)}` : outputProgress ? "IN PROGRESS" : "NO RUN"}</span></div></div>
            <div className="p-4 sm:p-5">{run ? <><div className="mono text-[10px] uppercase tracking-[0.12em] text-[#c9c0b1]">transcript / {run.detectedLanguage} / {run.detectedScript}</div>{run.detectedLanguageConfidence !== undefined && run.detectedLanguageConfidence !== null && <div className="mono mt-1 text-[9px] uppercase tracking-[0.12em] text-[#ffb293]">Sarvam auto-detect confidence / {Math.round(run.detectedLanguageConfidence * 100)}%</div>}<p className="mt-2 border-l-2 border-[#ff5a1f] pl-3 text-sm leading-relaxed text-[#f4eedf]">{run.transcript}</p><div className="mt-6 mono text-[10px] uppercase tracking-[0.12em] text-[#c9c0b1]">answer</div><p className="mt-2 text-lg font-medium leading-snug">{run.answer.answer}</p>{run.answer.status === "REFUSED" && (suggestedLanguageRetry ? <div className="mt-3 border-l-2 border-[#ffb293] pl-3 text-xs leading-relaxed text-[#c9c0b1]"><p>TRANSCRIPTION COMPLETED. Automatic Detection read {voiceLanguageLabel(suggestedLanguageRetry)}, but confidence was below the 80% routing threshold. Retrieval was not run.</p><button type="button" onClick={() => { setLanguageCode(suggestedLanguageRetry); setCaptureError(null); setCaptureInfo(`${voiceLanguageLabel(suggestedLanguageRetry)} selected. Record the same question again for explicit routing.`); setRun(null); }} className="brutal-button mt-3 border-2 border-[#f4eedf] bg-[#ff5a1f] px-3 py-2 mono text-[9px] font-bold text-[#1b1815]">SELECT {voiceLanguageLabel(suggestedLanguageRetry).toUpperCase()} &amp; RETRY</button></div> : <p className="mt-3 border-l-2 border-[#ffb293] pl-3 text-xs leading-relaxed text-[#c9c0b1]">TRANSCRIPTION COMPLETED. This is an evidence boundary, not a microphone error. Use one of the source-backed prompts above for a grounded demonstration.</p>)}<div className="mt-5 grid grid-cols-3 gap-2 border-t-2 border-[#f4eedf] pt-4"><div><div className="mono text-[9px] text-[#c9c0b1]">CONFIDENCE</div><div className="mt-1 text-xs font-bold">{run.answer.confidenceBand}</div></div><div><div className="mono text-[9px] text-[#c9c0b1]">EVIDENCE</div><div className="mt-1 text-xs font-bold">{run.answer.evidenceIds.length} cited</div></div><div><div className="mono text-[9px] text-[#c9c0b1]">RAG PATH</div><div className="mt-1 text-xs font-bold">{run.latency.ragMs} ms</div></div></div>{run.answer.refusalReason && <div className="mt-4 border-2 border-[#ffb293] p-3 text-sm text-[#ffb293]"><span className="mono text-[9px]">REFUSAL REASON</span><br />{run.answer.refusalReason}</div>}</> : outputProgress ? <div role="status" aria-live="polite" className="relative overflow-hidden border-2 border-[#ffb293] bg-[linear-gradient(135deg,rgba(255,90,31,0.15)_1px,transparent_1px)] bg-[size:14px_14px] p-5"><div className="absolute inset-x-0 top-0 flex gap-1 px-2 pt-2">{Array.from({ length: 22 }).map((_, index) => <span key={index} className={`h-1 flex-1 bg-[#ff5a1f] ${index % 3 === 0 ? "signal-pulse" : ""}`} style={{ opacity: index % 3 === 0 ? 1 : 0.34 }} />)}</div><Radio size={30} strokeWidth={1.5} className="mt-4 text-[#ff5a1f] signal-pulse" /><div className="mono mt-4 text-[9px] tracking-[0.15em] text-[#ffb293]">LIVE OUTPUT / {outputProgress.label}</div><p className="mt-2 text-lg font-bold">{outputProgress.title}</p><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#c9c0b1]">{outputProgress.detail}</p><div className="mt-5 grid grid-cols-3 gap-px bg-[#59534a] mono text-[8px] text-[#c9c0b1]"><span className={`p-2 ${outputProgress.activeStep >= 0 ? "bg-[#ff5a1f] text-[#1b1815]" : "bg-[#111111]"}`}>1 AUDIO</span><span className={`p-2 ${outputProgress.activeStep >= 1 ? "bg-[#ff5a1f] text-[#1b1815]" : "bg-[#111111]"}`}>2 TRANSCRIBE</span><span className={`p-2 ${outputProgress.activeStep >= 2 ? "bg-[#ff5a1f] text-[#1b1815]" : "bg-[#111111]"}`}>3 VERIFY</span></div></div> : <div className="relative overflow-hidden border-2 border-[#59534a] bg-[linear-gradient(135deg,rgba(255,90,31,0.12)_1px,transparent_1px)] bg-[size:14px_14px] p-5"><div className="absolute inset-x-0 top-0 flex gap-1 px-2 pt-2">{Array.from({ length: 22 }).map((_, index) => <span key={index} className="h-1 flex-1 bg-[#ff5a1f]" style={{ opacity: index % 3 === 0 ? 1 : 0.34 }} />)}</div><Radio size={30} strokeWidth={1.5} className="mt-4 text-[#ff5a1f]" /><div className="mono mt-4 text-[9px] tracking-[0.15em] text-[#ffb293]">SOURCE-BOUND OUTPUT / STANDBY</div><p className="mt-2 text-lg font-bold">No answer exists until the corpus supports one.</p><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#c9c0b1]">Speak to begin a real AI4Bharat/MSMARCO-XI evidence pass. The output remains intentionally blank rather than showing an invented demonstration.</p><div className="mt-5 grid grid-cols-3 gap-px bg-[#59534a] mono text-[8px] text-[#c9c0b1]"><span className="bg-[#111111] p-2">AUDIO</span><span className="bg-[#111111] p-2">EVIDENCE</span><span className="bg-[#111111] p-2">VERIFY</span></div></div>}</div>
          </aside>
        </section>

        <section className="suno-evidence-strip">
          <div className="grid gap-px bg-black lg:grid-cols-[210px_1fr_auto]">
            <div className="bg-[#111111] p-3 text-[#f4eedf]"><div className="mono text-[9px] tracking-[0.14em] text-[#ffb293]">EVIDENCE PATH</div><div className="mt-1 text-sm font-bold">{evidencePath.label}</div></div>
            <div className="bg-[#fbf7ed] p-3"><div className="mono text-[9px] text-[#5f584d]">DATASET-FIRST ROUTING</div><p className="mt-1 text-sm font-semibold leading-snug">{evidencePath.detail}</p></div>
            <div className={`p-3 text-center ${evidencePath.tone === "green" ? "bg-[#d8ecd7]" : evidencePath.tone === "blue" ? "bg-[#d9e6f8]" : evidencePath.tone === "orange" ? "bg-[#ffdbcc]" : evidencePath.tone === "red" ? "bg-[#ffc7bc]" : "bg-[#f4eedf]"}`}><div className="mono text-[9px]">{run ? `${run.evidence.length} CANDIDATES` : "NO RUN"}</div><div className="mt-1 text-sm font-bold">{run ? `${run.latency.ragMs} MS RAG` : "READY"}</div></div>
          </div>
        </section>

        <section className="suno-editorial-grid grid lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <div className="svara-panel-flat"><div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black p-4 sm:p-5"><div><div className="mono text-[10px] tracking-[0.15em] text-[#5f584d]">03 / RETRIEVED EVIDENCE</div><h2 className="display mt-1 text-xl font-bold tracking-[-0.04em]">Citations, not vibes.</h2></div>{run && <span className="mono border-2 border-black px-2 py-1 text-[10px]">{run.evidence.length} CANDIDATES</span>}</div><div className="p-4 sm:p-5">{run?.evidence.length ? <div className="grid gap-3">{run.evidence.map((evidence, index) => <article key={evidence.id} className={`border-2 border-black p-3 ${evidence.selected ? "bg-white" : "bg-[#f4eedf]"}`}><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex flex-wrap gap-1.5"><span className="mono border border-black bg-black px-1.5 py-0.5 text-[9px] text-white">E-{String(index + 1).padStart(2, "0")}</span><span className={`mono border border-black px-1.5 py-0.5 text-[9px] ${chunkStyles[evidence.strategy] || "bg-white"}`}>{evidence.strategy.replaceAll("_", " ")}</span></div>{evidence.selected && <span className="mono bg-[#d8ecd7] px-1.5 py-0.5 text-[9px] font-semibold">CITED</span>}</div><p className="mt-3 text-sm leading-relaxed">{evidence.text}</p><div className="mono mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#5f584d]"><span>LANG {evidence.language}</span><span>PARENT {evidence.parentId.slice(0, 10)}</span><span>OVERLAP {evidence.overlap}</span></div></article>)}</div> : <div className="relative overflow-hidden border-2 border-black bg-[#111111] p-4 text-[#f4eedf]"><div className="absolute inset-x-0 top-0 h-1 bg-[#ff5a1f]" /><div className="flex items-start justify-between gap-3"><div><div className="mono text-[10px] tracking-[0.16em] text-[#ffbca6]">EVIDENCE BAY / STANDBY</div><p className="mt-2 text-base font-bold">The corpus is sealed until a question is spoken.</p></div><Database size={24} className="shrink-0 text-[#ff5a1f]" /></div><div className="mt-4 grid gap-2 border-t border-[#5f584d] pt-3 mono text-[9px] text-[#d8d0c0] sm:grid-cols-3"><span>01 / CAPTURE AUDIO</span><span>02 / MATCH MSMARCO-XI</span><span>03 / CITE OR REFUSE</span></div><p className="mono mt-3 text-[9px] text-[#8f887a]">14 GROUNDED LANGUAGE SHARDS · LOCAL CACHE → QDRANT · NO SYNTHETIC CITATIONS</p></div>}</div></div>
          <div className="svara-panel-flat overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-black bg-[#ee5b2b] p-4 sm:p-5"><div><div className="mono text-[10px] tracking-[0.15em]">04 / LATENCY LEDGER</div><h2 className="display mt-1 text-xl font-bold tracking-[-0.04em]">Where the milliseconds went.</h2></div><button onClick={() => benchmark.mutate()} disabled={benchmark.isPending} className="brutal-button border-2 border-black bg-[#1b1815] px-3 py-2 mono text-[10px] font-bold text-[#f4eedf] disabled:opacity-60">{benchmark.isPending ? "AUDITING 115 CASES…" : "RUN 115-CASE AUDIT"}</button></div>
            <div className="p-4 sm:p-5">
              <div className="border-2 border-black bg-[#fbf7ed] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="mono text-[10px] font-bold tracking-[0.1em]">INTERNAL RETRIEVAL + ANSWER PATH</span><span className="mono text-[10px]">200 MS BUDGET</span></div>
                {activeLatencyBudget ? <>
                  <div className="relative mt-4 h-9 overflow-hidden border-2 border-black bg-[#fff8c9]">
                    <div className={`h-full ${activeLatencyBudget.underBudget ? "bg-[#0b6b44]" : "bg-[#d83522]"}`} style={{ width: `${Math.min(100, (activeLatencyBudget.internalMs / activeLatencyBudget.budgetMs) * 100)}%` }} />
                    <div className="absolute bottom-0 left-full top-0 -ml-px border-l-2 border-[#a33c16]" />
                  </div>
                  <div className="mt-2 flex justify-between mono text-[9px]"><span>0 MS</span><span>{activeLatencyBudget.budgetMs} MS TARGET</span></div>
                  <div className="mt-3 grid gap-2 border-t-2 border-black pt-3 text-sm"><div className="flex justify-between gap-4"><span>Query route + retrieval + fusion + rerank</span><strong>{activeLatencyBudget.retrievalMs} ms</strong></div><div className="flex justify-between gap-4"><span>Guardrails + evidence + verify + return</span><strong>{activeLatencyBudget.safetyMs} ms</strong></div><div className="flex justify-between gap-4"><span>Grounded answer assembly</span><strong>{activeLatencyBudget.answerMs} ms</strong></div><div className="flex justify-between gap-4 border-t-2 border-black pt-2 font-bold"><span>Internal RAG path</span><strong className={activeLatencyBudget.underBudget ? "text-[#0b6b44]" : "text-[#d83522]"}>{activeLatencyBudget.internalMs} ms · {activeLatencyBudget.underBudget ? "under 200 ms" : "over budget"}</strong></div></div>
                  <div className="mt-3 border-2 border-black bg-[#d8ecd7] p-2 mono text-[9px] leading-relaxed">{evidencePath.label} · {evidencePath.detail}</div>
                  <div className="mt-3 border-2 border-black bg-[#e9e0cf] p-2 mono text-[9px] leading-relaxed">SARVAM STT {activeLatencyBudget.sttMs} MS · REPORTED SEPARATELY · OUTSIDE THE INTERNAL RETRIEVAL BUDGET</div>
                </> : <div className="py-7 text-center"><Timer className="mx-auto" size={24} /><p className="mt-3 text-sm font-bold">Run a voice question to draw its exact internal latency ledger.</p><p className="mono mt-1 text-[9px] text-[#5f584d]">STT IS ALWAYS SHOWN SEPARATELY; THE 200 MS BUDGET IS NEVER APPLIED TO IT.</p></div>}
              </div>
              {benchmarkReport ? <div className="mt-3 border-2 border-black bg-[#f4eedf] p-3"><div className="mono text-[10px] font-bold">115-CASE INTERNAL PATH AUDIT</div><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5"><Metric label="P50 / warm" value={`${benchmarkReport.warm.p50} ms`} note={`${benchmarkReport.warm.sampleCount} samples`} /><Metric label="P70 / warm" value={`${benchmarkReport.warm.p70} ms`} note="post-transcription" /><Metric label="P90 / warm" value={`${benchmarkReport.warm.p90} ms`} note="tail latency" /><Metric label="P95 / warm" value={`${benchmarkReport.warm.p95} ms`} note="tail latency" /><Metric label="P100 / warm" value={`${benchmarkReport.warm.p100} ms`} note={`${benchmarkReport.warm.failureCount} failures`} /></div><div className="mono mt-2 text-[9px] leading-relaxed">{benchmarkReport.datasetQueryCount} REAL MSMARCO-XI QUERIES + {benchmarkReport.adversarialQueryCount} ADVERSARIAL CASES · TARGET &lt;{benchmarkReport.postTranscriptionTargetMs}MS</div></div> : <div className="mt-3 mono text-[9px] leading-relaxed">RUN THE 115-CASE AUDIT TO SEE P50 / P70 / P90 / P95 / P100 FOR THE POST-TRANSCRIPTION INTERNAL PATH. NO STATIC LATENCY IS INVENTED.</div>}
            </div>
          </div>
        </section>

        <section className="suno-editorial-grid grid xl:grid-cols-[1.25fr_.75fr]">
          <div className="brutal-border bg-[#fbf7ed]"><button onClick={() => setTraceOpen(value => !value)} className="brutal-button flex w-full items-center justify-between p-4 text-left sm:p-5"><span><span className="mono text-[10px] tracking-[0.15em] text-[#5f584d]">05 / HARNESS TRACE</span><span className="mt-1 block text-xl font-bold tracking-[-0.04em]">Structured execution — tools, retries, gates.</span></span><ChevronDown className={`transition-transform ${traceOpen ? "rotate-180" : ""}`} /></button>{traceOpen && <div className="border-t-2 border-black p-3 sm:p-5">{run ? <div className="overflow-x-auto"><div className="min-w-[680px]"><div className="grid grid-cols-[180px_90px_90px_1fr] border-b-2 border-black pb-2 mono text-[10px] font-bold"><span>STAGE</span><span>STATUS</span><span>TIME</span><span>DETAIL</span></div>{run.trace.map(event => <div key={`${event.stage}-${event.durationMs}`} className="grid grid-cols-[180px_90px_90px_1fr] border-b border-black py-2 mono text-[10px]"><span>{event.stage}</span><span className={event.status === "ERROR" ? "text-[#d83522]" : event.status === "REFUSED" ? "text-[#c44215]" : ""}>{event.status}</span><span>{event.durationMs}ms</span><span className="text-[#5f584d]">{event.detail}</span></div>)}</div></div> : <div className="border-2 border-black bg-[#f4eedf] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="mono text-[10px] font-bold tracking-[0.14em]">AUDIT RAIL / ARMED</div><p className="mt-1 text-sm font-bold">Fourteen guarded stages are ready to make their record.</p></div><span className="mono border-2 border-black bg-[#d8ecd7] px-2 py-1 text-[9px]">NO RUN YET</span></div><div className="mt-4 grid gap-2 border-t-2 border-black pt-3 mono text-[9px] text-[#5f584d] sm:grid-cols-4"><span>VALIDATE AUDIO</span><span>TRANSCRIBE</span><span>RETRIEVE EVIDENCE</span><span>VERIFY &amp; RETURN</span></div><p className="mono mt-3 text-[9px] text-[#5f584d]">A trace is emitted for every outcome, including evidence refusals and recovery paths.</p></div>}</div>}</div>
          <div className="brutal-border bg-[#e9e0cf]"><div className="border-b-2 border-black p-4 sm:p-5"><div className="mono text-[10px] tracking-[0.15em] text-[#5f584d]">06 / METHOD & INDEX</div><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">No black boxes.</h2></div><div className="space-y-4 p-4 sm:p-5"><div><div className="mono text-[9px] text-[#5f584d]">SOURCE</div><div className="mt-1 flex items-center gap-2 text-sm font-bold"><FileText size={15} /> ai4bharat/MSMARCO-XI</div></div><div><div className="mono text-[9px] text-[#5f584d]">CHUNK FAMILIES</div><div className="mt-2 flex flex-wrap gap-1.5">{["semantic sentence window", "paragraph / section", "answer centered", "fixed fallback", "query linked eval"].map(strategy => <span key={strategy} className="border border-black bg-[#fbf7ed] px-1.5 py-1 text-[10px] font-semibold">{strategy}</span>)}</div></div><div><div className="mono text-[9px] text-[#5f584d]">RETRIEVAL</div><div className="mt-1 text-sm font-bold">L1 local dense + lexical cache, then Qdrant L2; RRF fusion and parent-level dedupe</div></div>{indexStatus?.manifest && <div className="border-2 border-black bg-[#f4eedf] p-2.5"><div className="mono text-[9px] font-bold">INGESTION MANIFEST / AUDITABLE</div><div className="mono mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]"><span>REV {indexStatus.manifest.datasetRevision}</span><span>INDEX {indexStatus.manifest.indexVersion}</span><span>LANG {indexStatus.manifest.languages.join(" / ")}</span><span>BUILD {new Date(indexStatus.manifest.buildTimestamp).toISOString().slice(0, 10)}</span></div><div className="mono mt-2 border-t border-black pt-2 text-[9px]">ROWS {Object.entries(indexStatus.manifest.rowCounts).map(([language, rows]) => `${language}:${rows}`).join(" • ")}</div></div>}<div className="border-t-2 border-black pt-3"><div className="flex items-center gap-2"><ShieldCheck size={16} /><span className="mono text-[10px] font-bold">FAIL-CLOSED GUARDRAILS</span></div><p className="mt-1 text-xs leading-relaxed">Unsafe inputs, off-scope prompts, retrieval failure, low evidence, and unsupported synthesis return REFUSED or ERROR—not a guess.</p></div><div className="flex items-start gap-2 border-2 border-black bg-[#f4eedf] p-2.5"><Zap size={15} className="mt-0.5 shrink-0 text-[#ff5a1f]" /><span className="mono text-[10px] leading-relaxed">{indexStatus ? `INDEX ${indexStatus.health} / ${indexStatus.points} POINTS / ${indexStatus.collection} • ${indexStatus.mode}` : "CHECKING LIVE INDEX STATE…"}</span></div></div></div>
        </section>
      </main>
      <footer className="border-t-[3px] border-black bg-[#111111] px-4 py-3 text-[#f4eedf] sm:px-6 lg:px-8"><div className="mx-auto flex max-w-[1540px] flex-wrap justify-between gap-x-6 gap-y-1 mono text-[10px]"><span>REAL AUDIO → SERVER-ONLY STT → QDRANT RETRIEVAL → GROUNDED RESPONSE</span><span>NO RAW AUDIO PERSISTENCE • INDEX VERSION: {indexStatus?.manifest?.indexVersion || "CHECKING"}</span></div></footer>
    </div>
  );
}
