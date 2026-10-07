import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CircleCheck, CircleX, TrendingDown, TrendingUp, X } from 'lucide-react';
import type {
  AnswerResult,
  NextQuestionResponse,
  PracticeQuestionDto,
  PracticeSessionDto,
} from '@learnloop/shared';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorState,
  LoadingBlock,
  ProgressBar,
  cx,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { DIFFICULTY_LABELS, pct } from '../../lib/format';
import { useStartSession } from './StudentHome';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * FR-11..FR-13: a full-screen lesson. Close and progress on top, one question in
 * the middle, and a fixed bottom bar that holds Check, then the marking and Continue.
 */
export function PracticePage() {
  const { sessionId = '' } = useParams();
  const qc = useQueryClient();
  const [result, setResult] = useState<AnswerResult | null>(null);

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

  if (next.isError) {
    return (
      <Shell>
        <ErrorState error={next.error} onRetry={() => void next.refetch()} />
      </Shell>
    );
  }
  if (next.isPending) {
    return (
      <Shell>
        <LoadingBlock label="Loading question" />
      </Shell>
    );
  }

  const { session, question } = next.data;
  const shown = result?.session ?? session;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4">
          <Link
            to="/student"
            aria-label="Save and leave"
            title="Save and leave"
            className="-ml-2 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Link>
          <ProgressBar
            value={shown.answeredCount / shown.totalQuestions}
            label={`${shown.answeredCount} of ${shown.totalQuestions} answered`}
            className="!h-2.5"
          />
          <span className="shrink-0 text-sm tabular text-gray-500">
            {shown.answeredCount}/{shown.totalQuestions}
          </span>
        </div>
      </header>

      {question ? (
        <QuestionView
          key={question.id}
          sessionId={sessionId}
          topic={shown.topicName}
          question={question}
          result={result}
          onAnswered={(r) => {
            setResult(r);
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <Link
        to="/student"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <X className="h-4 w-4" aria-hidden="true" /> Close
      </Link>
      {children}
    </div>
  );
}

function QuestionView({
  sessionId,
  topic,
  question,
  result,
  onAnswered,
  onNext,
}: {
  sessionId: string;
  topic: string;
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
    <form onSubmit={onSubmit} className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-64 pt-10 sm:pt-14">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Badge>{topic}</Badge>
          <Badge tone="brand">
            Level {question.difficulty} · {DIFFICULTY_LABELS[question.difficulty]}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold leading-snug tracking-tight text-gray-900 sm:text-[1.75rem]">
          {question.body}
        </h1>

        <div className="mt-8">
          {options ? (
            <fieldset disabled={Boolean(result) || submit.isPending}>
              <legend className="sr-only">
                Choose an answer (keys A to {LETTERS[options.length - 1]})
              </legend>
              <div className="grid gap-3">
                {options.map((opt, i) => {
                  const picked = answer === opt;
                  const isRight = result && opt === result.correctAnswer;
                  const isWrongPick = result && picked && !result.correct;
                  return (
                    <label
                      key={opt}
                      className={cx(
                        'flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600 has-[:focus-visible]:ring-offset-2',
                        isRight
                          ? 'border-success-500 bg-success-50'
                          : isWrongPick
                            ? 'border-danger-500 bg-danger-50'
                            : picked
                              ? 'border-brand-600 bg-brand-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
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
                      <span
                        className={cx(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold',
                          picked
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-gray-300 text-gray-600',
                        )}
                      >
                        {LETTERS[i]}
                      </span>
                      <span className="text-base tabular text-gray-900">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <div>
              <label htmlFor="answer" className="mb-2 block text-sm font-medium text-gray-700">
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
                  'block h-14 w-full max-w-xs rounded-lg border-2 bg-white px-4 text-2xl tabular shadow-xs focus:outline-none focus:ring-4',
                  result
                    ? result.correct
                      ? 'border-success-500 bg-success-50'
                      : 'border-danger-500 bg-danger-50'
                    : 'border-gray-300 focus:border-brand-600 focus:ring-brand-100',
                )}
              />
              {!result && (
                <p id="answer-hint" className="mt-2 text-sm text-gray-500">
                  Enter a number, decimal or fraction like 3/4.
                </p>
              )}
            </div>
          )}

          {submit.isError && (
            <div className="mt-4">
              <Alert tone="danger">{errorMessage(submit.error)}</Alert>
            </div>
          )}
        </div>
      </main>

      {/* Fixed bottom bar: Check, then the marking with Continue. */}
      <div
        aria-live="polite"
        className={cx(
          'fixed inset-x-0 bottom-0 z-10 border-t',
          result
            ? result.correct
              ? 'border-success-100 bg-success-50'
              : 'border-danger-100 bg-danger-50'
            : 'border-gray-200 bg-white',
          result && 'animate-slide-up',
        )}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
          {result ? (
            <>
              <div className="flex min-w-0 items-start gap-3">
                {result.correct ? (
                  <CircleCheck
                    className="mt-0.5 h-7 w-7 shrink-0 text-success-600"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleX className="mt-0.5 h-7 w-7 shrink-0 text-danger-600" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p
                    className={cx(
                      'text-lg font-semibold',
                      result.correct ? 'text-success-700' : 'text-danger-700',
                    )}
                  >
                    {result.correct
                      ? 'Correct'
                      : `Incorrect. The answer is ${result.correctAnswer}`}
                  </p>
                  <p
                    className={cx(
                      'mt-1 leading-6',
                      result.correct ? 'text-success-700' : 'text-danger-700',
                    )}
                  >
                    {result.explanation}
                  </p>
                  {result.newDifficulty !== result.previousDifficulty && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
                      {result.newDifficulty > result.previousDifficulty ? (
                        <TrendingUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-4 w-4" aria-hidden="true" />
                      )}
                      Level {result.previousDifficulty} → {result.newDifficulty}
                    </p>
                  )}
                </div>
              </div>
              <Button
                ref={nextRef}
                size="lg"
                variant={result.correct ? 'primary' : 'danger'}
                className={cx(
                  'w-full shrink-0 sm:w-auto',
                  result.correct && '!bg-success-600 hover:!bg-success-700',
                )}
                onClick={onNext}
                type="button"
              >
                {result.session.completed ? 'See results' : 'Continue'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <>
              <p className="hidden text-sm text-gray-500 sm:block">
                {options ? 'Press A–D to choose, Enter to check.' : 'Press Enter to check.'}
              </p>
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto sm:min-w-40"
                disabled={!answer.trim()}
                loading={submit.isPending}
              >
                Check
              </Button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

function Summary({ session }: { session: PracticeSessionDto }) {
  const start = useStartSession();
  const { correctCount: correct, answeredCount: total } = session;
  const score = total ? correct / total : 0;
  const message =
    score >= 0.8
      ? 'Strong set. Your next session will start a level higher.'
      : score >= 0.5
        ? 'Solid work. Another set at this level will make it stick.'
        : 'That was a tough one. Your next set will start a little easier.';
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-14">
      <Card className="p-8 text-center">
        <p className="text-sm font-medium text-gray-500">
          {session.assignmentId ? 'Quiz completed' : 'Practice complete'} · {session.topicName}
        </p>
        <p className="mt-4 text-5xl font-semibold tabular tracking-tight text-gray-900">
          {correct}
          <span className="text-gray-400"> / {total}</span>
        </p>
        <p className="mt-1 text-gray-500">{pct(score)} correct</p>
        <ProgressBar
          value={score}
          label={`Score ${pct(score)}`}
          tone={score >= 0.8 ? 'success' : score >= 0.5 ? 'brand' : 'warning'}
          className="mt-5"
        />
        <p className="mt-5 text-gray-600">{message}</p>
        {start.isError && (
          <div className="mt-4 text-left">
            <Alert tone="danger">{errorMessage(start.error)}</Alert>
          </div>
        )}
        <div className="mt-7 flex flex-col gap-2">
          {!session.assignmentId && (
            <Button
              size="lg"
              onClick={() => start.mutate({ topicId: session.topicId })}
              loading={start.isPending}
            >
              Practise {session.topicName} again
            </Button>
          )}
          <ButtonLink to="/student/progress" variant="secondary" size="lg">
            View progress
          </ButtonLink>
          <ButtonLink to="/student" variant="ghost" size="lg">
            Back to home
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
