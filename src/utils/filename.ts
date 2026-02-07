export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Build the output filename stem for a shot or take.
 * Includes a zero-padded shot index to avoid collisions when
 * multiple shots in the same section share the same name.
 *
 *   Solo:  "sectionname_01_shotname"
 *   Take:  "sectionname_01_shotname_takelabel"
 */
export function buildShotStem(
  sectionName: string,
  shotIndex: number,
  shotName: string,
  takeLabel?: string
): string {
  const pad = String(shotIndex + 1).padStart(2, '0');
  const base = `${sanitizeFilename(sectionName)}_${pad}_${sanitizeFilename(shotName)}`;
  return takeLabel ? `${base}_${sanitizeFilename(takeLabel)}` : base;
}

/**
 * Parse a video file stem to extract the base name and ordinal.
 * Handles OS/tool dedup patterns like:
 *   "name"     → { base: "name", ordinal: 1 }
 *   "name_(2)" → { base: "name", ordinal: 2 }
 *   "name (3)" → { base: "name", ordinal: 3 }
 *   "name_2"   → { base: "name_2", ordinal: 1 }  (not a dedup suffix)
 */
export function parseVideoStem(stem: string): { base: string; ordinal: number } {
  // Match trailing _(N) or (N) or _ (N) patterns (OS/tool dedup markers)
  const dedupMatch = stem.match(/^(.+?)[_ ]?\((\d+)\)$/);
  if (dedupMatch) {
    return {
      base: dedupMatch[1].replace(/_$/, ''),
      ordinal: parseInt(dedupMatch[2], 10),
    };
  }
  return { base: stem, ordinal: 1 };
}

/**
 * Strip trailing _N (underscore + digits) from an expected stem to get
 * the base for relaxed matching against deduped files.
 *   "section_shot_cut_1" → { base: "section_shot_cut", suffix: 1 }
 *   "section_shot_name"  → { base: "section_shot_name", suffix: null }
 */
export function parseExpectedStem(stem: string): { base: string; suffix: number | null } {
  const m = stem.match(/^(.+?)_(\d+)$/);
  if (m) {
    return { base: m[1], suffix: parseInt(m[2], 10) };
  }
  return { base: stem, suffix: null };
}

export interface VideoMatchResult {
  /** expected stem → file path (or paths for versions) */
  matches: Map<string, string[]>;
  /** file stems that couldn't be matched */
  unmatched: string[];
}

/**
 * Two-phase matching: exact first, then relaxed (handles dedup suffixes).
 * @param expectedStems - stems we expect (from sanitizeFilename of section/shot/cut names)
 * @param files - scanned video files with { stem, path }
 */
export function matchVideoFiles(
  expectedStems: string[],
  files: Array<{ stem: string; path: string }>
): VideoMatchResult {
  const matches = new Map<string, string[]>();
  const unmatchedExpected = new Set(expectedStems.map((s) => s.toLowerCase()));
  const unmatchedFiles = new Map(files.map((f) => [f.stem.toLowerCase(), f]));

  // Phase 1: Exact match
  for (const expected of expectedStems) {
    const key = expected.toLowerCase();
    const file = unmatchedFiles.get(key);
    if (file) {
      matches.set(key, [file.path]);
      unmatchedExpected.delete(key);
      unmatchedFiles.delete(key);
    }
  }

  // Phase 2: Relaxed match for remaining files with (N) dedup suffixes
  if (unmatchedExpected.size > 0 && unmatchedFiles.size > 0) {
    // Group remaining files by their base stem (after stripping dedup suffix)
    const fileGroups = new Map<string, Array<{ path: string; ordinal: number; originalStem: string }>>();
    for (const [stem, file] of unmatchedFiles) {
      const { base, ordinal } = parseVideoStem(stem);
      const baseKey = base.replace(/_$/, '').toLowerCase();
      if (!fileGroups.has(baseKey)) fileGroups.set(baseKey, []);
      fileGroups.get(baseKey)!.push({ path: file.path, ordinal, originalStem: stem });
    }

    // Group remaining expected stems by their base (after stripping trailing _N)
    const expectedGroups = new Map<string, Array<{ stem: string; suffix: number }>>();
    for (const expected of unmatchedExpected) {
      const { base, suffix } = parseExpectedStem(expected);
      const baseKey = base.toLowerCase();
      if (!expectedGroups.has(baseKey)) expectedGroups.set(baseKey, []);
      expectedGroups.get(baseKey)!.push({ stem: expected, suffix: suffix ?? 1 });
    }

    // Match groups by base stem
    for (const [baseKey, expectedGroup] of expectedGroups) {
      const fileGroup = fileGroups.get(baseKey);
      if (!fileGroup) continue;

      // Sort both by their ordinal/suffix number
      expectedGroup.sort((a, b) => a.suffix - b.suffix);
      fileGroup.sort((a, b) => a.ordinal - b.ordinal);

      // Map 1:1 by position
      const count = Math.min(expectedGroup.length, fileGroup.length);
      for (let i = 0; i < count; i++) {
        const expected = expectedGroup[i];
        const file = fileGroup[i];
        matches.set(expected.stem, [file.path]);
        unmatchedExpected.delete(expected.stem);
        unmatchedFiles.delete(file.originalStem);
      }

      // Remaining files in this group that didn't match → still unmatched
    }
  }

  // Phase 3: Prefix match for truncated filenames (tools that cap filename length)
  // A file stem that is a prefix of an expected stem (or vice versa) counts as a match
  // if the shorter string is at least 20 chars (avoid false positives on short names)
  if (unmatchedExpected.size > 0 && unmatchedFiles.size > 0) {
    const remainingFiles = Array.from(unmatchedFiles.entries());
    for (const expected of Array.from(unmatchedExpected)) {
      let bestMatch: { stem: string; path: string; overlap: number } | null = null;
      for (const [fileStem, file] of remainingFiles) {
        if (!unmatchedFiles.has(fileStem)) continue;
        const shorter = Math.min(expected.length, fileStem.length);
        if (shorter < 20) continue;
        // Check if one is a prefix of the other
        if (expected.startsWith(fileStem) || fileStem.startsWith(expected)) {
          const overlap = shorter;
          if (!bestMatch || overlap > bestMatch.overlap) {
            bestMatch = { stem: fileStem, path: file.path, overlap };
          }
        }
      }
      if (bestMatch) {
        matches.set(expected, [bestMatch.path]);
        unmatchedExpected.delete(expected);
        unmatchedFiles.delete(bestMatch.stem);
      }
    }
  }

  return {
    matches,
    unmatched: Array.from(unmatchedFiles.values()).map((f) => f.stem),
  };
}
