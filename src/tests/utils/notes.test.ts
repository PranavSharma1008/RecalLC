import { describe, expect, it } from 'vitest';
import {
  cleanExtractedCode,
  parseProblemNotes,
  sanitizeProblemNotes,
  upsertChecklist,
  upsertSolutionCode,
} from '../../utils/notes';

describe('notes utils', () => {
  it('cleanExtractedCode removes rocket artifacts and fixes class Solution', () => {
    const raw = `class \nPush to RecallLC 🚀\n🚀\nSolution {\n    public int[] twoSum() {}\n}`;
    const cleaned = cleanExtractedCode(raw);
    expect(cleaned).toContain('class Solution {');
    expect(cleaned).not.toContain('Push to RecallLC');
    expect(cleaned).not.toContain('🚀');
  });

  it('upsertSolutionCode replaces previous code instead of duplicating', () => {
    const initial = `Some user note\n\nSolution Code (java):\n\`\`\`java\ncode 1\n\`\`\``;
    const updated = upsertSolutionCode(initial, 'code 2', 'java');
    expect(updated).toContain('code 2');
    expect(updated).not.toContain('code 1');
    expect(updated).toContain('Some user note');
  });

  it('upsertChecklist replaces previous checklist instead of duplicating', () => {
    const initial = `Solution Code (java):\n\`\`\`java\ncode\n\`\`\`\n\n## Recall checklist\n- Q1 Ans1`;
    const updated = upsertChecklist(initial, ['- Q1 NewAns', '- Q2 Ans2']);
    expect(updated).toContain('- Q1 NewAns');
    expect(updated).not.toContain('Ans1');
    expect(updated.match(/## Recall checklist/g)?.length).toBe(1);
  });

  it('sanitizeProblemNotes collapses duplicated code and checklists into single clean blocks', () => {
    const duplicatedMess = `
Solution Code (Java):
\`\`\`Java
class 
Push to RecallLC 🚀
🚀
Solution {
    public int[] twoSum() {}
}
\`\`\`

Solution Code (Java):
\`\`\`Java
class 
Push to RecallLC 🚀
🚀
Solution {
    public int[] twoSum() {}
}
\`\`\`

## Recall checklist
- What is the main approach? _(not recorded)_
- What data structure or algorithm is used? _(not recorded)_

## Recall checklist
- What is the main approach? _(not recorded)_
- What data structure or algorithm is used? _(not recorded)_
`;

    const sanitized = sanitizeProblemNotes(duplicatedMess);
    expect(sanitized.match(/Solution Code/g)?.length).toBe(1);
    expect(sanitized.match(/## Recall checklist/g)?.length).toBe(1);
    expect(sanitized).toContain('class Solution {');
    expect(sanitized).not.toContain('Push to RecallLC');
  });

  it('parseProblemNotes separates code, language, checklist and user notes', () => {
    const raw = `My approach was two pointers.\n\nSolution Code (Java):\n\`\`\`Java\nclass Solution {\n    public int[] twoSum() {}\n}\n\`\`\`\n\n## Recall checklist\n- What is the main approach? Two pointers\n- What data structure? Array`;
    const parsed = parseProblemNotes(raw);
    expect(parsed.hasContent).toBe(true);
    expect(parsed.language).toBe('Java');
    expect(parsed.code).toContain('class Solution');
    expect(parsed.userNotes).toBe('My approach was two pointers.');
    expect(parsed.checklist).toEqual(['What is the main approach? Two pointers', 'What data structure? Array']);
  });
});
