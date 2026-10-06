import { describe, expect, it } from 'vitest';
import { isAnswerCorrect, nextDifficulty, startingDifficulty, updateMastery } from './adaptive.js';

const run = (start: number, answers: boolean[]) =>
  answers.reduce((s, c) => nextDifficulty(s, c), { difficulty: start, streak: 0 }).difficulty;

describe('nextDifficulty (FR-12)', () => {
  it('raises one level after two correct answers in a row', () => {
    expect(run(3, [true])).toBe(3);
    expect(run(3, [true, true])).toBe(4);
  });

  it('lowers one level after two wrong answers in a row', () => {
    expect(run(3, [false, false])).toBe(2);
  });

  it('needs two fresh results at the new level before moving again', () => {
    expect(run(3, [true, true, true])).toBe(4);
    expect(run(3, [true, true, true, true])).toBe(5);
  });

  it('resets the streak when the result changes', () => {
    expect(run(3, [true, false, true, false])).toBe(3);
    expect(run(3, [true, false, false])).toBe(2);
  });

  it('stays within 1..5', () => {
    expect(run(5, [true, true, true, true])).toBe(5);
    expect(run(1, [false, false, false, false])).toBe(1);
  });
});

describe('updateMastery', () => {
  it('first answer counts fully', () => {
    expect(updateMastery(0, 0, true)).toBe(1);
    expect(updateMastery(0, 0, false)).toBe(0);
  });

  it('is a running average early on', () => {
    expect(updateMastery(1, 1, false)).toBe(0.5);
  });

  it('weights recent answers at 20% once established', () => {
    expect(updateMastery(0.5, 10, true)).toBe(0.6);
    expect(updateMastery(0.5, 10, false)).toBe(0.4);
  });
});

describe('startingDifficulty', () => {
  it.each([
    [undefined, 2],
    [0.2, 2],
    [0.5, 3],
    [0.9, 4],
  ])('mastery %s starts at %i', (m, d) => expect(startingDifficulty(m)).toBe(d));
});

describe('isAnswerCorrect', () => {
  it('compares numeric answers by value', () => {
    expect(isAnswerCorrect('numeric', '0.75', '3/4')).toBe(true);
    expect(isAnswerCorrect('numeric', '1250', '1,250')).toBe(true);
    expect(isAnswerCorrect('numeric', '-5', '−5')).toBe(true);
    expect(isAnswerCorrect('numeric', '5', '6')).toBe(false);
    expect(isAnswerCorrect('numeric', '5', 'five')).toBe(false);
  });

  it('compares multiple choice case-insensitively', () => {
    expect(isAnswerCorrect('multiple_choice', 'Blue', ' blue ')).toBe(true);
    expect(isAnswerCorrect('multiple_choice', 'Blue', 'Red')).toBe(false);
  });
});
