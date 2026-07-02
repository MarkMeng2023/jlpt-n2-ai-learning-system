export const KNOWLEDGE_CARD_REQUIRED_FIELDS = Object.freeze([
  "knowledgePointId", "title", "category", "level", "meaning", "usage", "grammarPattern",
  "notes", "commonMistakes", "memoryTips", "examples", "relatedPointIds", "confusablePointIds",
  "linkedQuestionIds", "reviewTips", "verificationStatus", "sourceType", "version", "updatedAt"
]);

const SOURCE_TYPES = new Set(["official", "textbook", "trusted_learning_site", "grammar_reference", "user_material", "ai_structured"]);
const VERIFICATION_STATUSES = new Set(["verified", "unverified", "rejected"]);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const stringArray = (value, minimum = 0) => Array.isArray(value) && value.length >= minimum && value.every(text);

export function validateKnowledgeCards(cards, questions = []) {
  const errors = [];
  if (!Array.isArray(cards)) return { valid: false, errors: ["knowledge-cards.json: root value must be an array"] };
  const ids = new Set();
  const questionIds = new Set(questions.map((question) => question.questionId));
  cards.forEach((card, index) => {
    const path = `knowledge-cards[${index}]`;
    if (!card || typeof card !== "object" || Array.isArray(card)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    KNOWLEDGE_CARD_REQUIRED_FIELDS.forEach((field) => {
      if (!Object.hasOwn(card, field) || card[field] === null || card[field] === undefined) errors.push(`${path}.${field}: required field is missing`);
    });
    if (!text(card.knowledgePointId)) errors.push(`${path}.knowledgePointId: must be a non-empty string`);
    else if (ids.has(card.knowledgePointId)) errors.push(`${path}.knowledgePointId: duplicate ID "${card.knowledgePointId}"`);
    else ids.add(card.knowledgePointId);
    ["title", "category", "level", "meaning", "usage", "grammarPattern", "notes", "memoryTips"].forEach((field) => {
      if (!text(card[field])) errors.push(`${path}.${field}: must be a non-empty string`);
    });
    if (!stringArray(card.commonMistakes, 1)) errors.push(`${path}.commonMistakes: must contain at least one non-empty string`);
    if (!stringArray(card.examples, 2)) errors.push(`${path}.examples: must contain at least two non-empty examples`);
    if (!stringArray(card.relatedPointIds)) errors.push(`${path}.relatedPointIds: must be an array of strings`);
    if (!stringArray(card.confusablePointIds)) errors.push(`${path}.confusablePointIds: must be an array of strings`);
    if (!stringArray(card.linkedQuestionIds)) errors.push(`${path}.linkedQuestionIds: must be an array of strings`);
    if (!stringArray(card.reviewTips, 1)) errors.push(`${path}.reviewTips: must contain at least one non-empty string`);
    if (!VERIFICATION_STATUSES.has(card.verificationStatus)) errors.push(`${path}.verificationStatus: invalid status`);
    if (!SOURCE_TYPES.has(card.sourceType)) errors.push(`${path}.sourceType: invalid source type`);
    if (!Number.isInteger(card.version) || card.version < 1) errors.push(`${path}.version: must be a positive integer`);
    if (!text(card.updatedAt) || Number.isNaN(Date.parse(card.updatedAt))) errors.push(`${path}.updatedAt: must be an ISO date string`);
  });
  cards.forEach((card, index) => {
    for (const field of ["relatedPointIds", "confusablePointIds"]) {
      for (const id of card?.[field] || []) if (!ids.has(id)) errors.push(`knowledge-cards[${index}].${field}: unknown knowledge point "${id}"`);
    }
    for (const id of card?.linkedQuestionIds || []) if (!questionIds.has(id)) errors.push(`knowledge-cards[${index}].linkedQuestionIds: unknown question "${id}"`);
  });
  return { valid: errors.length === 0, errors };
}

export function isKnowledgeCardComplete(card) {
  return KNOWLEDGE_CARD_REQUIRED_FIELDS.every((field) => Object.hasOwn(card, field) && card[field] !== null && card[field] !== undefined)
    && ["title", "category", "level", "meaning", "usage", "grammarPattern", "notes", "memoryTips"].every((field) => text(card[field]))
    && stringArray(card.commonMistakes, 1) && stringArray(card.examples, 2) && stringArray(card.reviewTips, 1);
}

export function buildReviewKnowledgeContext(knowledgePointId, cards) {
  const card = cards.find((item) => item.knowledgePointId === knowledgePointId);
  if (!card) throw new Error(`Knowledge Card not found: ${knowledgePointId}`);
  return {
    knowledgePointId: card.knowledgePointId,
    title: card.title,
    meaning: card.meaning,
    usage: card.usage,
    grammarPattern: card.grammarPattern,
    commonMistakes: [...card.commonMistakes],
    reviewTips: [...card.reviewTips]
  };
}
