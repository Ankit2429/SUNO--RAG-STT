import { createHash } from "node:crypto";
import type { RAGRun } from "@shared/rag";

type CacheEntry = {
  expiresAt: number;
  storedAt: number;
  run: RAGRun;
};

type CacheHit = {
  ageMs: number;
  run: RAGRun;
};

function cloneRun(run: RAGRun): RAGRun {
  return structuredClone(run);
}

/**
 * A bounded process-local cache for exact typed requests. Keys are SHA-256
 * digests, audio is never cached, and entries expire quickly to avoid using
 * stale evidence after an index refresh.
 */
export class TypedResponseCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly ttlMs = 300_000,
    private readonly maxEntries = 1024,
    private readonly now = () => Date.now(),
  ) {}

  private keyFor(transcript: string, languageCode: string) {
    const normalized = transcript.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
    return createHash("sha256").update(`${languageCode}\u0000${normalized}`).digest("hex");
  }

  get(transcript: string, languageCode: string): CacheHit | null {
    const key = this.keyFor(transcript, languageCode);
    const entry = this.entries.get(key);
    if (!entry) return null;

    const current = this.now();
    if (entry.expiresAt <= current) {
      this.entries.delete(key);
      return null;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return { ageMs: Math.max(0, current - entry.storedAt), run: cloneRun(entry.run) };
  }

  set(transcript: string, languageCode: string, run: RAGRun) {
    if (run.answer.status !== "GROUNDED") return;

    const current = this.now();
    const key = this.keyFor(transcript, languageCode);
    this.entries.delete(key);
    this.entries.set(key, {
      storedAt: current,
      expiresAt: current + this.ttlMs,
      run: cloneRun(run),
    });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }

  clear() {
    this.entries.clear();
  }
}

export const typedResponseCache = new TypedResponseCache();
