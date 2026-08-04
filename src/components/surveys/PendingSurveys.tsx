'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ClipboardCheck, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { surveyService } from '@/services/survey.service';
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/loyalty-errors';
import { formatCurrencyAmount, resolveCurrencySymbol } from '@/lib/currency';
import {
  isSurveyComplete,
  PendingSurvey,
  SURVEY_SCORES,
  toSurveyAnswers,
} from '@/types/survey';

const PAGE_SIZE = 10;

export function PendingSurveys() {
  const { t } = useTranslation();
  const [surveys, setSurveys] = useState<PendingSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // One score map per order, keyed by question id.
  const [scoresByOrder, setScoresByOrder] = useState<Record<string, Record<string, number>>>({});
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number, { append }: { append: boolean }) => {
    setIsLoading(true);
    try {
      const { surveys: items, meta } = await surveyService.getPendingSurveys(targetPage, PAGE_SIZE);
      setSurveys((previous) => (append ? [...previous, ...items] : items));
      setPage(meta?.page ?? targetPage);
      setTotalPages(meta?.totalPages ?? 1);
      setHasError(false);
    } catch (error) {
      console.error('Failed to fetch pending surveys', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, { append: false });
  }, [load]);

  const setScore = (orderId: string, questionId: string, score: number) => {
    setScoresByOrder((previous) => ({
      ...previous,
      [orderId]: { ...previous[orderId], [questionId]: score },
    }));
  };

  const handleSubmit = async (survey: PendingSurvey) => {
    const scores = scoresByOrder[survey.orderId] ?? {};
    if (!isSurveyComplete(survey, scores) || submittingOrderId) return;

    setSubmittingOrderId(survey.orderId);
    try {
      await surveyService.submitAnswers(survey.orderId, toSurveyAnswers(survey, scores));
      toast.success(t('survey.toast.success'));
      // The order is no longer pending; drop it instead of refetching the page.
      setSurveys((previous) => previous.filter((item) => item.orderId !== survey.orderId));
      setScoresByOrder((previous) => {
        const next = { ...previous };
        delete next[survey.orderId];
        return next;
      });
    } catch (error) {
      console.error('Failed to submit survey answers', error);
      const status = getApiErrorStatus(error);

      // Every one of these means our cached list no longer matches the server:
      // 409 already rated, 404 the order stopped being ours or eligible, 400 the
      // branch's question set moved under us. Pull a fresh page in each case.
      if (status === 409) {
        toast.error(t('survey.errors.alreadyEvaluated'));
        await load(1, { append: false });
      } else if (status === 404) {
        toast.error(t('survey.errors.orderUnavailable'));
        await load(1, { append: false });
      } else if (status === 400) {
        toast.error(getApiErrorMessage(error, t('survey.errors.questionsChanged')));
        await load(1, { append: false });
      } else {
        toast.error(getApiErrorMessage(error, t('survey.toast.failed')));
      }
    } finally {
      setSubmittingOrderId(null);
    }
  };

  if (isLoading && surveys.length === 0) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white p-10 text-sm text-zinc-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
        {t('survey.loading')}
      </div>
    );
  }

  if (surveys.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
          <ClipboardCheck className="h-5 w-5" />
        </span>
        <p className="mt-4 text-sm font-medium text-zinc-800">
          {hasError ? t('survey.loadError') : t('survey.empty')}
        </p>
        {hasError && (
          <button
            type="button"
            onClick={() => load(1, { append: false })}
            className="mt-3 text-sm font-medium text-orange-600 hover:underline"
          >
            {t('survey.retry')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {surveys.map((survey) => {
        const scores = scoresByOrder[survey.orderId] ?? {};
        const isComplete = isSurveyComplete(survey, scores);
        const isSubmitting = submittingOrderId === survey.orderId;

        return (
          <div
            key={survey.orderId}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 bg-zinc-50/60 p-4">
              <div className="min-w-0">
                <p className="break-words font-semibold text-zinc-900">
                  {survey.branchName || t('survey.unknownBranch')}
                </p>
                {/* Same short id getOrderDisplayId falls back to, so the two screens match. */}
                <p className="mt-0.5 text-xs font-medium text-zinc-600">
                  {t('survey.orderNo', { id: survey.orderId.slice(0, 8) })}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {new Date(survey.orderDate).toLocaleDateString('tr-TR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-zinc-900">
                {formatCurrencyAmount(survey.totalPrice, resolveCurrencySymbol(survey.currency))}
              </span>
            </div>

            <div className="space-y-5 p-4">
              {survey.questions.map((question) => (
                <fieldset key={question.id}>
                  <legend className="text-sm font-medium text-zinc-800">{question.question}</legend>
                  {question.description && (
                    <p className="mt-1 text-xs text-zinc-500">{question.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SURVEY_SCORES.map((score) => {
                      const isSelected = scores[question.id] === score;
                      const inputId = `survey-${survey.orderId}-${question.id}-${score}`;

                      return (
                        <div key={score}>
                          <input
                            type="radio"
                            id={inputId}
                            name={`survey-${survey.orderId}-${question.id}`}
                            value={score}
                            checked={isSelected}
                            disabled={isSubmitting}
                            onChange={() => setScore(survey.orderId, question.id, score)}
                            className="peer sr-only"
                          />
                          <label
                            htmlFor={inputId}
                            className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 ${
                              isSelected
                                ? 'border-orange-600 bg-orange-600 text-white'
                                : 'border-zinc-200 bg-white text-zinc-600 hover:border-orange-300'
                            }`}
                          >
                            {score}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              <Button
                type="button"
                onClick={() => handleSubmit(survey)}
                disabled={!isComplete}
                isLoading={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  t('survey.submitting')
                ) : (
                  <>
                    <Star className="mr-2 h-4 w-4" />
                    {t('survey.submit')}
                  </>
                )}
              </Button>
              {!isComplete && (
                <p className="text-center text-xs text-zinc-500">{t('survey.answerAllHint')}</p>
              )}
            </div>
          </div>
        );
      })}

      {page < totalPages && (
        <Button
          type="button"
          variant="outline"
          onClick={() => load(page + 1, { append: true })}
          isLoading={isLoading}
          className="w-full"
        >
          {t('survey.loadMore')}
        </Button>
      )}
    </div>
  );
}
