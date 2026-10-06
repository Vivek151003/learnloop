import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswerResult, NextQuestionResponse, PracticeQuestionDto } from '@learnloop/shared';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorState,
  Input,
  LoadingBlock,
  Meter,
  cx,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { DIFFICULTY_LABELS, pct } from '../../lib/format';
import { useStartSession } from './StudentHome';

/** FR-11..FR-13: one question at a time, instant feedback, adaptive difficulty. */
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

  if (next.isError) return <ErrorState error={next.error} onRetry={() => void next.refetch()} />;
  if (next.isPending) return <LoadingBlock label="Loading question" />;

  const { session, question } = next.data;
  const shown = result?.session ?? session;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link to="/student" className="text-brand-700 hover:underline">
            ← Home
          </Link>
          <span className="text-ink-muted">
            {shown.topicName} · Question{' '}
            {Math.min(shown.answeredCount + (result ? 0 : 1), shown.totalQuestions)} of{' '}
            {shown.totalQuestions}
          </span>
        </div>
        <Meter value={shown.answeredCount / shown.totalQuestions} label="Session progress" />
      </div>

      {question ? (
        <QuestionCard
          key={question.id}
          sessionId={sessionId}
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
        <SessionSummary
          correct={shown.correctCount}
          total={shown.answeredCount}
          topicId={shown.topicId}
          isAssignment={Boolean(shown.assignmentId)}
        />
      )}
    </div>
  );
}

function QuestionCard({
  sessionId,
  question,
  result,
  onAnswered,
  onNext,
}: {
  sessionId: string;
  question: PracticeQuestionDto;
  result: AnswerResult | null;
  onAnswered: (r: AnswerResult) => void;
  onNext: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const startedAt = useRef(Date.now());
  const nextRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (answer.trim() && !result) submit.mutate();
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-2">
        <Badge tone="brand">
          Level {question.difficulty} · {DIFFICULTY_LABELS[question.difficulty]}
        </Badge>
      </div>
      <h1 className="text-xl font-medium leading-relaxed text-ink">{question.body}</h1>

      <form className="mt-6" onSubmit={onSubmit}>
        {question.type === 'multiple_choice' && question.options ? (
          <fieldset disabled={Boolean(result) || submit.isPending}>
            <legend className="sr-only">Choose an answer</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {question.options.map((opt) => {
                const isPicked = answer === opt;
                const isRight = result && opt === result.correctAnswer;
                const isWrongPick = result && isPicked && !result.correct;
                return (
                  <label
                    key={opt}
                    className={cx(
                      'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-ink transition',
                      isRight
                        ? 'border-success-fg bg-success-bg'
                        : isWrongPick
                          ? 'border-danger-fg bg-danger-bg'
                          : isPicked
                            ? 'border-brand-600 bg-brand-50'
                            : 'border-line hover:border-brand-200',
                    )}
                  >
                    <input
                      type="radio"
                      name="answer"
                      value={opt}
                      checked={isPicked}
                      onChange={() => setAnswer(opt)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className="tabular-nums">{opt}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <Input
            ref={inputRef}
            label="Your answer"
            inputMode="decimal"
            autoComplete="off"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={Boolean(result) || submit.isPending}
            hint="Numbers, decimals or fractions like 3/4."
          />
        )}

        {submit.isError && (
          <div className="mt-4">
            <Alert tone="danger">{errorMessage(submit.error)}</Alert>
          </div>
        )}

        {!result && (
          <Button
            type="submit"
            size="lg"
            className="mt-6 w-full sm:w-auto"
            disabled={!answer.trim()}
            loading={submit.isPending}
          >
            Check answer
          </Button>
        )}
      </form>

      {/* Feedback is announced to screen readers as soon as it appears (NFR-5). */}
      <div aria-live="polite" aria-atomic="true">
        {result && (
          <div
            className={cx(
              'mt-6 rounded-lg border p-4',
              result.correct
                ? 'border-success-line bg-success-bg'
                : 'border-danger-line bg-danger-bg',
            )}
          >
            <p
              className={cx('font-semibold', result.correct ? 'text-success-fg' : 'text-danger-fg')}
            >
              {result.correct ? 'Correct!' : `Not quite. The answer is ${result.correctAnswer}.`}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink">{result.explanation}</p>
            {result.newDifficulty !== result.previousDifficulty && (
              <p className="mt-3 text-sm font-medium text-ink-muted">
                {result.newDifficulty > result.previousDifficulty
                  ? `Nice streak! Moving up to level ${result.newDifficulty}.`
                  : `Let’s steady things at level ${result.newDifficulty}.`}
              </p>
            )}
          </div>
        )}
      </div>

      {result && (
        <Button ref={nextRef} size="lg" className="mt-6 w-full sm:w-auto" onClick={onNext}>
          {result.session.completed ? 'See results' : 'Next question'}
        </Button>
      )}
    </Card>
  );
}

function SessionSummary({
  correct,
  total,
  topicId,
  isAssignment,
}: {
  correct: number;
  total: number;
  topicId: string;
  isAssignment: boolean;
}) {
  const start = useStartSession();
  const score = total ? correct / total : 0;
  return (
    <Card className="p-8 text-center">
      <p className="text-sm font-medium text-brand-700">
        {isAssignment ? 'Assignment complete' : 'Session complete'}
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">
        {correct} / {total} correct
      </h1>
      <p className="mt-2 text-ink-muted">
        {score >= 0.8
          ? 'Excellent work, you’re mastering this.'
          : score >= 0.5
            ? 'Good progress. Another round will lock it in.'
            : 'Every attempt builds skill. Try another round.'}
      </p>
      <div className="mx-auto mt-6 max-w-xs">
        <Meter
          value={score}
          label={`Score ${pct(score)}`}
          tone={score >= 0.8 ? 'success' : score >= 0.5 ? 'brand' : 'warn'}
        />
      </div>
      {start.isError && (
        <div className="mt-4">
          <Alert tone="danger">{errorMessage(start.error)}</Alert>
        </div>
      )}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button onClick={() => start.mutate({ topicId })} loading={start.isPending}>
          Practise this topic again
        </Button>
        <ButtonLink to="/student/progress" variant="secondary">
          View progress
        </ButtonLink>
      </div>
    </Card>
  );
}
