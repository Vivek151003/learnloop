// Generates the synthetic grade 6–8 question bank (SRS 2.5, 8.1 data rules).
// Answers are computed, so every question can be checked automatically.

import { parseNumericAnswer } from '@learnloop/shared';

export interface GeneratedQuestion {
  difficulty: number;
  type: 'multiple_choice' | 'numeric';
  body: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export type Rng = () => number;

/** Small seeded PRNG (mulberry32) so the seed data is the same on every machine. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => String(round2(n));

function simplify(n: number, d: number): string {
  const g = gcd(n, d);
  const [sn, sd] = [n / g, d / g];
  return sd === 1 ? String(sn) : `${sn}/${sd}`;
}

/** Turns a numeric question into multiple choice with plausible distractors. */
function asChoice(rng: Rng, q: GeneratedQuestion, distractors: string[]): GeneratedQuestion {
  const value = parseNumericAnswer(q.correctAnswer);
  // Drop any distractor that is numerically equal to the answer (for example 2/4 vs 1/2).
  const isWrong = (c: string) => {
    const v = parseNumericAnswer(c);
    return c !== q.correctAnswer && (v === null || value === null || Math.abs(v - value) > 1e-9);
  };
  const unique = [...new Set(distractors.filter(isWrong))].slice(0, 3);
  const n = Number(q.correctAnswer);
  for (let k = 1; unique.length < 3 && k < 50; k++) {
    const candidate = Number.isFinite(n) ? fmt(n + (k % 2 ? k : -k)) : `${k + 1}/${k + 2}`;
    if (isWrong(candidate) && !unique.includes(candidate)) unique.push(candidate);
  }
  return { ...q, type: 'multiple_choice', options: shuffle(rng, [...unique, q.correctAnswer]) };
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

const signed = (n: number) => (n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`);

type Generator = (rng: Rng, difficulty: number) => GeneratedQuestion;

const fractions: Generator = (rng, d) => {
  const maxDen = [4, 6, 8, 10, 12][d - 1]!;
  const b = int(rng, 2, maxDen);
  const dd = d <= 2 ? b : int(rng, 2, maxDen);
  const a = int(rng, 1, b - 1);
  const c = int(rng, 1, Math.max(1, dd - 1));
  const subtract = d >= 3 && rng() > 0.5 && a / b > c / dd;
  const num = subtract ? a * dd - c * b : a * dd + c * b;
  const den = b * dd;
  const answer = simplify(num, den);
  const op = subtract ? '−' : '+';
  const q: GeneratedQuestion = {
    difficulty: d,
    type: 'numeric',
    body: `Calculate ${a}/${b} ${op} ${c}/${dd}. Give your answer as a fraction in simplest form.`,
    correctAnswer: answer,
    explanation:
      b === dd
        ? `The denominators match, so ${subtract ? 'subtract' : 'add'} the numerators: ${a} ${op} ${c} = ${subtract ? a - c : a + c}, giving ${subtract ? a - c : a + c}/${b}, which simplifies to ${answer}.`
        : `Use the common denominator ${den}: ${a}/${b} = ${a * dd}/${den} and ${c}/${dd} = ${c * b}/${den}. Then ${a * dd} ${op} ${c * b} = ${num}, so the result is ${num}/${den} = ${answer}.`,
  };
  return d <= 2 && rng() > 0.4
    ? asChoice(rng, q, [
        `${a + c}/${b + dd}`,
        simplify(Math.abs(a * dd - c * b) || 1, den),
        `${a + c}/${den}`,
      ])
    : q;
};

const decimals: Generator = (rng, d) => {
  const places = d <= 2 ? 1 : 2;
  const x = round2(int(rng, 10, 99 * d) / 10 ** places);
  const y = round2(int(rng, 10, 99 * d) / 10 ** places);
  if (d >= 4) {
    const m = int(rng, 2, 9);
    return {
      difficulty: d,
      type: 'numeric',
      body: `What is ${x} × ${m}?`,
      correctAnswer: fmt(x * m),
      explanation: `Multiply as whole numbers, then place the decimal point: ${x} × ${m} = ${fmt(x * m)}.`,
    };
  }
  const q: GeneratedQuestion = {
    difficulty: d,
    type: 'numeric',
    body: `What is ${x} + ${y}?`,
    correctAnswer: fmt(x + y),
    explanation: `Line up the decimal points and add each place value: ${x} + ${y} = ${fmt(x + y)}.`,
  };
  return rng() > 0.5 ? asChoice(rng, q, [fmt(x + y + 1), fmt(x + y - 0.1), fmt(x * 10 + y)]) : q;
};

const ratios: Generator = (rng, d) => {
  const a = int(rng, 1, 3 + d);
  const b = int(rng, 1, 3 + d);
  const k = int(rng, 2, 2 + d * 2);
  const item = pick(rng, [
    'red to blue marbles',
    'flour to sugar cups',
    'boys to girls',
    'cats to dogs',
  ]);
  if (d >= 3) {
    const total = (a + b) * k;
    return {
      difficulty: d,
      type: 'numeric',
      body: `The ratio of ${item} is ${a}:${b}. If there are ${total} in total, how many are in the first group?`,
      correctAnswer: String(a * k),
      explanation: `The ratio has ${a} + ${b} = ${a + b} parts. Each part is ${total} ÷ ${a + b} = ${k}, so the first group has ${a} × ${k} = ${a * k}.`,
    };
  }
  const q: GeneratedQuestion = {
    difficulty: d,
    type: 'numeric',
    body: `The ratio of ${item} is ${a}:${b}. If the first group has ${a * k}, how many are in the second group?`,
    correctAnswer: String(b * k),
    explanation: `${a * k} ÷ ${a} = ${k}, so every part of the ratio is multiplied by ${k}: ${b} × ${k} = ${b * k}.`,
  };
  return rng() > 0.5 ? asChoice(rng, q, [String(b * k + a), String(a * k), String(b + k)]) : q;
};

const percentages: Generator = (rng, d) => {
  const pct = d <= 2 ? pick(rng, [10, 25, 50, 20]) : pick(rng, [5, 12, 15, 30, 35, 40, 60, 75]);
  const base = int(rng, 2, 10 + d * 10) * (d <= 2 ? 10 : 4);
  const part = round2((pct / 100) * base);
  if (d >= 4) {
    const up = rng() > 0.5;
    const result = round2(base * (1 + (up ? pct : -pct) / 100));
    return {
      difficulty: d,
      type: 'numeric',
      body: `A price of $${base} is ${up ? 'increased' : 'decreased'} by ${pct}%. What is the new price in dollars?`,
      correctAnswer: fmt(result),
      explanation: `${pct}% of ${base} is ${fmt(part)}. ${up ? 'Add it to' : 'Subtract it from'} the original price: ${base} ${up ? '+' : '−'} ${fmt(part)} = ${fmt(result)}.`,
    };
  }
  const q: GeneratedQuestion = {
    difficulty: d,
    type: 'numeric',
    body: `What is ${pct}% of ${base}?`,
    correctAnswer: fmt(part),
    explanation: `${pct}% means ${pct}/100. Multiply: ${base} × ${pct}/100 = ${fmt(part)}.`,
  };
  return rng() > 0.5
    ? asChoice(rng, q, [fmt(part * 10), fmt(base - part), fmt(pct + base / 10)])
    : q;
};

const integers: Generator = (rng, d) => {
  const span = 5 + d * 5;
  const a = int(rng, -span, span);
  const b = int(rng, -span, span) || 3;
  const op = d <= 2 ? pick(rng, ['+', '−'] as const) : pick(rng, ['+', '−', '×'] as const);
  const result = op === '+' ? a + b : op === '−' ? a - b : a * b;
  const shown = b < 0 ? `(${b})` : String(b);
  const rule =
    op === '×'
      ? 'When multiplying, matching signs give a positive result and different signs give a negative result.'
      : op === '−'
        ? 'Subtracting a number is the same as adding its opposite.'
        : 'When adding numbers with different signs, subtract their sizes and keep the sign of the larger one.';
  const q: GeneratedQuestion = {
    difficulty: d,
    type: 'numeric',
    body: `Calculate ${a} ${op} ${shown}.`,
    correctAnswer: String(result),
    explanation: `${rule} ${a} ${op} ${shown} = ${result}.`,
  };
  return rng() > 0.5
    ? asChoice(rng, q, [String(-result), String(result + 2), String(Math.abs(a) + Math.abs(b))])
    : q;
};

const equations: Generator = (rng, d) => {
  const x = int(rng, -5 - d, 5 + d * 2);
  const a = d <= 1 ? 1 : int(rng, 2, 2 + d * 2);
  const b = int(rng, -10 - d * 3, 10 + d * 3);
  if (d >= 4) {
    const c = int(rng, 1, a - 1);
    const e = (a - c) * x + b;
    return {
      difficulty: d,
      type: 'numeric',
      body: `Solve for x: ${a}x ${signed(b)} = ${c}x ${signed(e)}`,
      correctAnswer: String(x),
      explanation: `Collect the x terms on one side: ${a}x − ${c}x = ${a - c}x. Move the constants to the other side: ${a - c}x = ${e} − (${b}) = ${e - b}. Divide by ${a - c}: x = ${x}.`,
    };
  }
  const c = a * x + b;
  const q: GeneratedQuestion = {
    difficulty: d,
    type: 'numeric',
    body: `Solve for x: ${a === 1 ? '' : a}x ${signed(b)} = ${c}`,
    correctAnswer: String(x),
    explanation: `${b < 0 ? 'Add' : 'Subtract'} ${Math.abs(b)} on both sides to get ${a === 1 ? '' : a}x = ${c - b}${a === 1 ? '' : `, then divide both sides by ${a}`}, so x = ${x}.`,
  };
  return rng() > 0.6 ? asChoice(rng, q, [String(x + 1), String(-x || 2), String(c + b)]) : q;
};

const exponents: Generator = (rng, d) => {
  if (d <= 2) {
    const base = int(rng, 2, 3 + d * 2);
    const exp = int(rng, 2, 2 + d);
    const q: GeneratedQuestion = {
      difficulty: d,
      type: 'numeric',
      body: `What is ${base}^${exp}?`,
      correctAnswer: String(base ** exp),
      explanation: `${base}^${exp} means ${base} multiplied by itself ${exp} times: ${Array(exp).fill(base).join(' × ')} = ${base ** exp}.`,
    };
    return asChoice(rng, q, [String(base * exp), String(base ** (exp - 1)), String(base + exp)]);
  }
  const base = int(rng, 2, 5);
  const m = int(rng, 1, 2 + d);
  const n = int(rng, 1, 2 + d);
  if (d === 5) {
    return {
      difficulty: d,
      type: 'numeric',
      body: `Simplify ${base}^${m + n} ÷ ${base}^${n} and give the value.`,
      correctAnswer: String(base ** m),
      explanation: `When dividing powers with the same base, subtract the exponents: ${base}^(${m + n} − ${n}) = ${base}^${m} = ${base ** m}.`,
    };
  }
  return {
    difficulty: d,
    type: 'numeric',
    body: `Write ${base}^${m} × ${base}^${n} as a single power of ${base}. What is the exponent?`,
    correctAnswer: String(m + n),
    explanation: `When multiplying powers with the same base, add the exponents: ${m} + ${n} = ${m + n}, so the answer is ${base}^${m + n}.`,
  };
};

const geometry: Generator = (rng, d) => {
  const w = int(rng, 2, 4 + d * 3);
  const h = int(rng, 2, 4 + d * 3);
  if (d === 1) {
    const q: GeneratedQuestion = {
      difficulty: d,
      type: 'numeric',
      body: `A rectangle is ${w} cm wide and ${h} cm long. What is its perimeter in cm?`,
      correctAnswer: String(2 * (w + h)),
      explanation: `Perimeter is the distance around: 2 × (${w} + ${h}) = ${2 * (w + h)} cm.`,
    };
    return asChoice(rng, q, [String(w * h), String(w + h), String(2 * w + h)]);
  }
  if (d === 2) {
    return {
      difficulty: d,
      type: 'numeric',
      body: `A rectangle is ${w} m wide and ${h} m long. What is its area in square metres?`,
      correctAnswer: String(w * h),
      explanation: `Area of a rectangle is width × length: ${w} × ${h} = ${w * h} m².`,
    };
  }
  if (d === 3) {
    const base = w * 2;
    return {
      difficulty: d,
      type: 'numeric',
      body: `A triangle has a base of ${base} cm and a height of ${h} cm. What is its area in cm²?`,
      correctAnswer: String((base * h) / 2),
      explanation: `Area of a triangle is ½ × base × height: ½ × ${base} × ${h} = ${(base * h) / 2} cm².`,
    };
  }
  if (d === 4) {
    const top = int(rng, 2, 8);
    const bottom = top + 2 * int(rng, 1, 4);
    return {
      difficulty: d,
      type: 'numeric',
      body: `A trapezoid has parallel sides of ${top} cm and ${bottom} cm and a height of ${h} cm. What is its area in cm²?`,
      correctAnswer: fmt(((top + bottom) / 2) * h),
      explanation: `Area of a trapezoid is ½ × (a + b) × h: ½ × (${top} + ${bottom}) × ${h} = ${fmt(((top + bottom) / 2) * h)} cm².`,
    };
  }
  const l = int(rng, 2, 9);
  return {
    difficulty: d,
    type: 'numeric',
    body: `A box is ${w} cm by ${h} cm by ${l} cm. What is its volume in cm³?`,
    correctAnswer: String(w * h * l),
    explanation: `Volume of a rectangular prism is length × width × height: ${w} × ${h} × ${l} = ${w * h * l} cm³.`,
  };
};

export const TOPICS = [
  { name: 'Fractions', gradeLevel: 6, generate: fractions },
  { name: 'Decimals', gradeLevel: 6, generate: decimals },
  { name: 'Ratios and Rates', gradeLevel: 6, generate: ratios },
  { name: 'Area and Volume', gradeLevel: 6, generate: geometry },
  { name: 'Percentages', gradeLevel: 7, generate: percentages },
  { name: 'Integers', gradeLevel: 7, generate: integers },
  { name: 'Linear Equations', gradeLevel: 8, generate: equations },
  { name: 'Exponents', gradeLevel: 8, generate: exponents },
] as const;

/** Builds `perTopic` questions per topic, spread evenly across difficulties 1–5, without duplicate bodies. */
export function generateBank(rng: Rng, total: number) {
  const out: { topicName: string; question: GeneratedQuestion }[] = [];
  const seen = new Set<string>();
  TOPICS.forEach((topic, ti) => {
    const target = Math.floor(total / TOPICS.length) + (ti < total % TOPICS.length ? 1 : 0);
    let made = 0;
    let guard = 0;
    while (made < target && guard++ < target * 50) {
      const difficulty = (made % 5) + 1;
      const q = topic.generate(rng, difficulty);
      if (seen.has(q.body)) continue;
      seen.add(q.body);
      out.push({ topicName: topic.name, question: q });
      made++;
    }
  });
  return out;
}
