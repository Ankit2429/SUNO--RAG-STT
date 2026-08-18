/**
 * Browser-level microphone lifecycle check. Chromium receives a local WAV file as
 * its fake audio device, then exercises the exact UI record → stop → send path.
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const origin = process.env.VOICE_RAG_ORIGIN || "https://3000-ifb42uuseuk387yx2srv1-323c3b4d.us3.manus.computer";
const fixture = process.env.FAKE_MIC_AUDIO || "/home/ubuntu/voice-benchmark/hindi.wav";
const cycles = Number(process.env.RECORDING_CYCLES || 2);
const debugPort = Number(process.env.BROWSER_DEBUG_PORT || 9334);
const profileDirectory = `/tmp/hh-goa-mic-cycle-${process.pid}`;

async function waitForPage() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const page = (await response.json()).find(candidate => candidate.type === "page" && candidate.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* Chromium is still launching. */ }
    await delay(100);
  }
  throw new Error("Chromium DevTools did not become available.");
}

async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not open Chromium DevTools.")), { once: true });
  });
  socket.addEventListener("message", event => {
    const message = JSON.parse(String(event.data));
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    request.resolve(message);
  });
  return {
    async send(method, params = {}) {
      const id = ++nextId;
      const result = new Promise(resolve => pending.set(id, { resolve }));
      socket.send(JSON.stringify({ id, method, params }));
      const message = await result;
      if (message.error) throw new Error(`${method}: ${message.error.message}`);
      return message.result;
    },
    close: () => socket.close(),
  };
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  return result.result.value;
}

async function waitFor(client, predicate, timeoutMs = 40_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evaluate(client, predicate);
    if (value) return value;
    await delay(250);
  }
  throw new Error("Timed out waiting for the microphone UI to finish processing.");
}

const browser = spawn("chromium", [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
  `--use-file-for-fake-audio-capture=${fixture}`,
  "--remote-allow-origins=*", `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDirectory}`, origin,
], { stdio: "ignore", detached: true });

let client;
try {
  const page = await waitForPage();
  client = await connect(page.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.navigate", { url: origin });
  await delay(1_000);
  await evaluate(client, `(() => { const select = document.querySelector('#voice-language'); select.value = 'hi-IN'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const results = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    await evaluate(client, `(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('START RECORDING'))?.click())()`);
    await waitFor(client, `document.body.innerText.includes('RECORDING')`, 8_000);
    await delay(1_200);
    await evaluate(client, `(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('STOP & SEND'))?.click())()`);
    const state = await waitFor(client, `(() => { const output = [...document.querySelectorAll('aside')].find(node => node.innerText.includes('STRUCTURED OUTPUT'))?.innerText || ''; const complete = !output.includes('AWAITING VOICE') && (output.includes('GROUNDED') || output.includes('REFUSED') || output.includes('ERROR')); if (!complete) return null; const error = [...document.querySelectorAll('div')].find(node => node.children.length === 2 && node.innerText.startsWith('CAPTURE / PIPELINE ERROR'))?.innerText || null; return { error: Boolean(error), errorDetail: error ? error.slice(0, 320) : null, state: output.includes('ERROR') ? 'ERROR' : output.includes('GROUNDED') ? 'GROUNDED' : 'REFUSED', output: output.slice(0, 520) }; })()`);
    results.push({ cycle, ...state });
  }
  const report = { benchmark: "browser MediaRecorder record-stop-send lifecycle", origin, fixture, cycles, results, passed: results.every(result => !result.error && result.state !== "ERROR"), measuredAt: new Date().toISOString() };
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally {
  client?.close();
  if (browser.pid) {
    try { process.kill(-browser.pid, "SIGTERM"); } catch { browser.kill("SIGTERM"); }
  }
  await rm(profileDirectory, { recursive: true, force: true }).catch(() => undefined);
}
