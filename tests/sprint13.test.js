import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExamCoverage, validateExamCoverage } from "../src/exam-coverage.js";
import { buildQuestionFactoryPlan } from "../src/question-factory.js";

const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../data/knowledge-cards.json", import.meta.url), "utf8"));
const grammarPoints = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const version = JSON.parse(await readFile(new URL("../data/version.json", import.meta.url), "utf8"));
const coverage = buildExamCoverage({ knowledgeCards: cards, questions, grammarPoints });

test("Sprint 13 版本与题库保持预期", () => {
  assert.equal(version.version, "v1.13.0");
  assert.equal(version.sprint, "Sprint 13");
  assert.equal(version.questionTarget, 845);
  assert.equal(questions.length, 205);
});

test("Coverage Engine 统计全部 Knowledge Point 与 Question 关联", () => {
  assert.equal(coverage.summary.knowledgePointCount, 100);
  assert.equal(coverage.summary.questionCount, 205);
  assert.equal(coverage.summary.countedQuestionAssociations, 205);
  assert.deepEqual(validateExamCoverage(coverage, cards, questions, grammarPoints), { valid: true, errors: [] });
  assert.deepEqual(coverage.weights, { questionCoverage: 40, knowledgeCard: 20, questionDiversity: 20, verification: 20 });
  coverage.points.forEach((point) => assert.ok(point.coverageScore >= 0 && point.coverageScore <= 100));
});

test("Coverage Engine 输出六类覆盖与考试风险", () => {
  assert.deepEqual(coverage.categoryCoverage.map((entry) => entry.category), [
    "grammar", "vocabulary", "reading_skill", "adverb", "conjunction", "fixed_expression"
  ]);
  coverage.points.forEach((point) => {
    assert.ok(Array.isArray(point.questionTypes));
    assert.ok(Array.isArray(point.contexts));
    assert.ok(Array.isArray(point.difficultyBands));
    assert.equal(typeof point.risks.missingLongText, "boolean");
    assert.equal(typeof point.risks.missingVerification, "boolean");
  });
});

test("Question Factory 按 Coverage Score 从低到高安排补题", () => {
  const factory = buildQuestionFactoryPlan({ knowledgeCards: cards, questions, examCoverage: coverage });
  const scores = factory.generationPlan.map((entry) => entry.examCoverageScore);
  assert.ok(scores.every((score) => Number.isFinite(score)));
  assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
});

test("首页包含可展开的 N2 考试覆盖率 Dashboard", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8")
  ]);
  ["N2 考试覆盖率", "考试分类覆盖率", "最高风险知识点 Top20", "exam-coverage-score", "exam-category-coverage", "exam-risk-list"]
    .forEach((text) => assert.match(html, new RegExp(text)));
  assert.match(app, /buildExamCoverage/);
  assert.match(app, /renderExamCoverage/);
});

test("Exam Coverage Report 包含全部风险与建议章节", async () => {
  const report = await readFile(new URL("../knowledge/reports/exam-coverage-report.md", import.meta.url), "utf8");
  ["覆盖率最高 Top20", "覆盖率最低 Top20", "缺少阅读题", "缺少长文", "缺少高难题", "缺少 Verification", "下一批建议补题 Top30"]
    .forEach((heading) => assert.match(report, new RegExp(heading)));
});
