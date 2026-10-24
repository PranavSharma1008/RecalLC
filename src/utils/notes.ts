/**
 * Utilities for cleaning and formatting problem notes and solution code.
 */

/** Strip out any injected RecallLC button text, emojis, and non-breaking spaces from extracted code. */
export function cleanExtractedCode(rawCode: string): string {
  if (!rawCode) return '';

  // Replace non-breaking spaces with normal spaces
  let cleaned = rawCode.replace(/\u00a0/g, ' ');

  // Filter out any lines containing RecallLC rocket UI artifacts
  const lines = cleaned.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (/push to recalllc/i.test(trimmed)) return false;
    if (/^[🚀🔥💨✓✕]+$/.test(trimmed)) return false;
    if (trimmed.includes('rlc-')) return false;
    return true;
  });

  cleaned = lines.join('\n');

  // Fix broken syntax where an injected rocket split "class" and "Solution"
  cleaned = cleaned.replace(/\bclass\s*\n+\s*Solution\b/g, 'class Solution');

  return cleaned.trim();
}

/** Removes all existing Solution Code blocks from notes. */
export function removeExistingCodeBlocks(notes: string): string {
  if (!notes) return '';
  const pattern = /(?:^|\n+)Solution Code\s*(?:\([^)]*\))?\s*:\s*\n+```[a-z0-9_-]*\s*[\s\S]*?```/gi;
  return notes.replace(pattern, '').trim();
}

/** Removes all existing "## Recall checklist" blocks from notes. */
export function removeExistingChecklists(notes: string): string {
  if (!notes) return '';
  const lines = notes.split('\n');
  const result: string[] = [];
  let inChecklist = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^## Recall checklist\b/i.test(trimmed)) {
      inChecklist = true;
      continue;
    }

    if (inChecklist) {
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed === '') {
        continue;
      }
      inChecklist = false;
    }

    result.push(line);
  }

  return result.join('\n').trim();
}

/**
 * Inserts or updates the solution code in notes, ensuring only ONE code block exists.
 */
export function upsertSolutionCode(existingNotes: string, code: string, lang: string = 'code'): string {
  const cleanCode = cleanExtractedCode(code);
  if (!cleanCode) return existingNotes;

  const notesWithoutCode = removeExistingCodeBlocks(existingNotes);
  const langTag = lang.toLowerCase() || 'code';
  const codeBlock = `Solution Code (${langTag}):\n\`\`\`${langTag}\n${cleanCode}\n\`\`\``;

  return notesWithoutCode ? `${notesWithoutCode}\n\n${codeBlock}` : codeBlock;
}

/**
 * Inserts or updates the recall checklist in notes, ensuring only ONE checklist exists.
 */
export function upsertChecklist(existingNotes: string, checklistLines: string[]): string {
  const notesWithoutChecklist = removeExistingChecklists(existingNotes);
  const block = `## Recall checklist\n${checklistLines.join('\n')}`;

  return notesWithoutChecklist ? `${notesWithoutChecklist}\n\n${block}` : block;
}

/**
 * Sanitizes messy or duplicated notes:
 * - Keeps only one clean solution code block (stripping "Push to RecallLC", duplicate headers)
 * - Keeps only one recall checklist
 * - Preserves any user handwritten notes
 */
export function sanitizeProblemNotes(notes: string): string {
  if (!notes) return '';

  // Extract all solution code blocks and pick the cleanest/latest one
  const codeBlockRegex = /Solution Code\s*(?:\(([^)]*)\))?\s*:\s*\n+```[a-z0-9_-]*\s*([\s\S]*?)```/gi;
  const matches = [...notes.matchAll(codeBlockRegex)];

  let bestLang = 'code';
  let bestCode = '';

  if (matches.length > 0) {
    // Look for the cleanest code block (preferring one without rocket artifacts)
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      if (!m) continue;
      const lang = m[1] || 'code';
      const rawCode = m[2] || '';
      const cleaned = cleanExtractedCode(rawCode);
      if (cleaned) {
        if (!bestCode) {
          bestLang = lang;
          bestCode = cleaned;
        }
        if (!rawCode.includes('Push to RecallLC') && !rawCode.includes('🚀')) {
          bestLang = lang;
          bestCode = cleaned;
          break;
        }
      }
    }
  }

  // Extract the first recall checklist if any exists
  const checklistRegex = /## Recall checklist\b([\s\S]*?)(?=(?:\n+## |\n+Solution Code|$))/i;
  const checklistMatch = notes.match(checklistRegex);
  let bestChecklist = '';
  if (checklistMatch && checklistMatch[1]) {
    bestChecklist = checklistMatch[1].trim();
  }

  // Remove all code blocks and checklists from notes to get any custom user text
  let remaining = removeExistingCodeBlocks(notes);
  remaining = removeExistingChecklists(remaining).trim();

  // Rebuild cleanly:
  const parts: string[] = [];
  if (bestCode) {
    parts.push(`Solution Code (${bestLang.toLowerCase()}):\n\`\`\`${bestLang.toLowerCase()}\n${bestCode}\n\`\`\``);
  }
  if (bestChecklist) {
    parts.push(`## Recall checklist\n${bestChecklist}`);
  }
  if (remaining) {
    parts.push(remaining);
  }

  return parts.join('\n\n');
}

export interface ParsedNotes {
  hasContent: boolean;
  code: string | null;
  language: string;
  checklist: string[];
  userNotes: string;
}

/**
 * Parses markdown notes into structured components:
 * - Extracted solution code & language
 * - Recall checklist items
 * - Custom handwritten user notes
 */
export function parseProblemNotes(rawNotes: string | null | undefined): ParsedNotes {
  if (!rawNotes || !rawNotes.trim()) {
    return {
      hasContent: false,
      code: null,
      language: '',
      checklist: [],
      userNotes: '',
    };
  }

  const notes = sanitizeProblemNotes(rawNotes);

  // 1. Extract code block
  let code: string | null = null;
  let language = '';
  const codeBlockRegex = /Solution Code\s*(?:\(([^)]*)\))?\s*:\s*\n+```([a-z0-9_-]*)\s*([\s\S]*?)```/i;
  const codeMatch = notes.match(codeBlockRegex);

  if (codeMatch) {
    language = (codeMatch[1] || codeMatch[2] || 'code').trim();
    code = cleanExtractedCode(codeMatch[3] || '');
  } else {
    // Check for generic markdown code fence if Solution Code header wasn't used
    const genericFenceRegex = /```([a-z0-9_-]*)\s*([\s\S]*?)```/i;
    const genericMatch = notes.match(genericFenceRegex);
    if (genericMatch) {
      language = (genericMatch[1] || '').trim() || 'code';
      code = cleanExtractedCode(genericMatch[2] || '');
    }
  }

  // 2. Extract checklist items
  const checklist: string[] = [];
  const checklistRegex = /## Recall checklist\b([\s\S]*?)(?=(?:\n+## |\n+Solution Code|$))/i;
  const checklistMatch = notes.match(checklistRegex);
  if (checklistMatch && checklistMatch[1]) {
    const lines = checklistMatch[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        checklist.push(trimmed.slice(2).trim());
      }
    }
  }

  // 3. User handwritten notes
  let remaining = removeExistingCodeBlocks(notes);
  remaining = removeExistingChecklists(remaining).trim();

  const formattedLang = language ? language.charAt(0).toUpperCase() + language.slice(1).toLowerCase() : 'Code';

  return {
    hasContent: Boolean(code || checklist.length > 0 || remaining),
    code,
    language: formattedLang,
    checklist,
    userNotes: remaining,
  };
}
