"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { StatBox } from "@/components/tools/shared";
import {
  countWords,
  countCharacters,
  countSentences,
  countParagraphs,
  readingTime,
  speakingTime,
} from "@/lib/logic/text";

export default function WordCounter() {
  const [text, setText] = useState("");

  const words = countWords(text);
  const chars = countCharacters(text);
  const charsNoSpaces = countCharacters(text, false);
  const sentences = countSentences(text);
  const paragraphs = countParagraphs(text);

  const stats = [
    { label: "Words", value: String(words) },
    { label: "Characters", value: String(chars) },
    { label: "Characters (no spaces)", value: String(charsNoSpaces) },
    { label: "Sentences", value: String(sentences) },
    { label: "Paragraphs", value: String(paragraphs) },
    { label: "Reading time", value: readingTime(words) },
    { label: "Speaking time", value: speakingTime(words) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type or paste your text here…"
        className="min-h-[240px] font-mono text-sm"
        aria-label="Text to count"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <StatBox key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
    </div>
  );
}