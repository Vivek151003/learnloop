import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnswerResult,
  NextQuestionResponse,
  PracticeQuestionDto,
  PracticeSessionDto,
} from '@learnloop/shared';
import { Alert, Button, ButtonLink, ErrorState, LoadingBlock, cx } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { DIFFICULTY_LABELS } from '../../lib/format';
import { useStartSession } from './StudentHome';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Exercise-book margin: a faint red rule down the left, as on lined paper. */
const marginRule =
  'before:absolute before:inset-y-0 before:left-10 before:w-px before:bg-incorrect/20 sm:before:left-14';

/** FR-11..FR-13: one question at a time, instant marking, adaptive difficulty. */
export function PracticePage() {
  const { sessionId = '' } = useParams();
  const qc = useQueryClient();
  const [result, setResult] = useState<AnswerResult | null>(null);
  // Marks for questions answered while this page was open; earlier ones show as neutral.
  const [marks, setMarks] = useState<boolean[]>([]);

  const next = useQuery({
    queryKey: ['practice', sessionId],
    queryFn: () => api.get<NextQuestionResponse>(`/practice/sessions/${sessionId}/next`),
    staleTime: Infinity,
  });

  const goNext = () => {
    setResult(null);
    // Reset (not just invalidate) so the old question never flashes while loading.
    void qc.resetQueries({ queryKey: ['practice', sessionId] });
  };

  if (next.isError) return <ErrorState error={next.error} onRetry={() => void next.refetch()} />;
  if (next.isPending) return <LoadingBlock label="Loading question" />;

  const { session, question } = next.data;
  const shown = result?.session ?? session;
  const qNumber = Math.min(shown.answeredCount + (result ? 0 : 1), shown.totalQuestions);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-4 text-sm">
        <Link to="/student" className="text-ink-2 hover:text-ink">
          <span aria-hidden="true">←</span> Save and leave
        </Link>
        <span className="eyebrow">{shown.assignmentId ? 'Assigned quiz' : 'Practice'}</span>
      </div>

      <Progress session={shown} marks={marks} />

      {question ? (
        <QuestionSheet
          key={question.id}
          sessionId={sessionId}
          topic={shown.topicName}
          number={qNumber}
          total={shown.totalQuestions}
          question={question}
          result={result}
          onAnswered={(r) => {
            setResult(r);
            setMarks((m) => [...m, r.correct]);
            void qc.invalidateQueries({ queryKey: ['progress'] });
            void qc.invalidateQueries({ queryKey: ['assignments'] });
            void qc.invalidateQueries({ queryKey: ['sessions'] });
          }}
          onNext={goNext}
        />
      ) : (
        <Summary session={shown} />
      )}
    </div>
  );
}

/** One segment per question: green or red once marked, grey if answered on an earlier visit. */
function Progress({ session, marks }: { session: PracticeSessionDto; marks: boolean[] }) {
  const earlier = session.answeredCount - marks.length;
  return (
    <ol
      aria-label={`${session.answeredCount} of ${session.totalQuestions} answered`}
      className="mb-6 grid gap-1"
      style={{ gridTemplateColumns: `repeat(${session.totalQuestions}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: session.totalQuestions }, (_, i) => {
        const mark = i >= earlier ? marks[i - earlier] : undefined;
        const answered = i < session.answeredCount;
        return (
          <li
            key={i}
            className={cx(
              'h-1.5 rounded-full',
              !answered
                ? i === session.answeredCount
                  ? 'bg-pencil'
                  : 'bg-rule'
                : mark === undefined
                  ? 'bg-ink-4'
                  : mark
                    ? 'bg-correct'
                    : 'bg-incorrect',
            )}
          />
        );
      })}
    </ol>
  );
}

function LevelPips({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={cx('h-2.5 w-1 rounded-full', n <= level ? 'bg-ink' : 'bg-rule-strong')}
          />
        ))}
      </span>
      <span className="font-mono text-xs text-ink-2">
        Level {level} · {DIFFICULTY_LABELS[level]}
      </span>
    </span>
  );
}

function QuestionSheet({
  sessionId,
  topic,
  number,
  total,
  question,
  result,
  onAnswered,
  onNext,
}: {
  sessionId: string;
  topic: string;
  number: number;
  total: number;
  question: PracticeQuestionDto;
  result: AnswerResult | null;
  onAnswered: (r: AnswerResult) => void;
  onNext: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const startedAt = useRef(Date.now());
  const nextRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const options = question.type === 'multiple_choice' ? question.options : null;

  const submit = useMutation({
    mutationFn: () =>
      api.post<AnswerResult>(`/practice/sessions/${sessionId}/answer`, {
        questionId: question.id,
        answer,
        timeMs: Date.now() - startedAt.current,
      }),
    onSuccess: onAnswered,
  });

  useEffect(() => {
    if (result) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [result]);

  // Keyboard: A–F (or 1–6) picks an option; Enter submits through the form.
  useEffect(() => {
    if (!options || result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toUpperCase();
      const idx = /^[1-6]$/.test(key) ? Number(key) - 1 : LETTERS.indexOf(key);
      const opt = options[idx];
      if (opt !== undefined) setAnswer(opt);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, result]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (answer.trim() && !result && !submit.isPending) submit.mutate();
  };

  return (
    <article className="rounded-md border border-rule bg-paper-raised">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3 sm:px-6">
        <span className="text-sm font-medium">{topic}</span>
        <span className="flex items-center gap-4">
          <LevelPips level={question.difficulty} />
          <span className="font-mono text-xs text-ink-3">
            Q{number} / {total}
          </span>
        </span>
      </header>

      <div className={cx('relative py-8 pl-14 pr-5 sm:pl-20 sm:pr-8', marginRule)}>
        <span className="absolute left-3 top-9 font-mono text-sm text-ink-3 sm:left-5">
          {number}.
        </span>
        <h1 className="font-serif text-2xl leading-snug sm:text-[1.7rem]">{question.body}</h1>

        <form className="mt-8" onSubmit={onSubmit}>
          {options ? (
            <fieldset disabled={Boolean(result) || submit.isPending}>
              <legend className="sr-only">
                Choose an answer (keys A to {LETTERS[options.length - 1]})
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {options.map((opt, i) => {
                  const picked = answer === opt;
                  const isRight = result && opt === result.correctAnswer;
                  const isWrongPick = result && picked && !result.correct;
                  return (
                    <label
                      key={opt}
                      className={cx(
                        'flex cursor-pointer items-center gap-3 rounded border px-3 py-2.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink',
                        isRight
                          ? 'border-correct bg-correct-soft'
                          : isWrongPick
                            ? 'border-incorrect bg-incorrect-soft'
                            : picked
                              ? 'border-ink bg-pencil-soft'
                              : 'border-rule-strong hover:border-ink-3',
                      )}
                    >
                      <input
                        type="radio"
                        name="answer"
                        value={opt}
                        checked={picked}
                        onChange={() => setAnswer(opt)}
                        className="sr-only"
                      />
                      <kbd
                        className={cx(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border font-mono text-xs',
                          picked ? 'border-ink bg-ink text-white' : 'border-rule-strong text-ink-2',
                        )}
                      >
                        {LETTERS[i]}
                      </kbd>
                      <span className="font-mono tabular-nums">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <div>
              <label htmlFor="answer" className="eyebrow">
                Your answer
              </label>
              <input
                id="answer"
                ref={inputRef}
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={Boolean(result) || submit.isPending}
                aria-describedby={result ? undefined : 'answer-hint'}
                className={cx(
                  'mt-2 block h-14 w-full max-w-[16rem] rounded border bg-paper-raised px-4 font-mono text-2xl tabular-nums focus:outline-none',
                  result
                    ? result.correct
                      ? 'border-correct'
                      : 'border-incorrect'
                    : 'border-rule-strong border-b-2 border-b-ink focus:border-ink',
                )}
              />
              {!result && (
                <p id="answer-hint" className="mt-2 text-sm text-ink-3">
                  Whole numbers, decimals or fractions like 3/4.
                </p>
              )}
            </div>
          )}

          {submit.isError && (
            <div className="mt-4">
              <Alert tone="wrong">{errorMessage(submit.error)}</Alert>
            </div>
          )}

          {!result && (
            <div className="mt-8 flex items-center gap-4">
              <Button type="submit" size="lg" disabled={!answer.trim()} loading={submit.isPending}>
                Check
              </Button>
              <span className="hidden text-sm text-ink-3 sm:inline">
                or press{' '}
                <kbd className="rounded-sm border border-rule-strong px-1 font-mono text-xs">
                  Enter
                </kbd>
              </span>
            </div>
          )}
        </form>

        {/* Marking is announced to screen readers as soon as it appears (NFR-5). */}
        <div aria-live="polite" aria-atomic="true">
          {result && (
            <div
              className={cx(
                'mt-8 border-l-[3px] pl-4',
                result.correct ? 'border-correct' : 'border-incorrect',
              )}
            >
              <p
                className={cx('font-semibold', result.correct ? 'text-correct' : 'text-incorrect')}
              >
                {result.correct ? (
                  'Correct.'
                ) : (
                  <>
                    Not quite. The answer is{' '}
                    <span className="font-mono">{result.correctAnswer}</span>.
                  </>
                )}
              </p>
              <p className="mt-1.5 max-w-prose leading-7 text-ink-2">{result.explanation}</p>
              {result.newDifficulty !== result.previousDifficulty && (
                <p className="mt-3 font-mono text-xs text-ink-2">
                  Level {result.previousDifficulty} → {result.newDifficulty}{' '}
                  <span className="font-sans">
                    {result.newDifficulty > result.previousDifficulty
                      ? '· two in a row, stepping up'
                      : '· easing off a level'}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        {result && (
          <Button ref={nextRef} size="lg" className="mt-8" onClick={onNext}>
            {result.session.completed ? 'See how you did' : 'Next question'}
          </Button>
        )}
      </div>
    </article>
  );
}

function Summary({ session }: { session: PracticeSessionDto }) {
  const start = useStartSession();
  const { correctCount: correct, answeredCount: total } = session;
  const score = total ? correct / total : 0;
  const line =
    score >= 0.8
      ? 'Strong set. The next session will start a level higher.'
      : score >= 0.5
        ? 'Solid. Another set at this level will make it stick.'
        : 'A tough set. The next one will start a little easier.';
  return (
    <article className="rounded-md border border-rule bg-paper-raised px-6 py-10 text-center sm:px-10">
      <p className="eyebrow">
        {session.assignmentId ? 'Quiz handed in' : 'Set complete'} · {session.topicName}
      </p>
      <p className="mt-4 font-mono text-6xl font-medium tabular-nums tracking-tight">
        {correct}
        <span className="text-ink-4">/{total}</span>
      </p>
      <p className="mx-auto mt-4 max-w-sm text-ink-2">{line}</p>
      {start.isError && (
        <div className="mx-auto mt-4 max-w-sm text-left">
          <Alert tone="wrong">{errorMessage(start.error)}</Alert>
        </div>
      )}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {!session.assignmentId && (
          <Button
            onClick={() => start.mutate({ topicId: session.topicId })}
            loading={start.isPending}
          >
            Another 10 on {session.topicName}
          </Button>
        )}
        <ButtonLink to="/student/progress" variant="secondary">
          See progress
        </ButtonLink>
        <ButtonLink to="/student" variant="quiet">
          Back to practice
        </ButtonLink>
      </div>
    </article>
  );
}
