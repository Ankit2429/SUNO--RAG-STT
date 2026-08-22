async function main() {
  const url = "https://suno-rag-stt.onrender.com/api/trpc/voiceRag.askBrowserTranscript";
  
  // Format A: direct JSON
  console.log("Testing Format A (direct object)...");
  let t0 = Date.now();
  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript: "What is a corporation?", languageCode: "en-IN", script: "typed-input" })
  });
  console.log("Format A status:", res.status, "in", Date.now() - t0, "ms");
  let json = await res.json().catch(() => null);
  console.log("Format A response:", JSON.stringify(json, null, 2));

  // Format B: tRPC json wrapper { json: { ... } }
  console.log("\nTesting Format B ({ json: { ... } })...");
  t0 = Date.now();
  res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: { transcript: "What is a corporation?", languageCode: "en-IN", script: "typed-input" } })
  });
  console.log("Format B status:", res.status, "in", Date.now() - t0, "ms");
  json = await res.json().catch(() => null);
  console.log("Format B response:", JSON.stringify(json, null, 2));
}

main().catch(console.error);
