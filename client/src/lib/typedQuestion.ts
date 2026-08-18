export function normalizeTypedQuestion(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function validateTypedQuestion(value: string): string | null {
  const question = normalizeTypedQuestion(value);
  if (!question) return "Type a question before submitting it to the evidence harness.";
  if (question.length > 2_000) return "Keep the typed question below 2,000 characters.";
  return null;
}
