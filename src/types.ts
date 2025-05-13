export type TimestampSeconds = number;
export type DurationSeconds = number;
export type LanguageCode = string;

export type Statistics = {
  numSentencesWithDiminishedSubphrases: number;
  numSentencesWithDiminishedSubphrasesOriginal: number;
  numSentencesWithDiminishedSubphrasesTranslated: number;
  numDiminishedSubphrases: number;
  fractionDiminishedSentences: number;
  fractionDiminishedSubphrases: number;
  fractionDiminishedSubphraseWords: number;
  fractionDiminishedSubphraseWordsOriginal: number;
  fractionDiminishedSubphraseWordsTranslated: number;
};

export type OriginalWord = {
  index: number;
  word: string;
  punctuatedWord: string;
  start: TimestampSeconds;
  end: TimestampSeconds;
  confidence: number;
  speakerConfidence?: number;
};

export type TranslatedWord = {
  index: number;
  word: string;
  punctuatedWord: string;
  start: TimestampSeconds;
  end: TimestampSeconds;
  confidence: number | undefined;
};

export type LanguageSentence<T extends OriginalWord | TranslatedWord> = {
  text: string;
  start: TimestampSeconds;
  end: TimestampSeconds;
  words: T[];
};

export type Subphrase = {
  index: number;
  original: string;
  translated: string;
  originalWordIndices: number[];
  translatedWordIndices: number[];
};

export type Sentence = {
  index: number;
  speakerId: number;
  original: LanguageSentence<OriginalWord>;
  translated: LanguageSentence<TranslatedWord>;
  subphrases: Subphrase[];
};

export type Transcript = {
  durationOriginal: DurationSeconds;
  durationTranslated: DurationSeconds;
  detectedLanguage: string;
  targetLanguage: LanguageCode;
  numSpeakers: number;
  sentences: Sentence[];
  statistics: Statistics;
};

export type WordLevelTiming = {
  word: string;
  punctuatedWord: string;
  start: number;
  end: number;
  probability?: number;
  speaker?: number;
};

export type DiarizedWordLevelTiming = WordLevelTiming & {
  speaker: number;
};

export type SentenceLevelTiming = {
  start: number;
  end: number;
  words: WordLevelTiming[];
};

export type ReconciledWordLevelTiming = WordLevelTiming & {
  language: "original" | "translated";
};

export type PhraseTiming = {
  start: number;
  end: number;
  original: WordLevelTiming[];
  translated: WordLevelTiming[];
  subphrases: {
    original: string;
    translated: string;
  }[];
};

export type PhraseTimingSubphrase = PhraseTiming["subphrases"][number];

export type PhraseIndexedSubphrase = PhraseTimingSubphrase & {
  originalWordIndices: number[];
  translatedWordIndices: number[];
};

export type SubphraseIndexedPhraseTiming = PhraseTiming & {
  subphrases: PhraseIndexedSubphrase[];
};

export type PhraseIndexedTimedSubphrase = PhraseIndexedSubphrase & {
  originalStart: number | undefined;
  originalEnd: number | undefined;
  translatedStart: number | undefined;
  translatedEnd: number | undefined;
};

export type SubphraseTimedPhraseTiming = PhraseTiming & {
  subphrases: PhraseIndexedTimedSubphrase[];
};

export type SentenceTiming = {
  start: number;
  end: number;
  phrases: SubphraseIndexedPhraseTiming[];
};
