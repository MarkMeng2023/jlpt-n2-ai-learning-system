import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildReviewKnowledgeContext, isKnowledgeCardComplete, validateKnowledgeCards } from "../src/knowledge-card.js";
import { buildQuestionFactoryPlan } from "../src/question-factory.js";
import { buildProjectStatus } from "../src/project-status.js";

const cards = JSON.parse(await readFile(new URL("../data/knowledge-cards.json", import.meta.url), "utf8"));
const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"));
const points = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const grammar = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const version = JSON.parse(await readFile(new URL("../data/version.json", import.meta.url), "utf8"));

test("100个 Knowledge Point 都有完整 Knowledge Card", () => {
  assert.equal(cards.length, 100);
  assert.equal(new Set(cards.map((card) => card.knowledgePointId)).size, 100);
  assert.ok(cards.every(isKnowledgeCardComplete));
  assert.deepEqual(validateKnowledgeCards(cards, questions), { valid: true, errors: [] });
});

test("Knowledge Card 包含至少2个例句与有效题目反向关联", () => {
  const questionIds = new Set(questions.map((question) => question.questionId));
  cards.forEach((card) => {
    assert.ok(card.examples.length >= 2);
    card.linkedQuestionIds.forEach((id) => assert.ok(questionIds.has(id)));
    const expected = questions.filter((question) => question.knowledgePointIds.includes(card.knowledgePointId)).map((question) => question.questionId);
    assert.deepEqual(card.linkedQuestionIds, expected);
  });
});

test("Review Engine 可获取统一知识讲解上下文", () => {
  const context = buildReviewKnowledgeContext("KP-GRA-AGEKU-001", cards);
  assert.equal(context.title, "～あげく");
  assert.ok(context.meaning && context.usage && context.grammarPattern);
  assert.ok(context.commonMistakes.length > 0);
  assert.ok(context.reviewTips.length > 0);
});

test("Question Factory 使用 Knowledge Card 作为知识点数据源", () => {
  const plan = buildQuestionFactoryPlan({ knowledgeCards: cards, questions });
  assert.equal(plan.summary.knowledgePointCount, 100);
  assert.equal(plan.summary.currentAssociations, 205);
  assert.equal(plan.summary.totalTarget, 845);
  assert.equal(plan.summary.targetCoverageRate, 24.26);
});

test("Project Status 显示 Knowledge Card 数量与覆盖率", () => {
  const status = buildProjectStatus({ questions, basePoints: points, grammarPoints: grammar, knowledgeCards: cards, version });
  assert.equal(status.version, version.version);
  assert.equal(status.sprint, version.sprint);
  assert.equal(status.knowledgeCardCount, 100);
  assert.equal(status.knowledgeCardCoverage, 100);
});

test("Knowledge Card 两份报告完整且验证通过", async () => {
  const [coverage, validation, html] = await Promise.all([
    readFile(new URL("../knowledge/reports/knowledge-card-coverage-report.md", import.meta.url), "utf8"),
    readFile(new URL("../knowledge/reports/knowledge-card-validation-report.md", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8")
  ]);
  assert.match(coverage, /Knowledge Card 总数：\*\*100\*\*/);
  assert.match(coverage, /完成率：\*\*100\.00%\*\*/);
  assert.match(validation, /结果：\*\*✅ 通过\*\*/);
  assert.match(html, /id="project-card-count"/);
  assert.match(html, /id="project-card-coverage"/);
});
