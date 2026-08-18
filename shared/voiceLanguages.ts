export const SARVAM_LANGUAGE_CODES = [
  "en-IN",
  "hi-IN",
  "bn-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "od-IN",
  "pa-IN",
  "ta-IN",
  "te-IN",
  "gu-IN",
  "as-IN",
  "ur-IN",
  "ne-IN",
  "kok-IN",
  "ks-IN",
  "sd-IN",
  "sa-IN",
  "sat-IN",
  "mni-IN",
  "brx-IN",
  "mai-IN",
  "doi-IN",
] as const;

export type SarvamLanguageCode = (typeof SARVAM_LANGUAGE_CODES)[number];

/** The five-language SvaraProof evaluator scope requested for the live voice experience. */
export const FOCUSED_VOICE_LANGUAGE_CODES = ["hi-IN", "kn-IN", "en-IN", "ta-IN", "mr-IN"] as const satisfies readonly SarvamLanguageCode[];
export type FocusedVoiceLanguageCode = (typeof FOCUSED_VOICE_LANGUAGE_CODES)[number];

/** Sarvam's documented `language_code` value for automatic speech-language detection. */
export const AUTO_DETECT_LANGUAGE = "unknown" as const;
/** A provider-detected locale below this probability is not used for evidence routing. */
export const AUTO_DETECT_MIN_CONFIDENCE = 0.8;

export type VoiceInputLanguageCode = SarvamLanguageCode | typeof AUTO_DETECT_LANGUAGE;

export type VoiceLanguage = {
  code: SarvamLanguageCode;
  label: string;
  nativeLabel: string;
  script: string;
};

export const SARVAM_STT_LANGUAGES: readonly VoiceLanguage[] = [
  { code: "en-IN", label: "English", nativeLabel: "English", script: "Latin" },
  { code: "hi-IN", label: "Hindi", nativeLabel: "हिन्दी", script: "Devanagari" },
  { code: "bn-IN", label: "Bengali", nativeLabel: "বাংলা", script: "Bengali" },
  { code: "kn-IN", label: "Kannada", nativeLabel: "ಕನ್ನಡ", script: "Kannada" },
  { code: "ml-IN", label: "Malayalam", nativeLabel: "മലയാളം", script: "Malayalam" },
  { code: "mr-IN", label: "Marathi", nativeLabel: "मराठी", script: "Devanagari" },
  { code: "od-IN", label: "Odia", nativeLabel: "ଓଡ଼ିଆ", script: "Odia" },
  { code: "pa-IN", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", script: "Gurmukhi" },
  { code: "ta-IN", label: "Tamil", nativeLabel: "தமிழ்", script: "Tamil" },
  { code: "te-IN", label: "Telugu", nativeLabel: "తెలుగు", script: "Telugu" },
  { code: "gu-IN", label: "Gujarati", nativeLabel: "ગુજરાતી", script: "Gujarati" },
  { code: "as-IN", label: "Assamese", nativeLabel: "অসমীয়া", script: "Bengali" },
  { code: "ur-IN", label: "Urdu", nativeLabel: "اردو", script: "Arabic" },
  { code: "ne-IN", label: "Nepali", nativeLabel: "नेपाली", script: "Devanagari" },
  { code: "kok-IN", label: "Konkani", nativeLabel: "कोंकणी", script: "Devanagari" },
  { code: "ks-IN", label: "Kashmiri", nativeLabel: "کٲشُر", script: "Arabic" },
  { code: "sd-IN", label: "Sindhi", nativeLabel: "سنڌي", script: "Arabic" },
  { code: "sa-IN", label: "Sanskrit", nativeLabel: "संस्कृतम्", script: "Devanagari" },
  { code: "sat-IN", label: "Santali", nativeLabel: "ᱥᱟᱱᱛᱟᱲᱤ", script: "Ol Chiki" },
  { code: "mni-IN", label: "Manipuri", nativeLabel: "ꯃꯤꯇꯩꯂꯣꯟ", script: "Meetei Mayek" },
  { code: "brx-IN", label: "Bodo", nativeLabel: "बड़ो", script: "Devanagari" },
  { code: "mai-IN", label: "Maithili", nativeLabel: "मैथिली", script: "Devanagari" },
  { code: "doi-IN", label: "Dogri", nativeLabel: "डोगरी", script: "Devanagari" },
];

export const FOCUSED_SARVAM_STT_LANGUAGES: readonly VoiceLanguage[] = FOCUSED_VOICE_LANGUAGE_CODES.map(code => {
  const language = SARVAM_STT_LANGUAGES.find(entry => entry.code === code);
  if (!language) throw new Error(`Focused voice language ${code} is missing from the Sarvam catalog.`);
  return language;
});

export function isSarvamLanguageCode(value: string | undefined): value is SarvamLanguageCode {
  return Boolean(value && (SARVAM_LANGUAGE_CODES as readonly string[]).includes(value));
}

export function isFocusedVoiceLanguage(value: string | undefined): value is FocusedVoiceLanguageCode {
  return Boolean(value && (FOCUSED_VOICE_LANGUAGE_CODES as readonly string[]).includes(value));
}

export function languageForCode(code: string): VoiceLanguage | undefined {
  return SARVAM_STT_LANGUAGES.find(language => language.code === code);
}
