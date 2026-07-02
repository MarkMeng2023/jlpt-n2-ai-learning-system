function requireVersion(version) {
  if (!version || typeof version !== "object") throw new Error("版本信息格式无效");
  if (typeof version.version !== "string" || typeof version.sprint !== "string") throw new Error("版本号或 Sprint 缺失");
  if (!Number.isInteger(version.questionTarget) || version.questionTarget <= 0) throw new Error("目标题量必须是正整数");
  if (typeof version.lastUpdated !== "string" || Number.isNaN(Date.parse(version.lastUpdated))) throw new Error("最后更新时间必须是 ISO 时间");
}

export function buildProjectStatus({ questions, basePoints, grammarPoints, knowledgeCards = [], version }) {
  requireVersion(version);
  const pointIds = new Set([...basePoints, ...grammarPoints].map((point) => point.knowledgePointId));
  const questionCount = questions.length;
  return {
    version: version.version,
    sprint: version.sprint,
    questionCount,
    knowledgePointCount: pointIds.size,
    knowledgeCardCount: knowledgeCards.length,
    knowledgeCardCoverage: pointIds.size ? Math.round(knowledgeCards.length / pointIds.size * 10000) / 100 : 0,
    coverage: Math.round(questionCount / version.questionTarget * 10000) / 100,
    questionTarget: version.questionTarget,
    lastUpdated: version.lastUpdated
  };
}

export async function loadProjectStatusData(questions, basePoints, fetchImpl = globalThis.fetch, loadedGrammarPoints = null, loadedKnowledgeCards = null) {
  const [versionResponse, grammarResponse] = await Promise.all([
    fetchImpl("data/version.json"),
    loadedGrammarPoints ? null : fetchImpl("knowledge/grammar/grammar-points.json")
  ]);
  if (!versionResponse.ok) throw new Error(`版本信息加载失败（HTTP ${versionResponse.status}）`);
  if (grammarResponse && !grammarResponse.ok) throw new Error(`Grammar Map 加载失败（HTTP ${grammarResponse.status}）`);
  const [version, grammarPoints] = await Promise.all([
    versionResponse.json(),
    loadedGrammarPoints ? Promise.resolve(loadedGrammarPoints) : grammarResponse.json()
  ]);
  return buildProjectStatus({ questions, basePoints, grammarPoints, knowledgeCards: loadedKnowledgeCards || [], version });
}
