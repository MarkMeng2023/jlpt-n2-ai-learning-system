import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExamCoverage } from "../src/exam-coverage.js";
import { analyzeQuestionBankQuality } from "../src/question-bank-quality.js";

const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../data/knowledge-cards.json", import.meta.url), "utf8"));
const grammar = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const points = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const sources = JSON.parse(await readFile(new URL("../data/knowledge-point-sources.json", import.meta.url), "utf8"));
const version = JSON.parse(await readFile(new URL("../data/version.json", import.meta.url), "utf8"));
const added = questions.filter((question) => question.questionId.startsWith("Q-N2-FAC-S15-"));
const before = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-S15-"));
const selectedIds = new Set(added.flatMap((question) => question.knowledgePointIds));

test("Sprint 15 新增128题并更新版本", () => {
  assert.equal(version.version, "v1.15.0");
  assert.equal(version.sprint, "Sprint 15");
  assert.equal(added.length, 128);
  assert.equal(questions.length, 449);
  assert.equal(selectedIds.size, 32);
  selectedIds.forEach((id) => assert.equal(added.filter((question) => question.knowledgePointIds.includes(id)).length, 4));
});

test("Sprint 15 八种考试语境均衡且不连续重复", () => {
  const expectedTypes = ["sentence", "dialogue", "notice", "email", "explanation", "reason", "author_viewpoint", "short_reading"];
  expectedTypes.forEach((name) => assert.equal(added.filter((question) => question.subType === `question_factory_${name}`).length, 16));
  for (let index = 1; index < added.length; index += 1) assert.notEqual(added[index].subType, added[index - 1].subType);
  assert.equal(added.filter((question) => question.section === "reading").length, 96);
  assert.equal(added.filter((question) => question.tags.includes("long_text")).length, 32);
});

test("Sprint 15 难度、答案和元数据符合要求", () => {
  const count = (values, value) => values.filter((item) => item === value).length;
  assert.equal(count(added.map((question) => question.difficulty), 2), 16);
  assert.equal(count(added.map((question) => question.difficulty), 3), 32);
  assert.equal(count(added.map((question) => question.difficulty), 4), 48);
  assert.equal(count(added.map((question) => question.difficulty), 5), 32);
  ["A", "B", "C", "D"].forEach((answer) => assert.equal(count(added.map((question) => question.correctAnswer), answer), 32));
  added.forEach((question) => {
    assert.equal(question.sourceType, "ai_generated");
    assert.equal(question.generationType, "question_factory");
    assert.equal(question.knowledgePointIds.length, 1);
    ["A", "B", "C", "D"].forEach((key) => assert.ok(question.explanation.includes(`${key}「${question.choices[key]}」`)));
    assert.match(question.explanation, /正确理由：/);
    assert.match(question.explanation, /类似例句1：/);
  });
});

test("Sprint 15 提升考试覆盖率与题库建设进度", () => {
  const sprint14 = buildExamCoverage({ knowledgeCards: cards, questions: before, grammarPoints: grammar });
  const sprint15 = buildExamCoverage({ knowledgeCards: cards, questions, grammarPoints: grammar });
  assert.equal(sprint14.summary.coverageScore, 48.86);
  assert.equal(sprint15.summary.coverageScore, 59.09);
  assert.equal(Math.round(before.length / version.questionTarget * 10000) / 100, 37.99);
  assert.equal(Math.round(questions.length / version.questionTarget * 10000) / 100, 53.14);
});

test("Sprint 15 质量启发式指标不退化", () => {
  const quality = analyzeQuestionBankQuality(questions, points, sources, { additionalKnowledgePoints: grammar });
  assert.equal(quality.summary.shortExplanationCount, 0);
  assert.equal(quality.summary.missingDistractorAnalysisCount, 0);
  assert.equal(quality.summary.obviousOptionCandidateCount, 0);
  assert.equal(quality.summary.multipleAnswerCandidateCount, 0);
});

test("Sprint 15 自动报告更新到449题", async () => {
  const [exam, questionCoverage, plan, quality] = await Promise.all([
    readFile(new URL("../knowledge/reports/exam-coverage-report.md", import.meta.url), "utf8"),
    readFile(new URL("../knowledge/reports/question-coverage-report.md", import.meta.url), "utf8"),
    readFile(new URL("../reports/question-generation-plan.md", import.meta.url), "utf8"),
    readFile(new URL("../reports/question-bank-quality.md", import.meta.url), "utf8")
  ]);
  assert.match(exam, /N2 考试覆盖率：\*\*59\.09%\*\*/);
  assert.match(questionCoverage, /当前题目数：\*\*449\*\*/);
  assert.match(questionCoverage, /目标完成率：\*\*53\.14%\*\*/);
  assert.match(plan, /当前目标完成率：\*\*53\.14%\*\*/);
  assert.match(quality, /\| 题目数 \| 449 \|/);
});
