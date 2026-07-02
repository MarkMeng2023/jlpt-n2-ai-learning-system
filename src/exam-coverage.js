const DEFAULT_TARGETS = Object.freeze({
  grammar: 8,
  vocabulary: 10,
  adverb: 8,
  reading_skill: 15,
  fixed_expression: 8,
  conjunction: 8
});

export const EXAM_CATEGORIES = Object.freeze([
  "grammar", "vocabulary", "reading_skill", "adverb", "conjunction", "fixed_expression"
]);

export const EXAM_CATEGORY_LABELS = Object.freeze({
  grammar: "文法",
  vocabulary: "词汇",
  reading_skill: "阅读",
  adverb: "副词",
  conjunction: "接续词",
  fixed_expression: "固定表达"
});

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasItems(value, minimum = 1) {
  return Array.isArray(value) && value.filter((item) => hasText(item)).length >= minimum;
}

function includesTag(point, pattern) {
  return (point.tags || []).some((tag) => pattern.test(tag));
}

export function classifyExamCategory(point) {
  if (point.category === "grammar" || point.knowledgePointId?.startsWith("KP-GRA-")) return "grammar";
  if (point.category === "reading" || point.category === "reading_skill" || point.knowledgePointId?.startsWith("KP-READ-")) return "reading_skill";
  if (["adverb", "fixed_expression", "conjunction"].includes(point.category)) return point.category;
  if (point.knowledgePointId?.startsWith("KP-ADV-") || includesTag(point, /副词/)) return "adverb";
  if (point.knowledgePointId?.startsWith("KP-CONJ-") || includesTag(point, /接续词|连接词/)) return "conjunction";
  if (point.knowledgePointId?.startsWith("KP-FIX-") || includesTag(point, /固定搭配|固定表达/)) return "fixed_expression";
  return "vocabulary";
}

export function detectQuestionContexts(question) {
  const tags = (question.tags || []).join(" ").toLowerCase();
  const ids = (question.knowledgePointIds || []).join(" ").toUpperCase();
  const contexts = new Set();
  if (/dialogue|conversation|会話|对话/.test(tags)) contexts.add("dialogue");
  if (/NOTICE/.test(ids) || /notice|通知/.test(tags)) contexts.add("notice");
  if (/MEMO/.test(ids) || /mail|email|メール|邮件/.test(tags)) contexts.add("email");
  if (question.section === "reading" || question.type === "short_reading") contexts.add("reading");
  if (/long_reading|long_text|長文|长文/.test(tags) || question.estimatedTime >= 300) contexts.add("long_text");
  if (contexts.size === 0) contexts.add("sentence");
  return [...contexts];
}

export function difficultyBand(difficulty) {
  if (difficulty <= 2) return "easy";
  if (difficulty === 3) return "medium";
  return "hard";
}

function cardCapabilities(card) {
  return {
    hasKnowledgeCard: Boolean(card),
    hasExamples: hasItems(card?.examples, 2),
    hasRelated: hasItems(card?.relatedPointIds),
    hasConfusable: hasItems(card?.confusablePointIds),
    hasReviewTips: hasItems(card?.reviewTips)
  };
}

function diversityScore(values, desired) {
  return desired.length ? Math.min(1, new Set(values.filter((value) => desired.includes(value))).size / desired.length) : 0;
}

export function buildExamCoverage({ knowledgeCards, questions, grammarPoints = [], coverageRules = DEFAULT_TARGETS }) {
  const questionMap = new Map(knowledgeCards.map((card) => [card.knowledgePointId, []]));
  const grammarMap = new Map(grammarPoints.map((point) => [point.knowledgePointId, point]));
  let countedAssociations = 0;
  for (const question of questions) {
    for (const id of question.knowledgePointIds || []) {
      if (!questionMap.has(id)) continue;
      questionMap.get(id).push(question);
      countedAssociations += 1;
    }
  }

  const points = knowledgeCards.map((card) => {
    const grammarPoint = grammarMap.get(card.knowledgePointId);
    const category = classifyExamCategory(card);
    const target = coverageRules[category];
    if (!Number.isInteger(target) || target <= 0) throw new Error(`考试覆盖目标无效：${category}`);
    const linkedQuestions = questionMap.get(card.knowledgePointId);
    const contexts = [...new Set(linkedQuestions.flatMap(detectQuestionContexts))].sort();
    const difficulties = [...new Set(linkedQuestions.map((question) => difficultyBand(question.difficulty)))].sort();
    const desiredContexts = category === "reading_skill" ? ["reading", "notice", "email", "long_text"] : ["sentence", "dialogue", "reading"];
    const capabilities = cardCapabilities(card);
    const questionCoverageScore = Math.min(40, linkedQuestions.length / target * 40);
    const knowledgeCardScore = Object.values(capabilities).filter(Boolean).length / Object.keys(capabilities).length * 20;
    const questionDiversityScore = diversityScore(contexts, desiredContexts) * 10 + diversityScore(difficulties, ["easy", "medium", "hard"]) * 10;
    const verificationStatus = grammarPoint?.status || card.verificationStatus;
    const verificationScore = verificationStatus === "verified" ? 20 : 0;
    const coverageScore = Math.round((questionCoverageScore + knowledgeCardScore + questionDiversityScore + verificationScore) * 100) / 100;
    return {
      knowledgePointId: card.knowledgePointId,
      title: card.title,
      category,
      questionCount: linkedQuestions.length,
      questionTarget: target,
      questionTypes: [...new Set(linkedQuestions.map((question) => question.type))].sort(),
      contexts,
      difficultyBands: difficulties,
      capabilities,
      verificationStatus,
      examFrequency: grammarPoint?.examFrequency || null,
      scores: {
        questionCoverage: Math.round(questionCoverageScore * 100) / 100,
        knowledgeCard: Math.round(knowledgeCardScore * 100) / 100,
        questionDiversity: Math.round(questionDiversityScore * 100) / 100,
        verification: verificationScore
      },
      coverageScore,
      risks: {
        missingReading: !contexts.includes("reading"),
        missingLongText: !contexts.includes("long_text"),
        missingHardQuestion: !difficulties.includes("hard"),
        missingVerification: verificationStatus !== "verified"
      }
    };
  });

  const categoryCoverage = EXAM_CATEGORIES.map((category) => {
    const categoryPoints = points.filter((point) => point.category === category);
    return {
      category,
      label: EXAM_CATEGORY_LABELS[category],
      knowledgePointCount: categoryPoints.length,
      coverageScore: categoryPoints.length
        ? Math.round(categoryPoints.reduce((sum, point) => sum + point.coverageScore, 0) / categoryPoints.length * 100) / 100
        : 0
    };
  });
  const coverageScore = points.length
    ? Math.round(points.reduce((sum, point) => sum + point.coverageScore, 0) / points.length * 100) / 100
    : 0;
  return {
    weights: { questionCoverage: 40, knowledgeCard: 20, questionDiversity: 20, verification: 20 },
    summary: {
      knowledgePointCount: points.length,
      questionCount: questions.length,
      countedQuestionAssociations: countedAssociations,
      coverageScore
    },
    categoryCoverage,
    points
  };
}

export function validateExamCoverage(result, knowledgeCards, questions, grammarPoints = []) {
  const errors = [];
  if (!result || !Array.isArray(result.points)) return { valid: false, errors: ["考试覆盖结果格式无效"] };
  if (result.points.length !== knowledgeCards.length) errors.push(`知识点统计不完整：${result.points.length}/${knowledgeCards.length}`);
  const ids = new Set(result.points.map((point) => point.knowledgePointId));
  if (ids.size !== result.points.length) errors.push("考试覆盖结果包含重复 Knowledge Point ID");
  result.points.forEach((point) => {
    if (!Number.isFinite(point.coverageScore) || point.coverageScore < 0 || point.coverageScore > 100) {
      errors.push(`${point.knowledgePointId}: Coverage Score 必须在 0~100`);
    }
  });
  const expectedAssociations = questions.reduce((sum, question) => sum
    + (question.knowledgePointIds || []).filter((id) => ids.has(id)).length, 0);
  if (result.summary.countedQuestionAssociations !== expectedAssociations) {
    errors.push(`题目关联统计不完整：${result.summary.countedQuestionAssociations}/${expectedAssociations}`);
  }
  if (result.categoryCoverage.length !== EXAM_CATEGORIES.length) errors.push("考试分类统计不完整");
  grammarPoints.forEach((point) => {
    if (!ids.has(point.knowledgePointId)) errors.push(`Grammar Map 未进入考试覆盖统计：${point.knowledgePointId}`);
  });
  return { valid: errors.length === 0, errors };
}
