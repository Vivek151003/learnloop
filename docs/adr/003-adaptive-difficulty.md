# ADR-003: Adaptive difficulty and mastery

**Status:** accepted · 2026-10-06

## Context

FR-12: "two correct answers in a row raise it one level, two wrong answers lower it".
FR-15 needs a mastery score per topic, and FR-16 needs resumable sessions.

## Decision

- **Streak state on the session.** `practice_sessions.streak` is +n after n correct answers
  in a row at the current level, and −n after n wrong. At +2 the level goes up and at −2 it
  goes down, and the streak resets after any change. So "two in a row" always means two at
  the current level. The rule is a pure function, `nextDifficulty()`, and is unit tested.
- **Only free practice adapts.** Assigned quizzes are fixed and served in the teacher's order.
- **Question selection:** a random approved question in the topic at the target level that
  the student has not seen in this session. The level band widens (±1, ±2, ±4) if none is left.
- **Mastery:** a running average for the first 5 answers, then an exponentially weighted
  average with α = 0.2. Early answers count fully, recent ones count most, and one answer
  cannot swing an established score far.
- **Resumable sessions:** the pending question ID is stored on the session. Asking for the
  next question is idempotent, and answering uses a conditional update, so double submits and
  two open tabs cannot record two attempts.
- **Starting level** comes from the student's current mastery of the topic (2, 3 or 4).

## Consequences

- Difficulty changes are explainable to students ("Nice streak! Moving up to level 4").
- A more advanced model (for example Elo or IRT) can replace `nextDifficulty` and
  `updateMastery` without touching the routes.
