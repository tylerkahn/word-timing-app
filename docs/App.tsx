import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Play,
  Pause,
  AlertCircle,
  Download,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type { Transcript, TranslatedWord } from "../src/types";

type WordTiming = {
  end: number;
  word: string;
  punctuated_word?: string;
  start: number;
  sentenceIndex?: number;
  probability?: number;
};

class IntervalNode {
  start: number;
  end: number;
  max: number;
  data: WordTiming;
  left: IntervalNode | null;
  right: IntervalNode | null;

  constructor(timing: WordTiming) {
    this.start = timing.start;
    this.end = timing.end;
    this.max = timing.end;
    this.data = timing;
    this.left = null;
    this.right = null;
  }
}

class IntervalTree {
  root: IntervalNode | null;
  // Small epsilon value to handle floating point precision
  private static EPSILON = 0.001;

  constructor() {
    this.root = null;
  }

  insert(timing: WordTiming) {
    const node = new IntervalNode(timing);
    if (!this.root) {
      this.root = node;
      return;
    }
    this._insert(this.root, node);
  }

  private _insert(root: IntervalNode, node: IntervalNode) {
    if (node.start < root.start) {
      if (root.left === null) {
        root.left = node;
      } else {
        this._insert(root.left, node);
      }
    } else {
      if (root.right === null) {
        root.right = node;
      } else {
        this._insert(root.right, node);
      }
    }
    root.max = Math.max(root.max, node.end);
  }

  findOverlapping(point: number): WordTiming[] {
    const result: WordTiming[] = [];
    this._findOverlapping(this.root, point, result);
    return result;
  }

  private _findOverlapping(
    node: IntervalNode | null,
    point: number,
    result: WordTiming[]
  ) {
    if (!node || point > node.max + IntervalTree.EPSILON) return;

    // Check if point is within the interval, including epsilon boundaries
    if (
      point >= node.start - IntervalTree.EPSILON &&
      point <= node.end + IntervalTree.EPSILON
    ) {
      result.push(node.data);
    }

    // Only traverse left subtree if it might contain overlapping intervals
    if (node.left && point <= node.left.max + IntervalTree.EPSILON) {
      this._findOverlapping(node.left, point, result);
    }

    // Only traverse right subtree if point is greater than or equal to the start of this node
    // This prevents unnecessary recursion into right subtrees
    if (node.right && point >= node.start - IntervalTree.EPSILON) {
      this._findOverlapping(node.right, point, result);
    }
  }
}

function handleJsonFileUpload(
  event: React.ChangeEvent<HTMLInputElement>,
  callback: (jsonString: string) => void
) {
  const file = event.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        callback(text);
      }
    };
    reader.readAsText(file);
  }
}

function extractAudioKey(jsonInput: string): string {
  try {
    const data = JSON.parse(jsonInput);
    if (data.dubAudioFileLocation?.key) {
      return data.dubAudioFileLocation.key;
    }
    return "";
  } catch {
    return "";
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  return `${minutes}:${remainingSeconds
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

// Add helper function to generate underline style based on probability
function getProbabilityStyle(
  probability: number | undefined
): React.CSSProperties {
  const opacity = probability === undefined ? 0.5 : probability;
  return {
    borderBottom: `4px solid rgba(34, 197, 94, ${opacity})`, // Use tailwind's green-500
    paddingBottom: "2px",
    display: "inline-block",
  };
}

function extractWordTimings(jsonInput: string): WordTiming[] {
  try {
    const parsedData = JSON.parse(jsonInput);
    const transcript: Transcript =
      parsedData?.dubTranscript ||
      parsedData?.wordTimings ||
      parsedData?.segments ||
      parsedData;
    const allWords: WordTiming[] = [];

    if (transcript?.sentences && Array.isArray(transcript.sentences)) {
      console.log(
        "Processing transcript with sentences:",
        transcript.sentences.length
      );

      // Extract all translated words from each sentence
      transcript.sentences.forEach((sentence: any) => {
        if (
          sentence.translated?.words &&
          Array.isArray(sentence.translated.words)
        ) {
          console.log(
            `Processing sentence ${sentence.index} with ${sentence.translated.words.length} words`
          );

          sentence.translated.words.forEach((word: TranslatedWord) => {
            allWords.push({
              ...word,
              word: word.word,
              punctuated_word: word.punctuatedWord,
              start: word.start,
              end: word.end,
              sentenceIndex: sentence.index,
              probability: word.confidence,
            });
          });
        } else if (sentence?.words && Array.isArray(sentence.words)) {
          sentence.words.forEach((word: any) => {
            allWords.push({
              ...word,
              word: word.word,
              punctuated_word: word.punctuatedWord,
              start: word.start,
              end: word.end,
              probability: word.confidence,
            });
          });
        }
      });

      console.log("Total translated words extracted:", allWords.length);
    } else if (Array.isArray(transcript)) {
      const elem = transcript[0];
      if (elem.word) {
        for (const item of transcript) {
          allWords.push({
            ...item,
            word: item.word,
            punctuated_word: item.punctuatedWord,
            start: item.start,
            end: item.end,
            probability: item.confidence || item.probability,
            ...{ language: item.language },
          });
        }
      } else if (elem.phrases) {
        for (const sentence of transcript) {
          for (const phrase of sentence.phrases) {
            for (const item of [...phrase.original, ...phrase.translated])
              allWords.push({
                ...item,
                word: item.word,
                punctuated_word: item.punctuatedWord,
                start: item.start,
                end: item.end,
                probability: item.confidence || item.probability,
              });
          }
        }
      } else if (elem.words) {
        transcript.forEach((sentence: any) => {
          (sentence.words || sentence).forEach((word: any) => {
            allWords.push({
              ...word,
              word: word.word,
              punctuated_word: word.punctuatedWord || word.word,
              start: word.start,
              end: word.end,
              probability: word.confidence || word.probability,
            });
          });
        });
      }
    }

    return allWords;
  } catch (error) {
    console.error("Error extracting word timings:", error);
    return [];
  }
}

function App() {
  // Add dark mode state and effect at the start of the component
  useEffect(() => {
    // Set dark mode as default
    document.documentElement.classList.add("dark");
  }, []);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioKey, setAudioKey] = useState<string>("");
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [timings, setTimings] = useState<WordTiming[]>([]);
  const [currentWordTimings, setCurrentWordTimings] = useState<WordTiming[]>(
    []
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [maxJsonHeight, setMaxJsonHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [currentSentenceWords, setCurrentSentenceWords] = useState<
    WordTiming[]
  >([]);
  const [jsonInputText, setJsonInputText] = useState<string>("");
  const [jsonUrl, setJsonUrl] = useState<string>("");
  const [isLoadingJson, setIsLoadingJson] = useState(false);
  const [persistWords, setPersistWords] = useState<boolean>(true);
  const persistWordsRef = useRef<boolean>(persistWords);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlRef = useRef<string>("");
  const jsonDisplayRef = useRef<HTMLDivElement>(null);
  const intervalTreeRef = useRef<IntervalTree | null>(null);
  const rafRef = useRef<number>();
  const initialTime = useRef<number>(0);
  const dragStartY = useRef<number>(0);
  const dragAreaHeight = useRef<number>(300); // Virtual drag area height in pixels
  const timeDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (jsonDisplayRef.current) {
      const currentHeight = jsonDisplayRef.current.offsetHeight;
      if (currentHeight > maxJsonHeight) {
        setMaxJsonHeight(currentHeight);
      }
    }
  }, [currentWordTimings, maxJsonHeight]);

  useEffect(() => {
    // Build interval tree when timings change
    console.log("Building interval tree with timings:", timings.length);
    intervalTreeRef.current = new IntervalTree();
    timings.forEach((timing) => {
      console.log("Adding timing to tree:", timing);
      intervalTreeRef.current?.insert(timing);
    });
  }, [timings]);

  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("audio/")) {
        setAudioFile(file);
        setAudioUrl(""); // Clear URL when file is uploaded
        setAudioKey("");
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = URL.createObjectURL(file);
        if (audioRef.current) {
          audioRef.current.src = audioUrlRef.current;
          audioRef.current.load();
        }
        setError("");
      } else {
        setError("Please upload a valid audio file");
      }
    }
  };

  const constructUrlFromKey = (key: string): string => {
    return `http://localhost:9000/jobdata/${key}`;
  };

  const handleAudioUrl = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = formData.get("audioUrl") as string;

    if (!input) {
      setError("Please enter a valid URL or key");
      return;
    }

    // Try to extract key from JSON-like string
    let processedInput = input.trim();
    if (processedInput.includes('"key":')) {
      try {
        // Convert to valid JSON if it's not already
        if (!processedInput.startsWith("{")) {
          processedInput = `{${processedInput}}`;
        }
        // Clean up any trailing commas
        processedInput = processedInput.replace(/,\s*}/g, "}");

        const parsed = JSON.parse(processedInput);
        if (parsed.key) {
          processedInput = parsed.key;
        }
      } catch (error) {
        console.log("Failed to parse key JSON, trying regex:", error);
        const match = processedInput.match(/"key":\s*"([^"]+)"/);
        if (match && match[1]) {
          processedInput = match[1];
        }
      }
    }

    // Determine if input is a URL or a key
    const url =
      processedInput.startsWith("http://") ||
      processedInput.startsWith("https://")
        ? processedInput
        : constructUrlFromKey(processedInput);

    setIsLoadingAudio(true);
    try {
      // Test if the URL is valid and accessible
      const response = await fetch(url, { method: "HEAD" });
      if (!response.ok) {
        throw new Error("URL is not accessible");
      }
      const contentType = response.headers.get("content-type");
      if (!contentType?.startsWith("audio/")) {
        throw new Error("URL does not point to an audio file");
      }

      // Clear existing file and set new URL
      setAudioFile(null);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
      }
      setAudioUrl(url);
      setAudioKey(
        processedInput.startsWith("http://") ||
          processedInput.startsWith("https://")
          ? ""
          : processedInput
      );
      setError("");
    } catch {
      setError(
        "Unable to load audio. Please check if the URL/key is correct and points to an audio file."
      );
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleJsonInput = (jsonValue: string) => {
    try {
      if (!jsonValue.trim()) {
        setError("Please enter JSON data");
        return;
      }

      let parsedData;
      try {
        parsedData = JSON.parse(jsonValue);
      } catch (error) {
        console.error("JSON parse error:", error);
        setError("Invalid JSON format");
        return;
      }

      // Try to extract audio key first
      const key = extractAudioKey(jsonValue);
      if (key) {
        setAudioKey(key);
        const url = constructUrlFromKey(key);
        setAudioUrl(url);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
        }
      }

      // Extract word timings
      const extractedTimings = extractWordTimings(jsonValue);
      if (extractedTimings.length > 0) {
        console.log("Setting timings:", extractedTimings);
        setTimings(extractedTimings);
        setError("");
      } else {
        console.error("No word timings found in JSON:", parsedData);
        setError("No valid word timings found in the JSON data");
      }
    } catch (error) {
      console.error("Error processing JSON:", error);
      setError("Error processing the JSON data");
    }
  };

  // Add handler for text area input
  const handleJsonTextAreaInput = () => {
    if (jsonInputText) {
      handleJsonInput(jsonInputText);
    } else {
      setError("Please enter JSON data in the textarea");
    }
  };

  // Add handler for JSON URL input
  const handleJsonUrl = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = formData.get("jsonUrl") as string;

    if (!input) {
      setError("Please enter a valid URL for JSON");
      return;
    }

    setIsLoadingJson(true);
    try {
      // Fetch JSON data from URL
      const response = await fetch(input);
      if (!response.ok) {
        throw new Error("URL is not accessible");
      }
      const jsonData = await response.text();

      // Process the fetched JSON data
      handleJsonInput(jsonData);
      setJsonUrl(input);
    } catch (error) {
      setError("Unable to load JSON. Please check if the URL is correct.");
    } finally {
      setIsLoadingJson(false);
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!audioRef.current || !timeDisplayRef.current) return;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    initialTime.current = audioRef.current.currentTime;
    e.preventDefault(); // Prevent text selection
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !audioRef.current || !timeDisplayRef.current) return;

    // Calculate position in virtual drag area
    const deltaY = e.clientY - dragStartY.current;
    const virtualPosition = Math.max(
      0,
      Math.min(dragAreaHeight.current, dragAreaHeight.current / 2 - deltaY)
    );

    // Map position to time
    const timePercentage = virtualPosition / dragAreaHeight.current;
    const newTime = Math.max(0, Math.min(duration, duration * timePercentage));

    // Only update if the change is significant enough
    if (Math.abs(newTime - audioRef.current.currentTime) >= 0.001) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    // Add global mouse up handler
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  const updateCurrentWords = (time: number) => {
    const tree = intervalTreeRef.current;
    if (!tree) {
      console.log("No interval tree available");
      return;
    }

    let validCurrentWordTimings = tree.findOverlapping(time);
    if (!persistWordsRef.current) {
      validCurrentWordTimings = validCurrentWordTimings.filter(
        (w) => time <= w.end
      );
    }
    /*
    console.log(
      "Found overlapping words:",
      validCurrentWordTimings.length,
      validCurrentWordTimings
    );*/

    if (validCurrentWordTimings.length > 0) {
      // Get the sentence index of the first current word
      const currentSentenceIndex = validCurrentWordTimings[0].sentenceIndex;
      //console.log("Current sentence index:", currentSentenceIndex);

      // If we have a valid sentence index, find all words from that sentence
      if (currentSentenceIndex !== undefined) {
        const sentenceWords = timings.filter(
          (timing) => timing.sentenceIndex === currentSentenceIndex
        );
        //console.log("Words in current sentence:", sentenceWords.length);
        setCurrentSentenceWords(sentenceWords);
      }

      setCurrentWordTimings(validCurrentWordTimings);
    } else if (!persistWordsRef.current) {
      setCurrentSentenceWords([]);
      setCurrentWordTimings([]);
    }
  };

  const jumpBack = (ms: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, audioRef.current.currentTime - ms / 1000);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      updateCurrentWords(newTime);
    }
  };

  const jumpForward = (ms: number) => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime + ms / 1000;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      updateCurrentWords(newTime);
    }
  };

  const jumpToSentence = (direction: "back" | "forward") => {
    if (!audioRef.current || currentWordTimings.length === 0) return;

    const currentSentenceIndex = currentWordTimings[0].sentenceIndex;
    if (currentSentenceIndex === undefined) return;

    const targetSentenceIndex =
      direction === "back"
        ? currentSentenceIndex - 1
        : currentSentenceIndex + 1;

    // Find the first word of the target sentence
    const targetWord = timings.find(
      (timing) => timing.sentenceIndex === targetSentenceIndex
    );

    if (targetWord) {
      audioRef.current.currentTime = targetWord.start;
      setCurrentTime(targetWord.start);
      updateCurrentWords(targetWord.start);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateWords = () => {
      if (!audio || !isPlaying) return;

      // Get precise current time without rounding
      const currentTime = audio.currentTime;
      console.log(
        "Current time:",
        currentTime,
        "Looking for words at this time"
      );
      setCurrentTime(currentTime);
      updateCurrentWords(currentTime);

      // Schedule next update
      rafRef.current = requestAnimationFrame(updateWords);
    };

    const loadedMetadataHandler = () => {
      console.log("Audio metadata loaded, duration:", audio.duration);
      setDuration(audio.duration);
    };

    const playHandler = () => {
      console.log("Audio started playing");
      setIsPlaying(true);
      // Start animation frame loop when playing
      updateWords(); // Update immediately when starting playback
      rafRef.current = requestAnimationFrame(updateWords);
    };

    const timeUpdateHandler = () => {
      if (!isPlaying) {
        // Update words when time changes while paused (e.g., seeking)
        const currentTime = audio.currentTime;
        console.log("Time updated while paused:", currentTime);
        setCurrentTime(currentTime);
        updateCurrentWords(currentTime);
      }
    };

    const pauseHandler = () => {
      console.log("Audio paused");
      setIsPlaying(false);
      // Cancel animation frame loop when paused
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      // Update one last time when pausing
      const currentTime = audio.currentTime;
      setCurrentTime(currentTime);
      updateCurrentWords(currentTime);
    };

    audio.addEventListener("loadedmetadata", loadedMetadataHandler);
    audio.addEventListener("play", playHandler);
    audio.addEventListener("pause", pauseHandler);
    audio.addEventListener("timeupdate", timeUpdateHandler);

    return () => {
      // Clean up animation frame on unmount
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      audio.removeEventListener("loadedmetadata", loadedMetadataHandler);
      audio.removeEventListener("play", playHandler);
      audio.removeEventListener("pause", pauseHandler);
      audio.removeEventListener("timeupdate", timeUpdateHandler);
    };
  }, [timings, isPlaying]);

  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    try {
      // For remote files, we need to fetch them first
      const response = await fetch(audioUrlRef.current);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = audioFile?.name || audioKey || "audio.mp3";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch {
      setError("Failed to download the audio file. Please try again.");
    }
  };

  const handleWordClick = (timing: WordTiming) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timing.start;
      setCurrentTime(timing.start);
      updateCurrentWords(timing.start);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Audio Text Sync
          </h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/50 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-8">
            {/* Audio Upload */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                className="hidden"
                id="audio-upload"
              />
              <label
                htmlFor="audio-upload"
                className="flex flex-col items-center cursor-pointer"
              >
                <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Upload audio file
                </span>
                {audioFile && (
                  <span className="mt-2 text-sm text-green-600 dark:text-green-400">
                    {audioFile.name}
                  </span>
                )}
              </label>
            </div>

            {/* JSON Upload */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="application/json"
                onChange={(e) => handleJsonFileUpload(e, handleJsonInput)}
                className="hidden"
                id="json-upload"
              />
              <label
                htmlFor="json-upload"
                className="flex flex-col items-center cursor-pointer"
              >
                <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Upload transcript JSON file
                </span>
                {timings.length > 0 && (
                  <span className="mt-2 text-sm text-green-600 dark:text-green-400">
                    JSON input loaded
                  </span>
                )}
              </label>
            </div>

            {/* JSON Text Input */}
            <div className="space-y-2">
              <textarea
                placeholder={JSON.stringify(
                  [
                    { word: "hello", start: 0.0, end: 0.3, probability: 0.3 },
                    { word: "world", start: 0.32, end: 1.0, probability: 0.9 },
                  ],
                  null,
                  2
                )}
                value={jsonInputText}
                onChange={(e) => setJsonInputText(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                rows={5}
              />
              <button
                onClick={handleJsonTextAreaInput}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg transition-colors"
              >
                Process JSON
              </button>
            </div>

            {/* JSON URL Input */}
            <div className="space-y-2">
              <form onSubmit={handleJsonUrl} className="flex gap-2">
                <input
                  type="text"
                  name="jsonUrl"
                  placeholder="Enter JSON URL (e.g., https://example.com/data.json)"
                  className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  value={jsonUrl}
                  onChange={(e) => setJsonUrl(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={isLoadingJson}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingJson ? "Loading..." : "Load JSON"}
                </button>
              </form>
              {jsonUrl && (
                <div className="text-sm text-green-600 dark:text-green-400">
                  Loaded JSON from: {jsonUrl}
                </div>
              )}
            </div>

            {/* Audio URL Input */}
            <div className="space-y-2">
              <form onSubmit={handleAudioUrl} className="flex gap-2">
                <input
                  type="text"
                  name="audioUrl"
                  placeholder="Enter Audio URL (e.g., https://...)"
                  className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  defaultValue={audioKey || audioUrl}
                />
                <button
                  type="submit"
                  disabled={isLoadingAudio}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingAudio ? "Loading..." : "Load Audio"}
                </button>
              </form>
              {(audioUrl || audioKey) && (
                <div className="space-y-1">
                  <div className="text-sm text-green-600 dark:text-green-400">
                    {audioKey
                      ? `Loaded key: ${audioKey}`
                      : `Loaded URL: ${audioUrl}`}
                  </div>
                  <a
                    href={audioUrlRef.current}
                    onClick={handleDownload}
                    className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
                    title="Download audio file"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download audio</span>
                  </a>
                </div>
              )}
            </div>

            {/* Persistence Checkbox */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="persistWords"
                checked={persistWords}
                onChange={(e) => {
                  setPersistWords(e.target.checked);
                  persistWordsRef.current = e.target.checked;
                }}
                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <label
                htmlFor="persistWords"
                className="text-gray-700 dark:text-gray-300"
              >
                Persist word until next word
              </label>
            </div>

            {/* Audio Player */}
            {(audioFile || audioUrl) && (
              <div className="flex flex-col items-center gap-4">
                <audio ref={audioRef} src={audioUrlRef.current} />
                <div className="flex gap-6 items-center">
                  <div className="flex gap-4">
                    {/*
                    <div className="relative">
                      <button
                        onClick={() => jumpToSentence("back")}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-2 transition-colors"
                        title="Previous sentence"
                      >
                        <SkipBack className="w-3 h-3" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                        ←Sent
                      </span>
                    </div>
                    */}
                    <div className="relative">
                      <button
                        onClick={() => jumpBack(10 * 60 * 1000)}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-2 transition-colors"
                        title="Jump back 100 milliseconds"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                        10m
                      </span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => jumpBack(60 * 1000)}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-2 transition-colors"
                        title="Jump back 100 milliseconds"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                        1m
                      </span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => jumpBack(10 * 1000)}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-2 transition-colors"
                        title="Jump back 100 milliseconds"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                        10s
                      </span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => jumpBack(100)}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-2 transition-colors"
                        title="Jump back 100 milliseconds"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                        100ms
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => jumpBack(10)}
                      className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-3 transition-colors"
                      title="Jump back 10 milliseconds"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                    <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                      10ms
                    </span>
                  </div>
                  <button
                    onClick={togglePlayback}
                    className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-5 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-8 h-8" />
                    ) : (
                      <Play className="w-8 h-8" />
                    )}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => jumpForward(10)}
                      className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-3 transition-colors"
                      title="Skip ahead 10 milliseconds"
                    >
                      <RotateCcw className="w-5 h-5 scale-x-[-1]" />
                    </button>
                    <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                      10ms
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <div className="relative">
                      <button
                        onClick={() => jumpForward(100)}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-2 transition-colors"
                        title="Skip ahead 100 milliseconds"
                      >
                        <RotateCcw className="w-3 h-3 scale-x-[-1]" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                        100ms
                      </span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => jumpForward(10 * 1000)}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-2 transition-colors"
                        title="Skip ahead 100 milliseconds"
                      >
                        <RotateCcw className="w-3 h-3 scale-x-[-1]" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                        10s
                      </span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => jumpForward(60 * 1000)}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-2 transition-colors"
                        title="Skip ahead 100 milliseconds"
                      >
                        <RotateCcw className="w-3 h-3 scale-x-[-1]" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                        1m
                      </span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => jumpForward(10 * 60 * 1000)}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-2 transition-colors"
                        title="Skip ahead 100 milliseconds"
                      >
                        <RotateCcw className="w-3 h-3 scale-x-[-1]" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                        10m
                      </span>
                    </div>
                    {/*
                    <div className="relative">
                      <button
                        onClick={() => jumpToSentence("forward")}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-full p-2 transition-colors"
                        title="Next sentence"
                      >
                        <SkipForward className="w-3 h-3" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-gray-500 dark:text-gray-400">
                        Sent→
                      </span>
                    </div>
                    */}
                  </div>
                </div>
                <div
                  ref={timeDisplayRef}
                  className={`text-sm font-mono px-4 text-center w-full py-2 rounded cursor-ns-resize select-none text-gray-900 dark:text-gray-100
                    ${
                      isDragging
                        ? "bg-indigo-100 dark:bg-indigo-900/50"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  {formatTime(currentTime)} {/* / {formatTime(duration)} */}
                  <br />
                  {currentTime.toFixed(4)}
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                  {currentSentenceWords.map((timing, index) => (
                    <button
                      key={`${timing.start}-${index}`}
                      onClick={() => handleWordClick(timing)}
                      className={`px-2 py-1 text-sm rounded transition-colors
                        ${
                          currentTime >= timing.start &&
                          currentTime <= timing.end
                            ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                        }`}
                    >
                      {timing.punctuated_word || timing.word}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Words Display */}
            <div className="min-h-[100px] bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 flex items-center justify-center">
              <p className="text-2xl text-gray-900 dark:text-gray-100 text-center transition-all duration-300">
                {currentWordTimings.length > 0
                  ? currentWordTimings.map((timing, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && " "}
                        <span style={getProbabilityStyle(timing.probability)}>
                          {timing.punctuated_word || timing.word}
                        </span>
                      </React.Fragment>
                    ))
                  : isPlaying
                  ? ""
                  : "Words will appear here..."}
              </p>
            </div>

            {/* Current Word JSON Display */}
            <div
              className="bg-gray-900 dark:bg-black rounded-lg p-4 overflow-auto transition-all duration-300"
              style={{ minHeight: maxJsonHeight || 100 }}
              ref={jsonDisplayRef}
            >
              {currentWordTimings.length > 0 ? (
                <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                  {JSON.stringify(currentWordTimings, null, 2)}
                </pre>
              ) : (audioRef?.current?.currentTime || 0) === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 font-mono text-sm">
                  Waiting for words...
                </div>
              ) : (
                <></>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
