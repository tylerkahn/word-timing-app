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
