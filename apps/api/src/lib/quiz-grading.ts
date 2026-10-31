export interface GradableQuestion {
  id: string;
  marks: number;
}

export interface QuestionResult {
  questionId: string;
  correct: boolean;
  marksAwarded: number;
}

/** Order-insensitive set equality of option ids. */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

/**
 * Server-side auto-grading. Multi-select is all-or-nothing per question;
 * unanswered questions score 0. Score = sum of marks of fully-correct questions.
 */
export function gradeAttempt(
  questions: readonly GradableQuestion[],
  answerKey: ReadonlyMap<string, readonly string[]>,
  answers: Readonly<Record<string, readonly string[]>>,
): { score: number; results: QuestionResult[] } {
  const results = questions.map((question) => {
    const expected = answerKey.get(question.id) ?? [];
    const given = answers[question.id] ?? [];
    const correct = expected.length > 0 && given.length > 0 && sameSet(expected, given);
    return { questionId: question.id, correct, marksAwarded: correct ? question.marks : 0 };
  });
  const score = results.reduce((sum, result) => sum + result.marksAwarded, 0);
  return { score: Math.round(score * 100) / 100, results };
}

/** Deterministic PRNG (mulberry32) so a resumed attempt keeps its order. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Fisher-Yates shuffle seeded by a string (e.g. student id + quiz id). */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const random = mulberry32(hashString(seed));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
