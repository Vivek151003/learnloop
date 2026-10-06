import { describe, expect, it } from 'vitest';
import { randomJoinCode, safeEqual, stableStringify } from './crypto.js';
import { csvCell } from '../services/classes.js';
import { computeStreak } from '../services/progress.js';

describe('stableStringify', () => {
  it('produces the same string regardless of key order', () => {
    expect(stableStringify({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe(
      stableStringify({ a: { c: null, d: [1, { y: 2, z: 1 }] }, b: 1 }),
    );
  });

  it('drops undefined values like JSON does', () => {
    expect(stableStringify({ a: undefined, b: 2 })).toBe('{"b":2}');
  });
});

describe('randomJoinCode', () => {
  it('uses only unambiguous characters', () => {
    for (let i = 0; i < 200; i++) expect(randomJoinCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});

describe('safeEqual', () => {
  it('compares strings in constant time', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('csvCell', () => {
  it('quotes values and escapes quotes', () => {
    expect(csvCell('Ann "Al" Lee')).toBe('"Ann ""Al"" Lee"');
  });

  it('defuses spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('+1')).toBe('"\'+1"');
  });
});

describe('computeStreak', () => {
  const today = new Date('2026-10-06T12:00:00Z');
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-10-06', '2026-10-05', '2026-10-04', '2026-10-01'], today)).toBe(3);
  });
  it('still counts a streak that ended yesterday', () => {
    expect(computeStreak(['2026-10-05', '2026-10-04'], today)).toBe(2);
  });
  it('is zero after a missed day', () => {
    expect(computeStreak(['2026-10-03'], today)).toBe(0);
  });
});
