async function main() {
  const res = await fetch("https://suno-rag-stt.onrender.com");
  const html = await res.text();
  console.log("HTML length:", html.length);
  const jsMatch = html.match(/\/assets\/index-[^"]+\.js/);
  console.log("JS bundle on Render:", jsMatch ? jsMatch[0] : "none");
  if (jsMatch) {
    const jsRes = await fetch("https://suno-rag-stt.onrender.com" + jsMatch[0]);
    const js = await jsRes.text();
    console.log("JS length:", js.length);
    console.log("Contains tip text?", js.includes("Select your spoken language for better transcription"));
  }
}
main().catch(console.error);
