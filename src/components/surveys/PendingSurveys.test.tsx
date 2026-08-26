import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PendingSurveys } from './PendingSurveys';
import { surveyService } from '@/services/survey.service';
import type { PendingSurvey } from '@/types/survey';

vi.mock('@/services/survey.service', () => ({
  surveyService: { getPendingSurveys: vi.fn(), submitAnswers: vi.fn() },
}));

const stable = vi.hoisted(() => ({
  translation: { t: (key: string) => key },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => stable.translation,
  // The component now resolves API error codes through `@/lib/api-errors`,
  // which pulls in the i18n config module.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('sonner', () => ({ toast: stable.toast }));

const mockedSurveyService = vi.mocked(surveyService);

const survey = (orderId: string, questionIds: string[] = ['q1', 'q2']): PendingSurvey => ({
  orderId,
  branchId: 'branch-1',
  branchName: 'Kadıköy Şubesi',
  orderStatus: 'DELIVERED',
  orderType: 'DELIVERY',
  totalPrice: 450,
  currency: 'TRY',
  orderDate: '2026-08-01T10:00:00.000Z',
  questions: questionIds.map((id, index) => ({
    id,
    question: `Soru ${index + 1}`,
    description: index === 0 ? '1 en düşük, 5 en yüksek puandır.' : null,
  })),
});

const page = (items: PendingSurvey[], overrides: Partial<{ page: number; totalPages: number }> = {}) => ({
  surveys: items,
  meta: { total: items.length, page: 1, limit: 10, totalPages: 1, ...overrides },
});

/** Picks `score` for the question at `questionIndex` of the only rendered survey. */
const score = (questionIndex: number, value: number) => {
  const groups = screen.getAllByRole('group');
  fireEvent.click(within(groups[questionIndex]).getByText(String(value)));
};

const submitButton = () => screen.getByRole('button', { name: /survey.submit/ });

describe('<PendingSurveys />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSurveyService.getPendingSurveys.mockResolvedValue(page([survey('order-1')]));
    mockedSurveyService.submitAnswers.mockResolvedValue({
      orderId: 'order-1',
      surveyDate: '2026-08-01T10:05:00.000Z',
      answers: [],
    });
  });

  it('asks for the first page on mount', async () => {
    render(<PendingSurveys />);

    await waitFor(() => expect(mockedSurveyService.getPendingSurveys).toHaveBeenCalledWith(1, 10));
  });

  it('lists the branch and every question of a pending order', async () => {
    render(<PendingSurveys />);

    expect(await screen.findByText('Kadıköy Şubesi')).toBeInTheDocument();
    expect(screen.getByText('Soru 1')).toBeInTheDocument();
    expect(screen.getByText('Soru 2')).toBeInTheDocument();
    expect(screen.getByText('1 en düşük, 5 en yüksek puandır.')).toBeInTheDocument();
  });

  it('keeps submit disabled until every question is scored', async () => {
    render(<PendingSurveys />);
    await screen.findByText('Kadıköy Şubesi');

    expect(submitButton()).toBeDisabled();

    score(0, 5);
    expect(submitButton()).toBeDisabled();

    score(1, 4);
    expect(submitButton()).toBeEnabled();
  });

  it('submits every answer exactly once, in question order', async () => {
    render(<PendingSurveys />);
    await screen.findByText('Kadıköy Şubesi');

    score(0, 5);
    score(1, 4);
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(mockedSurveyService.submitAnswers).toHaveBeenCalledWith('order-1', [
        { questionId: 'q1', score: 5 },
        { questionId: 'q2', score: 4 },
      ]),
    );
  });

  it('keeps the last score when a question is re-answered', async () => {
    render(<PendingSurveys />);
    await screen.findByText('Kadıköy Şubesi');

    score(0, 2);
    score(0, 5);
    score(1, 3);
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(mockedSurveyService.submitAnswers).toHaveBeenCalledWith('order-1', [
        { questionId: 'q1', score: 5 },
        { questionId: 'q2', score: 3 },
      ]),
    );
  });

  it('drops the order from the list once it is rated', async () => {
    render(<PendingSurveys />);
    await screen.findByText('Kadıköy Şubesi');

    score(0, 5);
    score(1, 5);
    fireEvent.click(submitButton());

    await waitFor(() => expect(stable.toast.success).toHaveBeenCalledWith('survey.toast.success'));
    await waitFor(() => expect(screen.getByText('survey.empty')).toBeInTheDocument());
  });

  it('refetches when the backend says the order was already rated', async () => {
    mockedSurveyService.submitAnswers.mockRejectedValue({ response: { status: 409, data: {} } });

    render(<PendingSurveys />);
    await screen.findByText('Kadıköy Şubesi');

    score(0, 5);
    score(1, 5);
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(stable.toast.error).toHaveBeenCalledWith('survey.errors.alreadyEvaluated'),
    );
    expect(mockedSurveyService.getPendingSurveys).toHaveBeenCalledTimes(2);
  });

  it('refetches when the order is no longer rateable', async () => {
    mockedSurveyService.submitAnswers.mockRejectedValue({ response: { status: 404, data: {} } });

    render(<PendingSurveys />);
    await screen.findByText('Kadıköy Şubesi');

    score(0, 5);
    score(1, 5);
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(stable.toast.error).toHaveBeenCalledWith('survey.errors.orderUnavailable'),
    );
    expect(mockedSurveyService.getPendingSurveys).toHaveBeenCalledTimes(2);
  });

  it('refetches and surfaces the backend message on a 400', async () => {
    mockedSurveyService.submitAnswers.mockRejectedValue({
      response: { status: 400, data: { message: 'Question set does not match' } },
    });

    render(<PendingSurveys />);
    await screen.findByText('Kadıköy Şubesi');

    score(0, 5);
    score(1, 5);
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(stable.toast.error).toHaveBeenCalledWith('Question set does not match'),
    );
    expect(mockedSurveyService.getPendingSurveys).toHaveBeenCalledTimes(2);
  });

  it('keeps the order listed when submitting fails for another reason', async () => {
    mockedSurveyService.submitAnswers.mockRejectedValue({ response: { status: 500, data: {} } });

    render(<PendingSurveys />);
    await screen.findByText('Kadıköy Şubesi');

    score(0, 5);
    score(1, 5);
    fireEvent.click(submitButton());

    await waitFor(() => expect(stable.toast.error).toHaveBeenCalledWith('survey.toast.failed'));
    expect(screen.getByText('Kadıköy Şubesi')).toBeInTheDocument();
    // A plain failure must not silently discard what the user picked.
    expect(mockedSurveyService.getPendingSurveys).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when the list could not be loaded', async () => {
    mockedSurveyService.getPendingSurveys.mockRejectedValueOnce(new Error('network'));

    render(<PendingSurveys />);

    expect(await screen.findByText('survey.loadError')).toBeInTheDocument();
    mockedSurveyService.getPendingSurveys.mockResolvedValue(page([survey('order-1')]));
    fireEvent.click(screen.getByText('survey.retry'));

    expect(await screen.findByText('Kadıköy Şubesi')).toBeInTheDocument();
  });

  it('appends the next page instead of replacing the current one', async () => {
    mockedSurveyService.getPendingSurveys.mockResolvedValueOnce(
      page([survey('order-1')], { page: 1, totalPages: 2 }),
    );

    render(<PendingSurveys />);
    await screen.findByText('Kadıköy Şubesi');

    mockedSurveyService.getPendingSurveys.mockResolvedValueOnce({
      surveys: [{ ...survey('order-2'), branchName: 'Beşiktaş Şubesi' }],
      meta: { total: 2, page: 2, limit: 10, totalPages: 2 },
    });
    fireEvent.click(screen.getByRole('button', { name: /survey.loadMore/ }));

    expect(await screen.findByText('Beşiktaş Şubesi')).toBeInTheDocument();
    expect(screen.getByText('Kadıköy Şubesi')).toBeInTheDocument();
    expect(mockedSurveyService.getPendingSurveys).toHaveBeenLastCalledWith(2, 10);
  });

  it('shows the empty state when nothing is pending', async () => {
    mockedSurveyService.getPendingSurveys.mockResolvedValue(page([]));

    render(<PendingSurveys />);

    expect(await screen.findByText('survey.empty')).toBeInTheDocument();
  });
});
