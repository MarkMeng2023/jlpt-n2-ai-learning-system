import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildQuestionFactoryPlan,
  classifyKnowledgePoint,
  createQuestionMetadata,
  DEFAULT_COVERAGE_RULES
} from "../src/question-factory.js";

const basePoints = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const grammarPoints = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"));
const factory = buildQuestionFactoryPlan({ basePoints, grammarPoints, questions });

test("Coverage Engine 按 ID 合并知识点并应用可配置目标", () => {
  assert.equal(factory.summary.knowledgePointCount, 100);
  assert.equal(factory.summary.questionCount, 125);
  assert.equal(factory.summary.currentAssociations, 125);
  assert.equal(factory.summary.totalTarget, 845);
  assert.equal(factory.summary.totalGap, 720);
  assert.equal(factory.summary.targetCoverageRate, 14.79);
  assert.equal(factory.summary.coveredKnowledgePoints, 30);
  assert.deepEqual(DEFAULT_COVERAGE_RULES, {
    grammar: 8, vocabulary: 10, adverb: 8, reading_skill: 15, fixed_expression: 8, conjunction: 8
  });
});

test("知识点分类区分文法、副词、固定搭配与阅读技能", () => {
  assert.equal(classifyKnowledgePoint(grammarPoints[0]), "grammar");
  assert.equal(classifyKnowledgePoint(basePoints.find((point) => point.knowledgePointId.startsWith("KP-ADV-"))), "adverb");
  assert.equal(classifyKnowledgePoint(basePoints.find((point) => point.knowledgePointId === "KP-VOC-HATASU-001")), "fixed_expression");
  assert.equal(classifyKnowledgePoint(basePoints.find((point) => point.knowledgePointId.startsWith("KP-READ-"))), "reading_skill");
});

test("Question Factory 只规划有缺口的知识点并输出确定性建议", () => {
  assert.equal(factory.generationPlan.length, 100);
  const monono = factory.generationPlan.find((entry) => entry.knowledgePointId === "KP-GRA-MONONO-001");
  assert.equal(monono.current, 4);
  assert.equal(monono.target, 8);
  assert.equal(monono.gap, 4);
  assert.equal(monono.hasOfficialQuestion, false);
  assert.equal(monono.hasAiQuestion, true);
  assert.deepEqual(monono.recommendations.map((item) => item.generationType), ["basic", "distinction", "context", "integrated"]);
  assert.deepEqual(
    buildQuestionFactoryPlan({ basePoints, grammarPoints, questions }).generationPlan,
    factory.generationPlan
  );
});

test("未来候选题元数据包含 Sprint 8 必填字段", () => {
  const metadata = createQuestionMetadata({
    knowledgePointId: "KP-GRA-MONONO-001",
    generationType: "context",
    difficulty: 3,
    now: new Date("2026-07-01T00:00:00.000Z")
  });
  assert.deepEqual(metadata, {
    difficulty: 3,
    reviewWeight: 1,
    knowledgePointId: "KP-GRA-MONONO-001",
    knowledgePointIds: ["KP-GRA-MONONO-001"],
    generationType: "context",
    sourceType: "ai_generated",
    version: 1,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  });
});

test("Coverage Report 与 Generation Plan 包含门禁和完整计划", async () => {
  const [coverage, plan] = await Promise.all([
    readFile(new URL("../knowledge/reports/question-coverage-report.md", import.meta.url), "utf8"),
    readFile(new URL("../reports/question-generation-plan.md", import.meta.url), "utf8")
  ]);
  assert.match(coverage, /Knowledge Point 总数：\*\*100\*\*/);
  assert.match(coverage, /理论目标关联数：\*\*845\*\*/);
  assert.match(plan, /Question Factory 生成待补计划/);
  assert.match(plan, /Question Validation/);
  assert.match(plan, /Question Review/);
  assert.match(plan, /Question Bank Validation/);
  assert.match(plan, /KP-GRA-MONONO-001/);
});
