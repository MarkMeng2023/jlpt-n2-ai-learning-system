export function normalizeQuestionIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === "string" && id.length > 0))];
}

export function mergeAnsweredQuestionIds(...collections) {
  return normalizeQuestionIds(collections.flatMap((collection) => normalizeQuestionIds(collection)));
}

export function findFirstUnansweredIndex(questions, answeredQuestionIds, startIndex = 0) {
  const answered = new Set(normalizeQuestionIds(answeredQuestionIds));
  if (!Array.isArray(questions) || questions.length === 0) return -1;

  for (let offset = 0; offset < questions.length; offset += 1) {
    const index = (startIndex + offset) % questions.length;
    if (!answered.has(questions[index].questionId)) return index;
  }
  return -1;
}

export function getProgressCounts(questions, answeredQuestionIds) {
  const questionIds = new Set(questions.map((question) => question.questionId));
  const completed = normalizeQuestionIds(answeredQuestionIds)
    .filter((questionId) => questionIds.has(questionId)).length;
  return {
    total: questions.length,
    completed,
    remaining: Math.max(questions.length - completed, 0)
  };
}

export const COMPLETION_MESSAGE = "本轮题库已完成";

export async function loadAnsweredProgress(localAnsweredQuestionIds, getRemoteProgress) {
  const localIds = normalizeQuestionIds(localAnsweredQuestionIds);
  try {
    const remoteProgress = await getRemoteProgress();
    return {
      answeredQuestionIds: mergeAnsweredQuestionIds(localIds, remoteProgress.answeredQuestionIds),
      source: "remote",
      error: null
    };
  } catch (error) {
    return { answeredQuestionIds: localIds, source: "local", error };
  }
}

export class ProgressStore {
  constructor(storageKey, storage = globalThis.localStorage) {
    this.storageKey = storageKey;
    this.storage = storage;
  }

  getAnsweredQuestionIds() {
    try {
      return normalizeQuestionIds(JSON.parse(this.storage?.getItem(this.storageKey) || "[]"));
    } catch {
      return [];
    }
  }

  save(answeredQuestionIds) {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(normalizeQuestionIds(answeredQuestionIds)));
      return true;
    } catch {
      return false;
    }
  }

  add(questionId) {
    const next = mergeAnsweredQuestionIds(this.getAnsweredQuestionIds(), [questionId]);
    this.save(next);
    return next;
  }
}
