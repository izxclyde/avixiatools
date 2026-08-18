export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export function countCharacters(text: string, includeSpaces = true): number {
  return includeSpaces ? text.length : text.replace(/\s/g, "").length;
}

export function countSentences(text: string): number {
  const matches = text.match(/[^.!?…]+[.!?…]+/g);
  return matches ? matches.length : 0;
}

export function countParagraphs(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\n{2,}/).length;
}

export function formatDuration(totalMinutes: number): string {
  const m = Math.round(totalMinutes);
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  return `${h}h ${min}m`;
}

export function readingTime(words: number, wpm = 200): string {
  return formatDuration(words / wpm);
}

export function speakingTime(words: number, wpm = 130): string {
  return formatDuration(words / wpm);
}
