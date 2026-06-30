export const KNOWLEDGE_STATUS = Object.freeze({
  NEW: "NEW",
  LEARNING: "LEARNING",
  REVIEW: "REVIEW",
  MASTERED: "MASTERED"
});

const MIN_REVIEW_QUESTIONS = 2;
const MAX_REVIEW_QUESTIONS = 5;
const DEFAULT_REVIEW_POINTS = 5;

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : -Infinity;
}

function localDate(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isCorrect(record) {
  return record?.isCorrect === true || String(record?.isCorrect).toLowerCase() === "true";
}

function normalizeIds(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || value === "") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function getStatus(total, accuracy, correctStreak) {
  if (total === 0) return KNOWLEDGE_STATUS.NEW;
  if (accuracy >= 90 && correctStreak >= 5 && total >= 10) return KNOWLEDGE_STATUS.MASTERED;
  if (accuracy < 70) return KNOWLEDGE_STATUS.LEARNING;
  return KNOWLEDGE_STATUS.REVIEW;
}

function latestMatching(records, predicate) {
  return records.reduce((latest, record) => predicate(record)
    ? Math.max(latest, timestamp(record.answeredAt))
    : latest, -Infinity);
}

function countRecentCorrect(records) {
  let streak = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (!isCorrect(records[index])) break;
    streak += 1;
  }
  return streak;
}

export function buildKnowledgeProfiles(questions, answerRecords) {
  const pointMap = new Map();
  (questions || []).forEach((question) => {
    (question.knowledgePointIds || []).forEach((knowledgePointId, index) => {
      if (!pointMap.has(knowledgePointId)) {
        pointMap.set(knowledgePointId, {
          knowledgePointId,
          knowledgePointTitle: question.knowledgePointTitles?.[index] || knowledgePointId,
          questionIds: []
        });
      }
      pointMap.get(knowledgePointId).questionIds.push(question.questionId);
    });
  });

  const records = (answerRecords || []).filter((record) => record?.questionId);
  return [...pointMap.values()].map((point) => {
    const pointRecords = records
      .filter((record) => normalizeIds(record.knowledgePointIds).includes(point.knowledgePointId))
      .sort((a, b) => timestamp(a.answeredAt) - timestamp(b.answeredAt));
    const total = pointRecords.length;
    const correct = pointRecords.filter(isCorrect).length;
    const wrong = total - correct;
    const uncertainCount = pointRecords.filter((record) => record.confidence === "uncertain").length;
    const guessedCount = pointRecords.filter((record) => record.confidence === "guessed").length;
    const accuracy = total === 0 ? 0 : Math.round(correct / total * 10000) / 100;
    const correctStreak = countRecentCorrect(pointRecords);
    const lastStudiedAt = pointRecords.length ? pointRecords.at(-1).answeredAt : null;

    return {
      ...point,
      total,
      correct,
      wrong,
      accuracy,
      correctStreak,
      weaknessScore: wrong * 3 + uncertainCount * 2 + guessedCount * 2 + (total > 0 && accuracy < 70 ? 5 : 0),
      lastStudiedAt,
      lastWrongAt: latestMatching(pointRecords, (record) => !isCorrect(record)),
      lastUncertainAt: latestMatching(pointRecords, (record) => record.confidence === "uncertain"),
      lastGuessedCorrectAt: latestMatching(pointRecords, (record) => isCorrect(record) && record.confidence === "guessed"),
      status: getStatus(total, accuracy, correctStreak)
    };
  });
}

export function compareReviewPriority(a, b) {
  return b.weaknessScore - a.weaknessScore
    || b.lastWrongAt - a.lastWrongAt
    || b.lastUncertainAt - a.lastUncertainAt
    || b.lastGuessedCorrectAt - a.lastGuessedCorrectAt
    || timestamp(a.lastStudiedAt) - timestamp(b.lastStudiedAt)
    || a.knowledgePointId.localeCompare(b.knowledgePointId);
}

function compareQuestionsForPoint(pointId, recordsByQuestion) {
  return (a, b) => {
    const aRecords = (recordsByQuestion.get(a.questionId) || [])
      .filter((record) => normalizeIds(record.knowledgePointIds).includes(pointId));
    const bRecords = (recordsByQuestion.get(b.questionId) || [])
      .filter((record) => normalizeIds(record.knowledgePointIds).includes(pointId));
    const score = (records) => {
      const latest = records.slice().sort((x, y) => timestamp(y.answeredAt) - timestamp(x.answeredAt))[0];
      if (!latest) return [0, -Infinity];
      if (!isCorrect(latest)) return [4, timestamp(latest.answeredAt)];
      if (latest.confidence === "uncertain") return [3, timestamp(latest.answeredAt)];
      if (latest.confidence === "guessed") return [2, timestamp(latest.answeredAt)];
      return [1, -timestamp(latest.answeredAt)];
    };
    const aScore = score(aRecords);
    const bScore = score(bRecords);
    return bScore[0] - aScore[0] || bScore[1] - aScore[1] || a.questionId.localeCompare(b.questionId);
  };
}

export function buildReviewQueue(questions, answerRecords, options = {}) {
  const maxKnowledgePoints = options.maxKnowledgePoints ?? DEFAULT_REVIEW_POINTS;
  const maxQuestionsPerPoint = Math.min(
    Math.max(options.maxQuestionsPerPoint ?? MAX_REVIEW_QUESTIONS, MIN_REVIEW_QUESTIONS),
    MAX_REVIEW_QUESTIONS
  );
  const recordsByQuestion = new Map();
  (answerRecords || []).forEach((record) => {
    if (!recordsByQuestion.has(record.questionId)) recordsByQuestion.set(record.questionId, []);
    recordsByQuestion.get(record.questionId).push(record);
  });

  const profiles = buildKnowledgeProfiles(questions, answerRecords);
  const selectedProfiles = profiles
    .filter((point) => point.status !== KNOWLEDGE_STATUS.NEW && point.status !== KNOWLEDGE_STATUS.MASTERED)
    .sort(compareReviewPriority)
    .slice(0, maxKnowledgePoints);
  const queuedQuestionIds = new Set();

  return selectedProfiles.map((point) => {
    const relatedQuestions = (questions || [])
      .filter((question) => (question.knowledgePointIds || []).includes(point.knowledgePointId))
      .sort(compareQuestionsForPoint(point.knowledgePointId, recordsByQuestion));
    const questionIds = [];
    for (const question of relatedQuestions) {
      if (queuedQuestionIds.has(question.questionId)) continue;
      queuedQuestionIds.add(question.questionId);
      questionIds.push(question.questionId);
      if (questionIds.length >= maxQuestionsPerPoint) break;
    }
    return { ...point, questionIds };
  }).filter((point) => point.questionIds.length > 0);
}

export function buildMistakeQuestionIds(answerRecords, availableQuestionIds) {
  const available = new Set(availableQuestionIds || []);
  const latestWrongByQuestion = new Map();
  (answerRecords || []).forEach((record) => {
    if (isCorrect(record) || !available.has(record.questionId)) return;
    const previous = latestWrongByQuestion.get(record.questionId);
    if (!previous || timestamp(record.answeredAt) > timestamp(previous.answeredAt)) {
      latestWrongByQuestion.set(record.questionId, record);
    }
  });
  return [...latestWrongByQuestion.values()]
    .sort((a, b) => timestamp(b.answeredAt) - timestamp(a.answeredAt) || a.questionId.localeCompare(b.questionId))
    .map((record) => record.questionId);
}

export function buildLearningProfile(questions, answerRecords, todayReviewCount, now = new Date()) {
  const profiles = buildKnowledgeProfiles(questions, answerRecords);
  const totalAnswered = (answerRecords || []).length;
  const totalCorrect = (answerRecords || []).filter(isCorrect).length;
  const lastStudyTime = (answerRecords || []).reduce(
    (latest, record) => Math.max(latest, timestamp(record.answeredAt)),
    -Infinity
  );
  const countStatus = (status) => profiles.filter((point) => point.status === status).length;
  return {
    lastStudyDate: Number.isFinite(lastStudyTime) ? localDate(lastStudyTime) : "",
    totalAnswered,
    totalCorrect,
    accuracy: totalAnswered === 0 ? 0 : Math.round(totalCorrect / totalAnswered * 10000) / 100,
    masteredCount: countStatus(KNOWLEDGE_STATUS.MASTERED),
    learningCount: countStatus(KNOWLEDGE_STATUS.LEARNING),
    reviewCount: countStatus(KNOWLEDGE_STATUS.REVIEW),
    newCount: countStatus(KNOWLEDGE_STATUS.NEW),
    todayReviewCount,
    lastUpdated: now.toISOString()
  };
}

export function shuffleQuestions(questions, random = Math.random) {
  const result = [...questions];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
