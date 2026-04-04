export interface LegislativeChunk {
  chunk_type: "article" | "section" | "recital" | "annex" | "definition" | "preamble";
  chunk_reference: string;
  chunk_title: string;
  chunk_text: string;
  parent_reference: string;
  hierarchy_path: string;
}

const MAX_CHUNK_WORDS = 750;

function buildContextHeader(
  regTitle: string,
  reference: string,
  hierarchy: string,
  jurisdiction: string
): string {
  return `[${regTitle} | ${reference} | ${hierarchy} | ${jurisdiction}]`;
}

function splitLongText(text: string, _reference?: string): string[] {
  const words = text.split(/\s+/);
  if (words.length <= MAX_CHUNK_WORDS) return [text];

  // Split by numbered paragraphs first
  const paragraphs = text.split(/\n(?=\d+\.\s|\(\d+\)\s|\([a-z]\)\s)/);
  if (paragraphs.length > 1) {
    const chunks: string[] = [];
    let current = "";
    for (const para of paragraphs) {
      if ((current + " " + para).split(/\s+/).length > MAX_CHUNK_WORDS && current) {
        chunks.push(current.trim());
        current = para;
      } else {
        current = current ? current + "\n" + para : para;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  // Fallback: split by sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).split(/\s+/).length > MAX_CHUNK_WORDS && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function parseEULegislation(
  markdown: string,
  regTitle: string,
  jurisdiction: string
): LegislativeChunk[] {
  const chunks: LegislativeChunk[] = [];

  // ── RECITALS ──
  // Extract recitals from preamble (before first Article)
  const firstArticlePos = markdown.search(/^Article\s+\d+/im);
  if (firstArticlePos > 0) {
    const preamble = markdown.slice(0, firstArticlePos);
    const recitalPattern = /\((\d+)\)\s+([\s\S]*?)(?=\(\d+\)\s|\n\n(?:Article|TITLE|CHAPTER))/g;
    let recitalMatch;
    let recitalCount = 0;
    while ((recitalMatch = recitalPattern.exec(preamble)) !== null && recitalCount < 20) {
      const num = recitalMatch[1];
      const text = recitalMatch[2].replace(/\s+/g, " ").trim();
      if (text.split(/\s+/).length < 5) continue;
      const ref = `Recital ${num}`;
      const header = buildContextHeader(regTitle, ref, `Preamble > ${ref}`, jurisdiction);
      chunks.push({
        chunk_type: "recital",
        chunk_reference: ref,
        chunk_title: "",
        chunk_text: `${header}\n(${num}) ${text}`,
        parent_reference: "Preamble",
        hierarchy_path: `Preamble > ${ref}`,
      });
      recitalCount++;
    }
  }

  // ── ARTICLES ──
  // Primary split on "Article N" boundaries — this is the core unit
  const articleSplitPattern = /^(Article\s+(\d+))\s*$/gim;
  const articlePositions: { num: string; start: number; matchEnd: number }[] = [];
  let match;
  while ((match = articleSplitPattern.exec(markdown)) !== null) {
    articlePositions.push({
      num: match[2],
      start: match.index,
      matchEnd: match.index + match[0].length,
    });
  }

  // Also try: "Article N\n" with title on same or next line
  if (articlePositions.length === 0) {
    const altPattern = /^Article\s+(\d+)\b[^\n]*/gim;
    while ((match = altPattern.exec(markdown)) !== null) {
      articlePositions.push({
        num: match[1],
        start: match.index,
        matchEnd: match.index + match[0].length,
      });
    }
  }

  // Build hierarchy context by scanning for Title/Chapter/Section headers
  // before each article position
  const hierarchyMarkers: { pos: number; label: string; level: "title" | "chapter" | "section" }[] = [];
  const hierPattern = /^((?:TITLE|Title)\s+[IVXLCDM\d]+[^\n]*|(?:CHAPTER|Chapter)\s+[IVXLCDM\d]+[^\n]*|(?:SECTION|Section)\s+\d+[^\n]*)/gim;
  while ((match = hierPattern.exec(markdown)) !== null) {
    const text = match[1].trim();
    const level = /^(?:TITLE|Title)/i.test(text) ? "title" : /^(?:CHAPTER|Chapter)/i.test(text) ? "chapter" : "section";
    hierarchyMarkers.push({ pos: match.index, label: text, level });
  }

  const getHierarchy = (articlePos: number): { title: string; chapter: string; section: string } => {
    let title = "";
    let chapter = "";
    let section = "";
    for (const h of hierarchyMarkers) {
      if (h.pos >= articlePos) break;
      if (h.level === "title") { title = h.label; chapter = ""; section = ""; }
      else if (h.level === "chapter") { chapter = h.label; section = ""; }
      else if (h.level === "section") { section = h.label; }
    }
    return { title, chapter, section };
  };

  for (let i = 0; i < articlePositions.length; i++) {
    const ap = articlePositions[i];
    const nextStart = i + 1 < articlePositions.length
      ? articlePositions[i + 1].start
      : markdown.length;

    // Extract body: from after "Article N" line to start of next article
    const body = markdown.slice(ap.matchEnd, nextStart).trim();

    // Extract title: first non-empty line after "Article N"
    const bodyLines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    let articleTitle = "";
    let bodyStart = 0;

    // The title is typically the first line if it doesn't start with a number or (
    if (bodyLines.length > 0 && !/^[\d(]/.test(bodyLines[0]) && bodyLines[0].length < 200) {
      articleTitle = bodyLines[0];
      bodyStart = 1;
    }

    const articleBody = bodyLines.slice(bodyStart).join("\n").trim();
    if (!articleBody || articleBody.split(/\s+/).length < 3) continue;

    const hier = getHierarchy(ap.start);
    const ref = `Article ${ap.num}`;
    const hierarchyPath = [hier.title, hier.chapter, hier.section, ref]
      .filter(Boolean)
      .join(" > ");
    const parentRef = hier.section || hier.chapter || hier.title || "";

    const header = buildContextHeader(regTitle, ref, hierarchyPath, jurisdiction);
    const parts = splitLongText(articleBody, ref);

    for (let j = 0; j < parts.length; j++) {
      chunks.push({
        chunk_type: "article",
        chunk_reference: parts.length > 1 ? `${ref} (part ${j + 1})` : ref,
        chunk_title: articleTitle,
        chunk_text: `${header}\n${articleTitle ? `${ref} — ${articleTitle}\n` : `${ref}\n`}${parts[j]}`,
        parent_reference: parentRef,
        hierarchy_path: hierarchyPath,
      });
    }
  }

  // ── ANNEXES ──
  const annexPattern = /^((?:ANNEX|Annex)\s+([IVXLCDM\d]+)[^\n]*)/gim;
  const annexPositions: { label: string; num: string; start: number; end: number }[] = [];
  while ((match = annexPattern.exec(markdown)) !== null) {
    annexPositions.push({
      label: match[1].trim(),
      num: match[2],
      start: match.index + match[0].length,
      end: markdown.length,
    });
  }
  for (let i = 0; i < annexPositions.length; i++) {
    if (i + 1 < annexPositions.length) annexPositions[i].end = annexPositions[i + 1].start;
    const ap = annexPositions[i];
    const body = markdown.slice(ap.start, ap.end).trim();
    if (!body || body.split(/\s+/).length < 10) continue;
    const ref = `Annex ${ap.num}`;
    const header = buildContextHeader(regTitle, ref, ref, jurisdiction);
    const parts = splitLongText(body.slice(0, 3000), ref);
    for (let j = 0; j < parts.length; j++) {
      chunks.push({
        chunk_type: "annex",
        chunk_reference: parts.length > 1 ? `${ref} (part ${j + 1})` : ref,
        chunk_title: ap.label,
        chunk_text: `${header}\n${ap.label}\n${parts[j]}`,
        parent_reference: "",
        hierarchy_path: ref,
      });
    }
  }

  return chunks;
}

export function parseUSLegislation(
  markdown: string,
  regTitle: string,
  jurisdiction: string
): LegislativeChunk[] {
  const chunks: LegislativeChunk[] = [];
  const lines = markdown.split("\n");

  let currentSectionNum = "";
  let currentSectionTitle = "";
  let currentSectionText = "";
  let currentPart = "";

  const flushSection = () => {
    if (!currentSectionNum || !currentSectionText.trim()) return;
    const ref = `Section ${currentSectionNum}`;
    const hierarchy = [currentPart, ref].filter(Boolean).join(" > ");
    const header = buildContextHeader(regTitle, ref, hierarchy, jurisdiction);
    const parts = splitLongText(currentSectionText.trim(), ref);
    for (let i = 0; i < parts.length; i++) {
      chunks.push({
        chunk_type: "section",
        chunk_reference: parts.length > 1 ? `${ref} (part ${i + 1})` : ref,
        chunk_title: currentSectionTitle,
        chunk_text: `${header}\n${currentSectionTitle ? `${ref} — ${currentSectionTitle}\n` : `${ref}\n`}${parts[i]}`,
        parent_reference: currentPart || "",
        hierarchy_path: hierarchy,
      });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Part/Title markers
    const partMatch = trimmed.match(/^(?:PART|Part|TITLE|Title)\s+([IVXLCDM]+|\d+)\s*[—–.-]?\s*(.*)/i);
    if (partMatch) {
      flushSection();
      currentSectionNum = "";
      currentSectionText = "";
      currentPart = `Part ${partMatch[1]}${partMatch[2] ? " — " + partMatch[2] : ""}`;
      continue;
    }

    // Section detection
    const sectionMatch = trimmed.match(/^(?:Section|Sec\.?|§)\s*(\d+[a-zA-Z]?)\s*[.—–-]?\s*(.*)/i);
    if (sectionMatch) {
      flushSection();
      currentSectionNum = sectionMatch[1];
      currentSectionTitle = sectionMatch[2] || "";
      currentSectionText = "";
      continue;
    }

    // Definitions detection
    const defMatch = trimmed.match(/^[""]?([A-Z][^""]+)[""]?\s+means\s+(.*)/);
    if (defMatch && currentSectionText.length < 100) {
      // Found a definition near the start of a section
      const ref = `Definition: ${defMatch[1]}`;
      const header = buildContextHeader(regTitle, ref, "Definitions", jurisdiction);
      chunks.push({
        chunk_type: "definition",
        chunk_reference: ref,
        chunk_title: defMatch[1],
        chunk_text: `${header}\n${trimmed}`,
        parent_reference: "Definitions",
        hierarchy_path: `Definitions > ${defMatch[1]}`,
      });
      continue;
    }

    // Accumulate section text
    if (currentSectionNum && trimmed) {
      currentSectionText += (currentSectionText ? "\n" : "") + trimmed;
    }
  }

  flushSection();
  return chunks;
}

export function parseGenericRegulation(
  markdown: string,
  regTitle: string,
  jurisdiction: string
): LegislativeChunk[] {
  const chunks: LegislativeChunk[] = [];
  const sections = markdown.split(/\n(?=#{1,3}\s)/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.split(/\s+/).length < 10) continue;

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    const title = headingMatch ? headingMatch[2] : "Section";
    const content = headingMatch ? trimmed.slice(headingMatch[0].length).trim() : trimmed;

    if (!content || content.split(/\s+/).length < 5) continue;

    const ref = title.length > 60 ? title.slice(0, 60) + "..." : title;
    const header = buildContextHeader(regTitle, ref, ref, jurisdiction);
    const parts = splitLongText(content, ref);

    for (let i = 0; i < parts.length; i++) {
      chunks.push({
        chunk_type: "section",
        chunk_reference: parts.length > 1 ? `${ref} (part ${i + 1})` : ref,
        chunk_title: title,
        chunk_text: `${header}\n${title}\n${parts[i]}`,
        parent_reference: "",
        hierarchy_path: title,
      });
    }
  }

  return chunks;
}

export function parseLegislativeText(
  markdown: string,
  regTitle: string,
  jurisdiction: string,
  category: string
): LegislativeChunk[] {
  // EU jurisdictions use EU legislation structure
  if (jurisdiction === "EU" || jurisdiction === "GB") {
    const euChunks = parseEULegislation(markdown, regTitle, jurisdiction);
    if (euChunks.length > 0) return euChunks;
  }

  // US jurisdictions use US legislation structure
  if (jurisdiction.startsWith("US") || jurisdiction === "CA") {
    const usChunks = parseUSLegislation(markdown, regTitle, jurisdiction);
    if (usChunks.length > 0) return usChunks;
  }

  // Frameworks, guidance, standards → generic parser
  if (["framework", "guidance", "standard"].includes(category)) {
    return parseGenericRegulation(markdown, regTitle, jurisdiction);
  }

  // Fallback: try US parser then generic
  const usChunks = parseUSLegislation(markdown, regTitle, jurisdiction);
  if (usChunks.length > 0) return usChunks;

  return parseGenericRegulation(markdown, regTitle, jurisdiction);
}
