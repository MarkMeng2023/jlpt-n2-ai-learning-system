import { validateKnowledgeCards } from "./knowledge-card.js";

export const QUESTION_REQUIRED_FIELDS = Object.freeze([
  "questionId", "level", "section", "type", "subType", "prompt", "choices",
  "correctAnswer", "explanation", "knowledgePointIds", "knowledgePointTitles",
  "difficulty", "sourceType", "sourceName", "tags", "estimatedTime",
  "reviewWeight", "version", "createdAt", "updatedAt"
]);

export const KNOWLEDGE_POINT_REQUIRED_FIELDS = Object.freeze([
  "knowledgePointId", "level", "category", "title", "reading", "meaning",
  "description", "examples", "relatedPointIds", "confusablePointIds", "tags",
  "masteryRule", "createdAt", "updatedAt"
]);

export const ALLOWED_SOURCE_TYPES = Object.freeze([
  "ai_generated", "official_sample", "manual", "textbook"
]);

export const ALLOWED_SECTIONS = Object.freeze([
  "vocabulary", "grammar", "reading", "listening"
]);

const CHOICE_KEYS = ["A", "B", "C", "D"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value) {
  if (!isNonEmptyString(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function validateRequiredFields(item, fields, path, errors) {
  fields.forEach((field) => {
    if (!Object.hasOwn(item, field) || item[field] === null || item[field] === undefined) {
      errors.push(`${path}.${field}: required field is missing`);
    }
  });
}

function validateStringArray(value, path, errors, { allowEmpty = true } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: must be an array`);
    return;
  }
  if (!allowEmpty && value.length === 0) errors.push(`${path}: must contain at least one item`);
  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) errors.push(`${path}[${index}]: must be a non-empty string`);
  });
}

function validateKnowledgePoints(knowledgePoints, errors) {
  if (!Array.isArray(knowledgePoints)) {
    errors.push("knowledge-points.json: root value must be an array");
    return new Set();
  }
  if (knowledgePoints.length === 0) errors.push("knowledge-points.json: must contain at least one knowledge point");
  const ids = new Set();
  knowledgePoints.forEach((point, index) => {
    const path = `knowledge-points[${index}]`;
    if (!point || typeof point !== "object" || Array.isArray(point)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    validateRequiredFields(point, KNOWLEDGE_POINT_REQUIRED_FIELDS, path, errors);
    if (!isNonEmptyString(point.knowledgePointId)) {
      errors.push(`${path}.knowledgePointId: must be a non-empty string`);
    } else if (ids.has(point.knowledgePointId)) {
      errors.push(`${path}.knowledgePointId: duplicate ID "${point.knowledgePointId}"`);
    } else {
      ids.add(point.knowledgePointId);
    }
    ["level", "category", "title", "reading", "meaning", "description"].forEach((field) => {
      if (!isNonEmptyString(point[field])) errors.push(`${path}.${field}: must be a non-empty string`);
    });
    validateStringArray(point.examples, `${path}.examples`, errors, { allowEmpty: false });
    validateStringArray(point.relatedPointIds, `${path}.relatedPointIds`, errors);
    validateStringArray(point.confusablePointIds, `${path}.confusablePointIds`, errors);
    validateStringArray(point.tags, `${path}.tags`, errors);
    if (!point.masteryRule || typeof point.masteryRule !== "object" || Array.isArray(point.masteryRule)) {
      errors.push(`${path}.masteryRule: must be an object`);
    }
    ["createdAt", "updatedAt"].forEach((field) => {
      if (!isIsoDate(point[field])) errors.push(`${path}.${field}: must be an ISO date string`);
    });
  });
  knowledgePoints.forEach((point, index) => {
    ["relatedPointIds", "confusablePointIds"].forEach((field) => {
      if (!Array.isArray(point?.[field])) return;
      point[field].forEach((id, relationIndex) => {
        if (!ids.has(id)) errors.push(`knowledge-points[${index}].${field}[${relationIndex}]: unknown knowledge point "${id}"`);
      });
    });
  });
  return ids;
}

function validateQuestions(questions, knowledgePointIds, errors) {
  if (!Array.isArray(questions)) {
    errors.push("questions.json: root value must be an array");
    return;
  }
  if (questions.length === 0) errors.push("questions.json: must contain at least one question");
  const ids = new Set();
  questions.forEach((question, index) => {
    const path = `questions[${index}]`;
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    validateRequiredFields(question, QUESTION_REQUIRED_FIELDS, path, errors);
    if (!isNonEmptyString(question.questionId)) {
      errors.push(`${path}.questionId: must be a non-empty string`);
    } else if (ids.has(question.questionId)) {
      errors.push(`${path}.questionId: duplicate ID "${question.questionId}"`);
    } else {
      ids.add(question.questionId);
    }
    ["level", "type", "subType", "prompt", "explanation", "sourceName"].forEach((field) => {
      if (!isNonEmptyString(question[field])) errors.push(`${path}.${field}: must be a non-empty string`);
    });
    if (!ALLOWED_SECTIONS.includes(question.section)) {
      errors.push(`${path}.section: must be one of ${ALLOWED_SECTIONS.join(", ")}`);
    }
    if (!question.choices || typeof question.choices !== "object" || Array.isArray(question.choices)) {
      errors.push(`${path}.choices: must be an object containing A/B/C/D`);
    } else {
      CHOICE_KEYS.forEach((key) => {
        if (!isNonEmptyString(question.choices[key])) errors.push(`${path}.choices.${key}: must be a non-empty string`);
      });
    }
    if (!CHOICE_KEYS.includes(question.correctAnswer)) {
      errors.push(`${path}.correctAnswer: must be A, B, C, or D`);
    }
    if (!Number.isInteger(question.difficulty) || question.difficulty < 1 || question.difficulty > 5) {
      errors.push(`${path}.difficulty: must be an integer from 1 to 5`);
    }
    if (!ALLOWED_SOURCE_TYPES.includes(question.sourceType)) {
      errors.push(`${path}.sourceType: must be one of ${ALLOWED_SOURCE_TYPES.join(", ")}`);
    }
    validateStringArray(question.tags, `${path}.tags`, errors);
    validateStringArray(question.knowledgePointIds, `${path}.knowledgePointIds`, errors, { allowEmpty: false });
    validateStringArray(question.knowledgePointTitles, `${path}.knowledgePointTitles`, errors, { allowEmpty: false });
    if (Array.isArray(question.knowledgePointIds) && Array.isArray(question.knowledgePointTitles)
      && question.knowledgePointIds.length !== question.knowledgePointTitles.length) {
      errors.push(`${path}.knowledgePointTitles: must align with knowledgePointIds`);
    }
    (question.knowledgePointIds || []).forEach((id, pointIndex) => {
      if (!knowledgePointIds.has(id)) {
        errors.push(`${path}.knowledgePointIds[${pointIndex}]: unknown knowledge point "${id}"`);
      }
    });
    if (!Number.isFinite(question.estimatedTime) || question.estimatedTime <= 0) {
      errors.push(`${path}.estimatedTime: must be a positive number of seconds`);
    }
    if (!Number.isFinite(question.reviewWeight) || question.reviewWeight <= 0) {
      errors.push(`${path}.reviewWeight: must be a positive number`);
    }
    if (!Number.isInteger(question.version) || question.version < 1) {
      errors.push(`${path}.version: must be a positive integer`);
    }
    if (Object.hasOwn(question, "generationType") && !isNonEmptyString(question.generationType)) {
      errors.push(`${path}.generationType: must be a non-empty string when provided`);
    }
    if (Object.hasOwn(question, "knowledgePointId")
      && (!isNonEmptyString(question.knowledgePointId) || !question.knowledgePointIds?.includes(question.knowledgePointId))) {
      errors.push(`${path}.knowledgePointId: must match an item in knowledgePointIds`);
    }
    ["createdAt", "updatedAt"].forEach((field) => {
      if (!isIsoDate(question[field])) errors.push(`${path}.${field}: must be an ISO date string`);
    });
  });
}

export function validateQuestionBank(questions, knowledgePoints, additionalKnowledgePoints = []) {
  const errors = [];
  const knowledgePointIds = validateKnowledgePoints(knowledgePoints, errors);
  additionalKnowledgePoints.forEach((point, index) => {
    if (!isNonEmptyString(point?.knowledgePointId)) {
      errors.push(`additional-knowledge-points[${index}].knowledgePointId: must be a non-empty string`);
    } else {
      knowledgePointIds.add(point.knowledgePointId);
    }
  });
  validateQuestions(questions, knowledgePointIds, errors);
  return { valid: errors.length === 0, errors };
}

export function assertValidQuestionBank(questions, knowledgePoints, additionalKnowledgePoints = []) {
  const result = validateQuestionBank(questions, knowledgePoints, additionalKnowledgePoints);
  if (!result.valid) {
    const preview = result.errors.slice(0, 5).join("；");
    const remaining = result.errors.length > 5 ? `；另有 ${result.errors.length - 5} 项错误` : "";
    throw new Error(`题库格式无效：${preview}${remaining}`);
  }
  return true;
}

export async function loadQuestionBank(fetchImpl = globalThis.fetch) {
  const requestOptions = { cache: "no-store" };
  const [questionsResponse, pointsResponse, grammarResponse, cardsResponse] = await Promise.all([
    fetchImpl("data/questions.json", requestOptions),
    fetchImpl("data/knowledge-points.json", requestOptions),
    fetchImpl("knowledge/grammar/grammar-points.json", requestOptions),
    fetchImpl("data/knowledge-cards.json", requestOptions)
  ]);
  if (!questionsResponse.ok) throw new Error(`题库加载失败（HTTP ${questionsResponse.status}）`);
  if (!pointsResponse.ok) throw new Error(`知识点加载失败（HTTP ${pointsResponse.status}）`);
  if (!grammarResponse.ok) throw new Error(`Grammar Map 加载失败（HTTP ${grammarResponse.status}）`);
  if (!cardsResponse.ok) throw new Error(`知识卡加载失败（HTTP ${cardsResponse.status}）`);
  const [questions, knowledgePoints, grammarPoints, knowledgeCards] = await Promise.all([
    questionsResponse.json(),
    pointsResponse.json(),
    grammarResponse.json(),
    cardsResponse.json()
  ]);
  assertValidQuestionBank(questions, knowledgePoints, grammarPoints);
  const cardValidation = validateKnowledgeCards(knowledgeCards, questions);
  if (!cardValidation.valid) throw new Error(`知识卡格式无效：${cardValidation.errors.slice(0, 3).join("；")}`);
  return { questions, knowledgePoints, grammarPoints, knowledgeCards };
}
