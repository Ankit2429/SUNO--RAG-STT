import { trpc } from "@/lib/trpc";
import type { RAGRun } from "@shared/rag";
import { Activity, AudioLines, ChevronDown, CircleStop, Database, FileText, Mic, Radio, ShieldCheck, Timer, TriangleAlert, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type BenchmarkState = {
  queryCount: number;
  cold: { p50: number; p70: number; p100: number; sampleCount: number; failureCount: number };
  warm: { p50: number; p70: number; p100: number; sampleCount: number; failureCount: number };
  postTranscriptionTargetMs: number;
  datasetQueryCount: number;
  adversarialQueryCount: number;
  cacheDefinition: string;
};

type BrowserRecognitionEvent = { results: { [index: number]: { [index: number]: { transcript: string } } } };
type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
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
  const styles = status === "GROUNDED" ? "bg-[#d8ecd7]" : status === "REFUSED" ? "bg-[#ffdbcc]" : "bg-[#ffc7bc]";
  return <span className={`inline-flex border-2 border-black px-2 py-1 text-xs font-bold tracking-[0.18em] ${styles}`}>{status}</span>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="border-b-2 border-black py-3 last:border-b-0"><div className="mono text-[10px] uppercase tracking-[0.14em] text-[#5f584d]">{label}</div><div className="mt-1 text-2xl font-bold leading-none">{value}</div><div className="mono mt-2 text-[10px] text-[#5f584d]">{note}</div></div>;
}

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [browserListening, setBrowserListening] = useState(false);
  const [level, setLevel] = useState(0.12);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [run, setRun] = useState<RAGRun | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [benchmarkReport, setBenchmarkReport] = useState<BenchmarkState | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const { data: indexStatus } = trpc.voiceRag.indexStatus.useQuery(undefined, { refetchOnWindowFocus: false });
  const ask = trpc.voiceRag.ask.useMutation({
    onSuccess: response => setRun(response),
    onError: error => setCaptureError(error.message || "The server rejected the voice request."),
  });
  const askBrowserTranscript = trpc.voiceRag.askBrowserTranscript.useMutation({
    onSuccess: response => setRun(response),
    onError: error => setCaptureError(error.message || "The browser transcription could not be evaluated."),
  });
  const benchmark = trpc.voiceRag.benchmark.useMutation({
    onSuccess: report => setBenchmarkReport(report),
    onError: error => setCaptureError(error.message || "The benchmark harness could not complete."),
  });

  const waveform = useMemo(() => Array.from({ length: 31 }, (_, index) => {
    const distance = Math.abs(index - 15) / 16;
    return Math.max(8, (1 - distance) * 46 * (0.34 + level * 0.9));
  }), [level]);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    void audioContextRef.current?.close();
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
    setCaptureError(null);
    setRun(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setCaptureError("This browser does not support real microphone capture. Try a current Chrome, Edge, or Firefox build.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const context = new AudioContext();
      audioContextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const pulse = () => { analyser.getByteTimeDomainData(data); const mean = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length; setLevel(Math.min(1, mean / 36)); frameRef.current = requestAnimationFrame(pulse); };
      pulse();
      const preferred = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: preferred, audioBitsPerSecond: 48_000 });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        setRecording(false);
        stopVisualizer();
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (!blob.size) { setCaptureError("No audio was captured. Please allow microphone access and try again."); return; }
        if (blob.size > 4 * 1024 * 1024) { setCaptureError("Recording is too large for the short-audio safety limit. Keep the clip under 30 seconds."); return; }
        try { ask.mutate({ audioBase64: await toBase64(blob), mimeType, languageHint: "unknown" }); }
        catch (error) { setCaptureError(error instanceof Error ? error.message : "Audio encoding failed."); }
      };
      recorder.start(250);
      setRecording(true);
    } catch (error) { stopVisualizer(); setCaptureError(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone permission was denied. Enable it in your browser settings and retry." : "Microphone capture could not be started."); }
  };

  const stopRecording = () => recorderRef.current?.state === "recording" && recorderRef.current.stop();

  const startBrowserFallback = () => {
    setCaptureError(null);
    setRun(null);
    const Recognition = browserRecognitionConstructor();
    if (!Recognition) {
      setCaptureError("This browser does not provide native speech recognition. Use the Sarvam microphone route in a current supported browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) askBrowserTranscript.mutate({ transcript, languageCode: "unknown", script: "browser-native" });
    };
    recognition.onerror = event => setCaptureError(`Browser speech recognition stopped: ${event.error}.`);
    recognition.onend = () => setBrowserListening(false);
    recognitionRef.current = recognition;
    setBrowserListening(true);
    recognition.start();
  };

  return (
    <div className="min-h-screen bg-[#f4eedf] text-[#111111]">
      <header className="border-b-[3px] border-black bg-[#f4eedf] px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center border-2 border-black bg-[#ff5a1f]"><AudioLines size={22} strokeWidth={2.7} /></div><div><div className="mono text-[10px] font-semibold tracking-[0.14em]">HH GOA 2026 / TASK 112</div><div className="text-sm font-bold tracking-tight">VOICE RAG EVALUATOR</div></div></div>
          <div className="hidden items-center gap-3 md:flex"><span className="mono text-[10px] uppercase tracking-[0.12em]">zero-cost evaluation profile</span><span className="h-2.5 w-2.5 bg-[#ff5a1f] signal-pulse" /><span className="mono text-[10px]">SERVER ONLINE</span></div>
        </div>
      </header>

      <main className="mx-auto max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><div className="mono mb-2 text-[11px] font-semibold tracking-[0.2em] text-[#ff5a1f]">VOICE → EVIDENCE → ANSWER</div><h1 className="max-w-4xl text-4xl font-bold leading-[0.88] tracking-[-0.065em] sm:text-6xl xl:text-7xl">ASK OUT LOUD.<br />GET ONLY WHAT<br /><span className="bg-[#ff5a1f] px-2">THE INDEX SUPPORTS.</span></h1></div>
          <div className="brutal-border bg-[#111111] p-3 text-[#f4eedf] lg:w-[300px]"><div className="mono text-[10px] uppercase tracking-[0.14em] text-[#ffb293]">non-negotiable rule</div><div className="mt-1 text-sm font-semibold leading-tight">No evidence, no answer.<br />No exceptions.</div></div>
        </div>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.75fr)]">
          <div className="brutal-border brutal-shadow bg-[#fbf7ed]">
            <div className="flex items-start justify-between gap-4 border-b-2 border-black p-4 sm:p-5"><div><div className="mono text-[10px] font-semibold tracking-[0.15em] text-[#5f584d]">01 / LIVE INPUT</div><h2 className="mt-1 text-2xl font-bold tracking-[-0.04em]">Speak the question</h2></div><div className="flex items-center gap-2 border-2 border-black bg-[#f4eedf] px-2.5 py-1.5"><span className={`h-2.5 w-2.5 ${recording ? "bg-[#ff5a1f] signal-pulse" : "bg-[#111111]"}`} /><span className="mono text-[10px] font-semibold">{recording ? "RECORDING" : ask.isPending ? "PROCESSING" : "READY"}</span></div></div>
            <div className="p-4 sm:p-5">
              <div className="grid min-h-[270px] place-items-center border-2 border-dashed border-black bg-[#f4eedf] p-5 text-center">
                <div className="w-full max-w-xl"><div className="mb-6 flex h-20 items-center justify-center gap-[3px]" aria-label="Live audio level">{waveform.map((height, index) => <span key={index} className={`w-1.5 ${recording ? "bg-[#ff5a1f]" : "bg-black"}`} style={{ height: `${height}px`, opacity: recording ? 0.55 + level * 0.45 : 0.28 + (index % 4) * 0.1 }} />)}</div><div className="mono text-[11px] uppercase tracking-[0.14em] text-[#5f584d]">{recording ? "capturing real browser audio — stop when complete" : "microphone capture • ≤30 seconds • server-side transcription"}</div><div className="mt-5 flex justify-center">{recording ? <button onClick={stopRecording} className="brutal-button brutal-border brutal-shadow-sm flex items-center gap-2 bg-[#111111] px-5 py-3 text-sm font-bold text-[#f4eedf]"><CircleStop size={18} /> STOP & SEND</button> : <button onClick={startRecording} disabled={ask.isPending} className="brutal-button brutal-border brutal-shadow-sm flex items-center gap-2 bg-[#ff5a1f] px-5 py-3 text-sm font-bold disabled:opacity-50"><Mic size={18} /> {ask.isPending ? "RUNNING HARNESS" : "HOLD TO SPEAK"}</button>}</div></div>
              </div>
              {captureError && <div className="mt-4 flex gap-2 border-2 border-black bg-[#ffc7bc] p-3"><TriangleAlert className="mt-0.5 shrink-0" size={17} /><div><div className="mono text-[10px] font-bold tracking-[0.12em]">CAPTURE / PIPELINE ERROR</div><p className="mt-1 text-sm leading-snug">{captureError}</p></div></div>}
              <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3"><div className="border-2 border-black p-2.5"><span className="mono text-[9px] text-[#5f584d]">PRIMARY STT</span><div className="mt-1 font-bold">Sarvam / server-only</div></div><div className="border-2 border-black p-2.5"><span className="mono text-[9px] text-[#5f584d]">PRIVACY</span><div className="mt-1 font-bold">Audio not stored</div></div><div className="border-2 border-black p-2.5"><span className="mono text-[9px] text-[#5f584d]">RETRY POLICY</span><div className="mt-1 font-bold">3 bounded attempts</div></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-[#e9e0cf] p-2.5"><span className="mono text-[9px] leading-relaxed">ZERO-COST FALLBACK: BROWSER-NATIVE SPEECH RECOGNITION → SAME FAIL-CLOSED HARNESS</span><button onClick={startBrowserFallback} disabled={recording || ask.isPending || askBrowserTranscript.isPending || browserListening} className="brutal-button border-2 border-black bg-[#f4eedf] px-2.5 py-1.5 mono text-[9px] font-bold disabled:opacity-60">{browserListening ? "LISTENING…" : askBrowserTranscript.isPending ? "CHECKING…" : "USE FREE FALLBACK"}</button></div>
            </div>
          </div>

          <aside className="brutal-border bg-[#111111] text-[#f4eedf]"><div className="border-b-2 border-[#f4eedf] p-4 sm:p-5"><div className="mono text-[10px] tracking-[0.15em] text-[#ffb293]">02 / STRUCTURED OUTPUT</div><div className="mt-3 flex items-center justify-between gap-3">{run ? <StatusStamp status={run.answer.status} /> : <span className="border-2 border-[#f4eedf] px-2 py-1 text-xs font-bold tracking-[0.18em]">AWAITING VOICE</span>}<span className="mono text-[10px]">{run ? `REQ ${run.requestId.slice(0, 8)}` : "NO RUN"}</span></div></div><div className="p-4 sm:p-5">{run ? <><div className="mono text-[10px] uppercase tracking-[0.12em] text-[#c9c0b1]">transcript / {run.detectedLanguage} / {run.detectedScript}</div><p className="mt-2 border-l-2 border-[#ff5a1f] pl-3 text-sm leading-relaxed text-[#f4eedf]">{run.transcript}</p><div className="mt-6 mono text-[10px] uppercase tracking-[0.12em] text-[#c9c0b1]">answer</div><p className="mt-2 text-lg font-medium leading-snug">{run.answer.answer}</p><div className="mt-5 grid grid-cols-3 gap-2 border-t-2 border-[#f4eedf] pt-4"><div><div className="mono text-[9px] text-[#c9c0b1]">CONFIDENCE</div><div className="mt-1 text-xs font-bold">{run.answer.confidenceBand}</div></div><div><div className="mono text-[9px] text-[#c9c0b1]">EVIDENCE</div><div className="mt-1 text-xs font-bold">{run.answer.evidenceIds.length} cited</div></div><div><div className="mono text-[9px] text-[#c9c0b1]">RAG PATH</div><div className="mt-1 text-xs font-bold">{run.latency.ragMs} ms</div></div></div>{run.answer.refusalReason && <div className="mt-4 border-2 border-[#ffb293] p-3 text-sm text-[#ffb293]"><span className="mono text-[9px]">REFUSAL REASON</span><br />{run.answer.refusalReason}</div>}</> : <div className="py-11"><Radio size={30} strokeWidth={1.5} className="text-[#ff5a1f]" /><p className="mt-4 text-lg font-bold">The answer panel is deliberately empty.</p><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#c9c0b1]">Record a question to activate the server-side harness. This console never fills the panel with invented demo answers.</p></div>}</div></aside>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <div className="brutal-border bg-[#fbf7ed]"><div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black p-4 sm:p-5"><div><div className="mono text-[10px] tracking-[0.15em] text-[#5f584d]">03 / RETRIEVED EVIDENCE</div><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Citations, not vibes.</h2></div>{run && <span className="mono border-2 border-black px-2 py-1 text-[10px]">{run.evidence.length} CANDIDATES</span>}</div><div className="p-4 sm:p-5">{run?.evidence.length ? <div className="grid gap-3">{run.evidence.map((evidence, index) => <article key={evidence.id} className={`border-2 border-black p-3 ${evidence.selected ? "bg-white" : "bg-[#f4eedf]"}`}><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex flex-wrap gap-1.5"><span className="mono border border-black bg-black px-1.5 py-0.5 text-[9px] text-white">E-{String(index + 1).padStart(2, "0")}</span><span className={`mono border border-black px-1.5 py-0.5 text-[9px] ${chunkStyles[evidence.strategy] || "bg-white"}`}>{evidence.strategy.replaceAll("_", " ")}</span></div>{evidence.selected && <span className="mono bg-[#d8ecd7] px-1.5 py-0.5 text-[9px] font-semibold">CITED</span>}</div><p className="mt-3 text-sm leading-relaxed">{evidence.text}</p><div className="mono mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#5f584d]"><span>LANG {evidence.language}</span><span>PARENT {evidence.parentId.slice(0, 10)}</span><span>OVERLAP {evidence.overlap}</span></div></article>)}</div> : <div className="border-2 border-dashed border-black p-6 text-center"><Database size={25} className="mx-auto" /><p className="mt-3 font-bold">Evidence is shown only after retrieval.</p><p className="mono mt-1 text-[10px] text-[#5f584d]">QDRANT DENSE + LEXICAL → RRF → DEDUPE → EVIDENCE GATE</p></div>}</div></div>
          <div className="brutal-border bg-[#ff5a1f]"><div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-black p-4 sm:p-5"><div><div className="mono text-[10px] tracking-[0.15em]">04 / PIPELINE LATENCY</div><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Measure, don’t claim.</h2></div><button onClick={() => benchmark.mutate()} disabled={benchmark.isPending} className="brutal-button border-2 border-black bg-[#111111] px-3 py-2 mono text-[10px] font-bold text-[#f4eedf] disabled:opacity-60">{benchmark.isPending ? "AUDITING 115 CASES…" : "RUN 115-CASE AUDIT"}</button></div>{benchmarkReport ? <div className="p-4 sm:p-5"><div className="grid gap-3"><div className="border-2 border-black bg-[#f4eedf] p-3"><div className="mono text-[10px] font-bold">COLD / FIRST PROCESS-LOCAL PASS</div><div className="mt-2 grid grid-cols-3 gap-2"><Metric label="P50" value={`${benchmarkReport.cold.p50} ms`} note={`${benchmarkReport.cold.sampleCount} samples`} /><Metric label="P70" value={`${benchmarkReport.cold.p70} ms`} note="post-transcription" /><Metric label="P100" value={`${benchmarkReport.cold.p100} ms`} note={`${benchmarkReport.cold.failureCount} failures`} /></div></div><div className="border-2 border-black bg-[#f4eedf] p-3"><div className="mono text-[10px] font-bold">WARM / REPEATED PROCESS-LOCAL PASS</div><div className="mt-2 grid grid-cols-3 gap-2"><Metric label="P50" value={`${benchmarkReport.warm.p50} ms`} note={`${benchmarkReport.warm.sampleCount} samples`} /><Metric label="P70" value={`${benchmarkReport.warm.p70} ms`} note="post-transcription" /><Metric label="P100" value={`${benchmarkReport.warm.p100} ms`} note={`${benchmarkReport.warm.failureCount} failures`} /></div></div></div><div className="mono mt-3 text-[9px] leading-relaxed">{benchmarkReport.datasetQueryCount} REAL MSMARCO-XI QUERIES + {benchmarkReport.adversarialQueryCount} ADVERSARIAL CASES • TARGET &lt;{benchmarkReport.postTranscriptionTargetMs}MS • {benchmarkReport.cacheDefinition}</div>{run && <div className="mt-3 border-t-2 border-black pt-3 mono text-[10px]">LAST VOICE RUN: STT {run.latency.sttMs}MS / RAG {run.latency.ragMs}MS / END-TO-END {run.latency.endToEndMs}MS</div>}</div> : <div className="p-4 sm:p-5"><div className="grid sm:grid-cols-3"><Metric label="P50 / cold" value="—" note="run 115-case audit" /><Metric label="P70 / warm" value="—" note="no fabricated stats" /><Metric label="P100 / warm" value="—" note="separate cache pass" /></div><div className="border-t-2 border-black pt-4"><div className="mono text-[10px] font-semibold">BENCHMARK CONTRACT</div><p className="mt-1 text-xs leading-relaxed">100 genuine language-balanced MSMARCO-XI query cases plus 15 adversarial cases. Cold and warm process-local passes are separate; failures remain in the report.</p></div></div>}</div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <div className="brutal-border bg-[#fbf7ed]"><button onClick={() => setTraceOpen(value => !value)} className="brutal-button flex w-full items-center justify-between p-4 text-left sm:p-5"><span><span className="mono text-[10px] tracking-[0.15em] text-[#5f584d]">05 / HARNESS TRACE</span><span className="mt-1 block text-xl font-bold tracking-[-0.04em]">Structured execution — tools, retries, gates.</span></span><ChevronDown className={`transition-transform ${traceOpen ? "rotate-180" : ""}`} /></button>{traceOpen && <div className="border-t-2 border-black p-3 sm:p-5">{run ? <div className="overflow-x-auto"><div className="min-w-[680px]"><div className="grid grid-cols-[180px_90px_90px_1fr] border-b-2 border-black pb-2 mono text-[10px] font-bold"><span>STAGE</span><span>STATUS</span><span>TIME</span><span>DETAIL</span></div>{run.trace.map(event => <div key={`${event.stage}-${event.durationMs}`} className="grid grid-cols-[180px_90px_90px_1fr] border-b border-black py-2 mono text-[10px]"><span>{event.stage}</span><span className={event.status === "ERROR" ? "text-[#d83522]" : event.status === "REFUSED" ? "text-[#c44215]" : ""}>{event.status}</span><span>{event.durationMs}ms</span><span className="text-[#5f584d]">{event.detail}</span></div>)}</div></div> : <div className="mono py-3 text-[11px] text-[#5f584d]">Run a voice query to reveal all 14 exact harness stages, including skipped paths on a refusal or error.</div>}</div>}</div>
          <div className="brutal-border bg-[#e9e0cf]"><div className="border-b-2 border-black p-4 sm:p-5"><div className="mono text-[10px] tracking-[0.15em] text-[#5f584d]">06 / METHOD & INDEX</div><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">No black boxes.</h2></div><div className="space-y-4 p-4 sm:p-5"><div><div className="mono text-[9px] text-[#5f584d]">SOURCE</div><div className="mt-1 flex items-center gap-2 text-sm font-bold"><FileText size={15} /> ai4bharat/MSMARCO-XI</div></div><div><div className="mono text-[9px] text-[#5f584d]">CHUNK FAMILIES</div><div className="mt-2 flex flex-wrap gap-1.5">{["semantic sentence window", "paragraph / section", "answer centered", "fixed fallback", "query linked eval"].map(strategy => <span key={strategy} className="border border-black bg-[#fbf7ed] px-1.5 py-1 text-[10px] font-semibold">{strategy}</span>)}</div></div><div><div className="mono text-[9px] text-[#5f584d]">RETRIEVAL</div><div className="mt-1 text-sm font-bold">L1 local dense + lexical cache, then Qdrant L2; RRF fusion and parent-level dedupe</div></div>{indexStatus?.manifest && <div className="border-2 border-black bg-[#f4eedf] p-2.5"><div className="mono text-[9px] font-bold">INGESTION MANIFEST / AUDITABLE</div><div className="mono mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]"><span>REV {indexStatus.manifest.datasetRevision}</span><span>INDEX {indexStatus.manifest.indexVersion}</span><span>LANG {indexStatus.manifest.languages.join(" / ")}</span><span>BUILD {new Date(indexStatus.manifest.buildTimestamp).toISOString().slice(0, 10)}</span></div><div className="mono mt-2 border-t border-black pt-2 text-[9px]">ROWS {Object.entries(indexStatus.manifest.rowCounts).map(([language, rows]) => `${language}:${rows}`).join(" • ")}</div></div>}<div className="border-t-2 border-black pt-3"><div className="flex items-center gap-2"><ShieldCheck size={16} /><span className="mono text-[10px] font-bold">FAIL-CLOSED GUARDRAILS</span></div><p className="mt-1 text-xs leading-relaxed">Unsafe inputs, off-scope prompts, retrieval failure, low evidence, and unsupported synthesis return REFUSED or ERROR—not a guess.</p></div><div className="flex items-start gap-2 border-2 border-black bg-[#f4eedf] p-2.5"><Zap size={15} className="mt-0.5 shrink-0 text-[#ff5a1f]" /><span className="mono text-[10px] leading-relaxed">{indexStatus ? `INDEX ${indexStatus.health} / ${indexStatus.points} POINTS / ${indexStatus.collection} • ${indexStatus.mode}` : "CHECKING LIVE INDEX STATE…"}</span></div></div></div>
        </section>
      </main>
      <footer className="border-t-[3px] border-black bg-[#111111] px-4 py-3 text-[#f4eedf] sm:px-6 lg:px-8"><div className="mx-auto flex max-w-[1540px] flex-wrap justify-between gap-x-6 gap-y-1 mono text-[10px]"><span>REAL AUDIO → SERVER-ONLY STT → QDRANT RETRIEVAL → GROUNDED RESPONSE</span><span>NO RAW AUDIO PERSISTENCE • INDEX VERSION: EVAL-V1</span></div></footer>
    </div>
  );
}
