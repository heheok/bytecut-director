import { v4 as uuid } from 'uuid';

interface ParsedProject {
  id: string;
  name: string;
  bpm: number;
  sections: ParsedSection[];
  defaultParams: Record<string, any>;
}

interface ParsedSection {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  description: string;
  shots: ParsedShot[];
}

interface ParsedShot {
  id: string;
  name: string;
  type: 'solo' | 'multi';
  startTime: number;
  endTime: number;
  lyric: string;
  concept: string;
  prompt: string;
  refImagePrompt: string;
  refImages: any[];
  takes?: ParsedTake[];
}

interface ParsedTake {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  concept: string;
  refImagePrompt: string;
  refImages: any[];
}

function parseTimestamp(ts: string): number {
  const cleaned = ts.trim();
  const match = cleaned.match(/^(\d+):(\d+)\.(\d+)$/);
  if (!match) return 0;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const fraction = parseInt(match[3], 10) / 100;
  return minutes * 60 + seconds + fraction;
}

function extractCodeBlock(text: string, startIdx: number): string {
  const codeStart = text.indexOf('```', startIdx);
  if (codeStart === -1) return '';
  const contentStart = text.indexOf('\n', codeStart) + 1;
  const codeEnd = text.indexOf('```', contentStart);
  if (codeEnd === -1) return '';
  return text.substring(contentStart, codeEnd).trim();
}

function determineShotType(text: string): 'solo' | 'multi' {
  if (/RAPID\s*CUT/i.test(text) || /⚡/u.test(text) || /MULTI/i.test(text)) return 'multi';
  return 'solo';
}

function extractField(text: string, field: string): string {
  const patterns = [
    new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+?)(?:\\n|$)`, 'i'),
    new RegExp(`- \\*\\*${field}:\\*\\*\\s*(.+?)(?:\\n|$)`, 'i'),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

function extractTimeRange(text: string): [number, number] {
  // Match patterns like "0:00.12 – 0:01.48" or "0:00.12 - 0:01.48"
  const m = text.match(/(\d+:\d+\.\d+)\s*[–\-]\s*(\d+:\d+\.\d+)/);
  if (m) return [parseTimestamp(m[1]), parseTimestamp(m[2])];
  return [0, 0];
}

function extractLyric(text: string): string {
  // Match shot names like: **Shot A2 — "Rules First"**
  const m = text.match(/—\s*"([^"]+)"/);
  if (m) return m[1];
  // Or from the timing map
  const m2 = text.match(/[""]([^""]+)[""]/)
  if (m2) return m2[1];
  return '';
}

export function parseShotlistMarkdown(content: string): ParsedProject {
  const sections: ParsedSection[] = [];

  // Split into section blocks using the ### ═══ pattern
  const sectionPattern = /### ═{3,}\s*(.+?)\s*\(([^)]+)\)\s*═{3,}/g;
  const sectionMatches: Array<{ name: string; timeRange: string; index: number }> = [];

  let match;
  while ((match = sectionPattern.exec(content)) !== null) {
    sectionMatches.push({
      name: match[1].trim(),
      timeRange: match[2].trim(),
      index: match.index,
    });
  }

  for (let i = 0; i < sectionMatches.length; i++) {
    const sec = sectionMatches[i];
    const nextIdx = i + 1 < sectionMatches.length ? sectionMatches[i + 1].index : content.length;
    const sectionContent = content.substring(sec.index, nextIdx);

    const [startTime, endTime] = extractTimeRange(sec.timeRange);

    // Extract description (first italicized line after header)
    const descMatch = sectionContent.match(/\*([^*]+)\*/);
    const description = descMatch ? descMatch[1].trim() : '';

    const shots = parseShotsFromSection(sectionContent);

    sections.push({
      id: uuid(),
      name: sec.name,
      startTime,
      endTime,
      description,
      shots,
    });
  }

  // Extract project name from first heading, fallback to 'Untitled Project'
  const headingMatch = content.match(/^#\s+(.+?)$/m);
  const projectName = headingMatch ? headingMatch[1].trim() : 'Untitled Project';

  // Extract BPM from content (e.g. "118 BPM"), default to 120
  const bpmMatch = content.match(/(\d{2,3})\s*BPM/i);
  const bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : 120;

  return {
    id: uuid(),
    name: projectName,
    bpm,
    sections,
    defaultParams: {},
  };
}

function parseShotsFromSection(sectionContent: string): ParsedShot[] {
  const shots: ParsedShot[] = [];

  // Split on "**Shot " pattern to find individual shots
  // Also handle "**SCENE" blocks that contain shots
  const shotPattern = /\*\*Shot\s+(\w+)\s*—\s*(.+?)\*\*/g;
  const shotMatches: Array<{ id: string; title: string; index: number }> = [];

  let m;
  while ((m = shotPattern.exec(sectionContent)) !== null) {
    shotMatches.push({
      id: m[1].trim(),
      title: m[2].trim().replace(/"/g, ''),
      index: m.index,
    });
  }

  for (let i = 0; i < shotMatches.length; i++) {
    const shot = shotMatches[i];
    const nextIdx = i + 1 < shotMatches.length ? shotMatches[i + 1].index : sectionContent.length;
    const shotContent = sectionContent.substring(shot.index, nextIdx);

    const type = determineShotType(shotContent);
    const [startTime, endTime] = extractTimeRange(shotContent);
    const concept = extractField(shotContent, 'Concept');
    const lyric = shot.title;

    if (type === 'multi') {
      // Parse takes within rapid cut shots
      const takes = parseTakes(shotContent);

      // Find the shared LTX-2 prompt
      const ltxPromptIdx = shotContent.indexOf('**LTX-2 Prompt');
      const ltxPrompt = ltxPromptIdx !== -1 ? extractCodeBlock(shotContent, ltxPromptIdx) : '';

      // Get the first ref image prompt (for the shot level)
      const refPromptIdx = shotContent.indexOf('**Ref Image Prompt');
      const refPrompt = refPromptIdx !== -1 ? extractCodeBlock(shotContent, refPromptIdx) : '';

      shots.push({
        id: uuid(),
        name: `${shot.id} — ${shot.title}`,
        type,
        startTime,
        endTime,
        lyric,
        concept,
        prompt: ltxPrompt,
        refImagePrompt: refPrompt,
        refImages: [],
        takes,
      });
    } else {
      // HELD or VISUAL ONLY
      const refPromptIdx = shotContent.indexOf('**Ref Image Prompt');
      const refPrompt = refPromptIdx !== -1 ? extractCodeBlock(shotContent, refPromptIdx) : '';

      const ltxPromptIdx = shotContent.indexOf('**LTX-2 Prompt');
      const ltxPrompt = ltxPromptIdx !== -1 ? extractCodeBlock(shotContent, ltxPromptIdx) : '';

      shots.push({
        id: uuid(),
        name: `${shot.id} — ${shot.title}`,
        type,
        startTime,
        endTime,
        lyric,
        concept,
        prompt: ltxPrompt,
        refImagePrompt: refPrompt,
        refImages: [],
      });
    }
  }

  return shots;
}

function parseTakes(shotContent: string): ParsedTake[] {
  const takes: ParsedTake[] = [];

  // Find take patterns like: "CUT 1 (0:13.04 – 0:14.80): text"
  // or "- CUT 1 (timestamp): description"
  const takePattern = /CUT\s+(\d+)\s*\(([^)]+)\):\s*(.+?)(?:\n|$)/g;

  let m;
  while ((m = takePattern.exec(shotContent)) !== null) {
    const takeNum = parseInt(m[1], 10);
    const timeRange = m[2].trim();
    const description = m[3].trim();

    const [startTime, endTime] = extractTimeRange(timeRange);

    // Try to find a specific ref image prompt for this take
    const takeRefPatterns = [
      new RegExp(`\\*\\*Ref Image Prompt\\s*—\\s*(?:Cut\\s*${takeNum}|Angle\\s*${takeNum})[^*]*\\*\\*`, 'i'),
      new RegExp(`\\*\\*Ref Image Prompt\\s*—[^*]*${takeNum}[^*]*\\*\\*`, 'i'),
    ];

    let refPrompt = '';
    for (const pattern of takeRefPatterns) {
      const refMatch = pattern.exec(shotContent);
      if (refMatch) {
        refPrompt = extractCodeBlock(shotContent, refMatch.index);
        break;
      }
    }

    takes.push({
      id: uuid(),
      label: `Take ${takeNum}`,
      startTime,
      endTime,
      concept: description,
      refImagePrompt: refPrompt,
      refImages: [],
    });
  }

  return takes;
}

export function parseCharacterEstablishment(content: string): ParsedShot[] {
  const shots: ParsedShot[] = [];

  // Parse SHOT 1, SHOT 2, etc.
  const shotPattern = /## SHOT (\d+)(?:\s*\(([^)]*)\))?\s*—\s*(.+?)(?:\n)/g;

  let m;
  while ((m = shotPattern.exec(content)) !== null) {
    const shotNum = m[1];
    const optional = m[2] || '';
    const title = m[3].trim();

    // Find the code block after this shot header
    const refPrompt = extractCodeBlock(content, m.index);

    shots.push({
      id: uuid(),
      name: `Character ${shotNum} — ${title}`,
      type: 'held',
      startTime: 0,
      endTime: 0,
      lyric: '',
      concept: `Character establishment: ${title}`,
      prompt: '',
      refImagePrompt: refPrompt,
      refImages: [],
    });
  }

  return shots;
}

export function parseAllMarkdown(
  shotlistContent: string,
  characterContent?: string
): ParsedProject {
  const project = parseShotlistMarkdown(shotlistContent);

  if (characterContent) {
    const characterShots = parseCharacterEstablishment(characterContent);
    if (characterShots.length > 0) {
      // Derive section name from the character doc heading
      const charHeading = characterContent.match(/^#\s+(.+?)$/m);
      const sectionName = charHeading
        ? charHeading[1].trim().toUpperCase()
        : 'CHARACTER ESTABLISHMENT';

      project.sections.unshift({
        id: uuid(),
        name: sectionName,
        startTime: 0,
        endTime: 0,
        description: 'Generate these FIRST — character bible reference shots',
        shots: characterShots,
      });
    }
  }

  return project;
}
