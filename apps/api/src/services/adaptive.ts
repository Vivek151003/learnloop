import { MAX_DIFFICULTY, MIN_DIFFICULTY, parseNumericAnswer } from '@learnloop/shared';

// Pure functions with no I/O, so the adaptive rules are easy to unit test (TST-1).

export interface DifficultyState {
  difficulty: number;
  /** Consecutive results at the current difficulty: +n correct in a row, -n wrong in a row. */
  streak: number;
}

/**
 * FR-12: two correct answers in a row raise difficulty one level, two wrong
 * answers lower it. After a change, the streak resets so the next move again
 * needs two results at the new level. Difficulty stays within 1..5.
 */
export function nextDifficulty(state: DifficultyState, correct: boolean): DifficultyState {
  const streak = correct ? Math.max(state.streak, 0) + 1 : Math.min(state.streak, 0) - 1;
  if (streak >= 2) {
    const raised = Math.min(state.difficulty + 1, MAX_DIFFICULTY);
    return { difficulty: raised, streak: raised === state.difficulty ? streak : 0 };
  }
  if (streak <= -2) {
    const lowered = Math.max(state.difficulty - 1, MIN_DIFFICULTY);
    return { difficulty: lowered, streak: lowered === state.difficulty ? streak : 0 };
  }
  return { difficulty: state.difficulty, streak };
}

/**
 * Mastery is a running average that becomes an exponentially weighted average
 * after a few attempts, so recent work counts most but one answer cannot swing
 * an established score too far.
 */
export function updateMastery(score: number, attempts: number, correct: boolean): number {
  const alpha = Math.max(0.2, 1 / (attempts + 1));
  const next = score * (1 - alpha) + (correct ? 1 : 0) * alpha;
  return Math.round(next * 1000) / 1000;
}

/** Where a new practice session starts, based on current topic mastery. */
export function startingDifficulty(masteryScore: number | undefined): number {
  if (masteryScore === undefined) return 2;
  if (masteryScore < 0.4) return 2;
  if (masteryScore < 0.7) return 3;
  return 4;
}

export function isAnswerCorrect(
  type: 'multiple_choice' | 'numeric',
  correctAnswer: string,
  given: string,
): boolean {
  if (type === 'multiple_choice') {
    return given.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  }
  const expected = parseNumericAnswer(correctAnswer);
  const actual = parseNumericAnswer(given);
  if (expected === null || actual === null) return false;
  return Math.abs(expected - actual) <= 1e-6 * Math.max(1, Math.abs(expected));
}
