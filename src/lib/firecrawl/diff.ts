import { createHash } from "crypto";

export interface ContentDiff {
  has_changes: boolean;
  summary: string;
  added_text: string;
  removed_text: string;
  changed_sections: string[];
  added_word_count: number;
  removed_word_count: number;
}

// Boilerplate patterns to ignore in diffs
const BOILERPLATE_PATTERNS = [
  /^\s*©\s*\d{4}/i,
  /^\s*copyright\s+\d{4}/i,
  /^\s*last\s+updated/i,
  /^\s*page\s+\d+\s+of\s+\d+/i,
  /^\s*skip\s+to\s+(main|content|navigation)/i,
  /^\s*cookie/i,
  /^\s*privacy\s+policy/i,
  /^\s*terms\s+of\s+(use|service)/i,
  /^\s*all\s+rights\s+reserved/i,
  /^\s*\[?\s*menu\s*\]?$/i,
  /^\s*home\s*[|>]/i,
];

function isBoilerplate(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3) return true;
  return BOILERPLATE_PATTERNS.some((p) => p.test(trimmed));
}

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function computeContentHash(text: string): string {
  const normalized = normalize(text);
  return createHash("sha256").update(normalized).digest("hex");
}

export function computeDiff(
  oldContent: string,
  newContent: string
): ContentDiff {
  const oldLines = normalize(oldContent).split("\n").filter((l) => !isBoilerplate(l));
  const newLines = normalize(newContent).split("\n").filter((l) => !isBoilerplate(l));

  const oldSet = new Set(oldLines.map((l) => l.trim()).filter(Boolean));
  const newSet = new Set(newLines.map((l) => l.trim()).filter(Boolean));

  const addedLines: string[] = [];
  const removedLines: string[] = [];

  for (const line of newLines) {
    const trimmed = line.trim();
    if (trimmed && !oldSet.has(trimmed)) {
      addedLines.push(trimmed);
    }
  }

  for (const line of oldLines) {
    const trimmed = line.trim();
    if (trimmed && !newSet.has(trimmed)) {
      removedLines.push(trimmed);
    }
  }

  // Identify changed sections (lines near headings)
  const changedSections: string[] = [];
  const headingPattern = /^#{1,4}\s+.+|^[A-Z][A-Z\s]{5,}$/;
  for (const line of [...addedLines, ...removedLines]) {
    if (headingPattern.test(line)) {
      changedSections.push(line.replace(/^#+\s+/, ""));
    }
  }

  // Also find headings that precede changed content
  for (let i = 0; i < newLines.length; i++) {
    const trimmed = newLines[i].trim();
    if (addedLines.includes(trimmed) && i > 0) {
      // Look backwards for nearest heading
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        if (headingPattern.test(newLines[j].trim())) {
          const section = newLines[j].trim().replace(/^#+\s+/, "");
          if (!changedSections.includes(section)) {
            changedSections.push(section);
          }
          break;
        }
      }
    }
  }

  const addedWordCount = addedLines.join(" ").split(/\s+/).filter(Boolean).length;
  const removedWordCount = removedLines.join(" ").split(/\s+/).filter(Boolean).length;

  const hasSubstantiveChanges = addedWordCount > 10 || removedWordCount > 10;

  return {
    has_changes: hasSubstantiveChanges,
    summary: hasSubstantiveChanges
      ? `${addedWordCount} words added, ${removedWordCount} words removed${changedSections.length > 0 ? `, ${changedSections.length} section(s) affected` : ""}`
      : addedLines.length + removedLines.length > 0
        ? "Minor/boilerplate changes only"
        : "No changes",
    added_text: addedLines.join("\n").slice(0, 5000),
    removed_text: removedLines.join("\n").slice(0, 2000),
    changed_sections: changedSections.slice(0, 10),
    added_word_count: addedWordCount,
    removed_word_count: removedWordCount,
  };
}
