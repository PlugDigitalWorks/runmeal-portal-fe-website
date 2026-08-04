export const SURVEY_MIN_SCORE = 1;
export const SURVEY_MAX_SCORE = 5;

/** The scores a customer can pick, lowest first. */
export const SURVEY_SCORES = [1, 2, 3, 4, 5] as const;

export interface SurveyQuestion {
  id: string;
  question: string;
  description: string | null;
}

/**
 * A delivered order waiting to be rated. The API only lists orders that belong
 * to the caller, are not evaluated yet, and whose branch still has active
 * questions — so an item disappearing from the list is the backend's answer,
 * not something the client decides.
 */
export interface PendingSurvey {
  orderId: string;
  branchId: string;
  branchName: string | null;
  orderStatus: string;
  orderType: string;
  totalPrice: number;
  currency: string;
  orderDate: string;
  questions: SurveyQuestion[];
}

export interface SurveyAnswerInput {
  questionId: string;
  score: number;
}

export interface SurveyResult {
  orderId: string;
  surveyDate: string;
  answers: SurveyAnswerInput[];
}

/** Every active question must be answered exactly once, in one request. */
export const isSurveyComplete = (
  survey: PendingSurvey,
  scores: Record<string, number | undefined>,
) => survey.questions.length > 0 && survey.questions.every((question) => scores[question.id]);

export const toSurveyAnswers = (
  survey: PendingSurvey,
  scores: Record<string, number | undefined>,
): SurveyAnswerInput[] =>
  survey.questions.map((question) => ({
    questionId: question.id,
    score: scores[question.id] as number,
  }));
