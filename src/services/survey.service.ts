import { api } from '@/lib/axios';
import { ApiResponse, PaginatedApiResponse, PaginationMeta } from '@/types/auth';
import { PendingSurvey, SurveyAnswerInput, SurveyResult } from '@/types/survey';

export const surveyService = {
  /**
   * Delivered orders the customer has not rated yet. The API derives the branch
   * from each order, so no brand/branch narrowing is sent from here — a single
   * page can hold orders from several branches.
   */
  async getPendingSurveys(page: number = 1, limit: number = 10) {
    const response = await api.get<PaginatedApiResponse<PendingSurvey>>('/surveys/pending', {
      params: { page, limit }
    });
    return {
      surveys: response.data.data ?? [],
      meta: response.data.meta as PaginationMeta | undefined
    };
  },

  /**
   * Answers every active question of the order in one request; the API rejects a
   * partial set, a second submission, or an order that is not delivered.
   */
  async submitAnswers(orderId: string, answers: SurveyAnswerInput[]) {
    const response = await api.post<ApiResponse<SurveyResult>>(
      `/surveys/orders/${orderId}/answers`,
      { answers }
    );
    return response.data.data;
  }
};
