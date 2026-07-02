export const DEFAULT_COVERAGE_RULES = Object.freeze({
  grammar: 8,
  vocabulary: 10,
  adverb: 8,
  reading_skill: 15,
  fixed_expression: 8,
  conjunction: 8
});

export const QUESTION_TYPE_PLANS = Object.freeze({
  grammar: [
    { generationType: "basic", label: "基础", target: 2, difficulties: [1, 2] },
    { generationType: "distinction", label: "辨析", target: 2, difficulties: [3, 4] },
    { generationType: "context", label: "语境", target: 2, difficulties: [2, 3] },
    { generationType: "integrated", label: "综合", target: 2, difficulties: [4, 5] }
  ],
  vocabulary: [
    { generationType: "collocation", label: "固定搭配", difficulties: [2, 3] },
    { generationType: "synonym", label: "近义词", difficulties: [2, 3] },
    { generationType: "context", label: "语境", difficulties: [3, 4] }
  ],
  adverb: [
    { generationType: "meaning", label: "含义判断", difficulties: [1, 2] },
    { generationType: "context", label: "语境", difficulties: [2, 3] },
    { generationType: "distinction", label: "近义辨析", difficulties: [3, 4] }
  ],
  reading_skill: [
    { generationType: "short_reading", label: "短文", difficulties: [2, 3] },
    { generationType: "author_viewpoint", label: "作者观点", difficulties: [3, 4] },
    { generationType: "reference_word", label: "指示词", difficulties: [3, 4] }
  ],
  fixed_expression: [
    { generationType: "collocation", label: "固定搭配", difficulties: [1, 2] },
    { generationType: "distinction", label: "搭配辨析", difficulties: [2, 3] },
    { generationType: "context", label: "语境", difficulties: [3, 4] }
  ],
  conjunction: [
    { generationType: "meaning", label: "功能判断", difficulties: [1, 2] },
    { generationType: "distinction", label: "连接辨析", difficulties: [2, 3] },
    { generationType: "context", label: "篇章语境", difficulties: [3, 4] }
  ]
});

function includesTag(point, pattern) {
  return (point.tags || []).some((tag) => pattern.test(tag));
}

export function classifyKnowledgePoint(point) {
  if (point.category === "grammar" || point.knowledgePointId?.startsWith("KP-GRA-")) return "grammar";
  if (point.category === "reading" || point.knowledgePointId?.startsWith("KP-READ-")) return "reading_skill";
  if (["adverb", "reading_skill", "fixed_expression", "conjunction"].includes(point.category)) return point.category;
  if (point.knowledgePointId?.startsWith("KP-ADV-") || includesTag(point, /副词/)) return "adverb";
  if (includesTag(point, /接续词|连接词/) || point.knowledgePointId?.startsWith("KP-CONJ-")) return "conjunction";
  if (includesTag(point, /固定搭配|固定表达/) || point.knowledgePointId?.startsWith("KP-FIX-")) return "fixed_expression";
  return "vocabulary";
}

export function mergeKnowledgePoints(basePoints, grammarPoints) {
  const byId = new Map();
  for (const point of [...basePoints, ...grammarPoints]) byId.set(point.knowledgePointId, point);
  return [...byId.values()];
}

function priorityFor(entry) {
  if (entry.gap === 0) return "COMPLETE";
  if (entry.current === 0 || entry.coverageRate < 25) return "HIGH";
  if (entry.coverageRate < 60) return "MEDIUM";
  return "LOW";
}

function distributeRecommendations(kind, gap) {
  const plans = QUESTION_TYPE_PLANS[kind];
  if (gap <= 0) return [];
  const result = plans.map((plan) => ({ ...plan, suggestedCount: 0 }));
  let remaining = gap;
  let index = 0;
  while (remaining > 0) {
    const plan = result[index % result.length];
    if (!plan.target || plan.suggestedCount < plan.target || gap > result.reduce((sum, item) => sum + (item.target || 0), 0)) {
      plan.suggestedCount += 1;
      remaining -= 1;
    }
    index += 1;
  }
  return result.filter((plan) => plan.suggestedCount > 0);
}

export function buildQuestionFactoryPlan({ basePoints = [], grammarPoints = [], knowledgeCards = null, questions, coverageRules = DEFAULT_COVERAGE_RULES, examCoverage = null }) {
  const knowledgePoints = knowledgeCards || mergeKnowledgePoints(basePoints, grammarPoints);
  const examScores = new Map((examCoverage?.points || []).map((point) => [point.knowledgePointId, point.coverageScore]));
  const questionCounts = new Map(knowledgePoints.map((point) => [point.knowledgePointId, 0]));
  const sourceTypes = new Map(knowledgePoints.map((point) => [point.knowledgePointId, new Set()]));

  for (const question of questions) {
    for (const id of question.knowledgePointIds || []) {
      if (!questionCounts.has(id)) continue;
      questionCounts.set(id, questionCounts.get(id) + 1);
      sourceTypes.get(id).add(question.sourceType);
    }
  }

  const coverage = knowledgePoints.map((point) => {
    const kind = classifyKnowledgePoint(point);
    const target = coverageRules[kind];
    if (!Number.isInteger(target) || target <= 0) throw new Error(`Invalid coverage target for ${kind}`);
    const current = questionCounts.get(point.knowledgePointId);
    const gap = Math.max(0, target - current);
    const sources = sourceTypes.get(point.knowledgePointId);
    const entry = {
      knowledgePointId: point.knowledgePointId,
      title: point.title,
      kind,
      status: point.status || "not_tracked",
      examFrequency: point.examFrequency || null,
      current,
      target,
      gap,
      coverageRate: Math.min(100, Math.round(current / target * 10000) / 100),
      examCoverageScore: examScores.get(point.knowledgePointId) ?? null,
      hasOfficialQuestion: sources.has("official_sample"),
      hasAiQuestion: sources.has("ai_generated"),
      recommendations: distributeRecommendations(kind, gap)
    };
    entry.priority = priorityFor(entry);
    return entry;
  });

  coverage.sort((a, b) => (a.examCoverageScore ?? 101) - (b.examCoverageScore ?? 101)
    || b.gap - a.gap
    || b.target - a.target
    || Number(b.status === "verified") - Number(a.status === "verified")
    || (b.examFrequency || 0) - (a.examFrequency || 0)
    || a.knowledgePointId.localeCompare(b.knowledgePointId));

  const totalTarget = coverage.reduce((sum, entry) => sum + entry.target, 0);
  const totalCurrent = coverage.reduce((sum, entry) => sum + entry.current, 0);
  const totalGap = coverage.reduce((sum, entry) => sum + entry.gap, 0);
  return {
    rules: { ...coverageRules },
    coverage,
    generationPlan: coverage.filter((entry) => entry.gap > 0),
    summary: {
      knowledgePointCount: coverage.length,
      questionCount: questions.length,
      currentAssociations: totalCurrent,
      totalTarget,
      totalGap,
      targetCoverageRate: Math.round(totalCurrent / totalTarget * 10000) / 100,
      coveredKnowledgePoints: coverage.filter((entry) => entry.current > 0).length,
      pointCoverageRate: Math.round(coverage.filter((entry) => entry.current > 0).length / coverage.length * 10000) / 100
    }
  };
}

export function createQuestionMetadata({ knowledgePointId, generationType, difficulty, now = new Date() }) {
  if (!knowledgePointId || !generationType) throw new Error("knowledgePointId and generationType are required");
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new Error("difficulty must be an integer from 1 to 5");
  const timestamp = now.toISOString();
  return {
    difficulty,
    reviewWeight: 1,
    knowledgePointId,
    knowledgePointIds: [knowledgePointId],
    generationType,
    sourceType: "ai_generated",
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
