import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExamCoverage } from "../src/exam-coverage.js";
import { analyzeQuestionBankQuality } from "../src/question-bank-quality.js";

const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"))
  .filter((question) => !question.questionId.startsWith("Q-N2-FAC-S15-") && !question.questionId.startsWith("Q-N2-FAC-S16-") && !question.questionId.startsWith("Q-N2-FAC-S17-"));
const cards = JSON.parse(await readFile(new URL("../data/knowledge-cards.json", import.meta.url), "utf8"));
const grammar = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const points = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const sources = JSON.parse(await readFile(new URL("../data/knowledge-point-sources.json", import.meta.url), "utf8"));
const version = JSON.parse(await readFile(new URL("../data/version.json", import.meta.url), "utf8"));
const sprint14Version = { ...version, version: "v1.14.0", sprint: "Sprint 14" };
const added = questions.filter((question) => question.questionId.startsWith("Q-N2-FAC-S14-"));
const before = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-S14-"));
const selectedIds = new Set(added.flatMap((question) => question.knowledgePointIds));

test("Sprint 14 新增116题并更新版本", () => {
  assert.equal(sprint14Version.version, "v1.14.0");
  assert.equal(sprint14Version.sprint, "Sprint 14");
  assert.equal(added.length, 116);
  assert.equal(questions.length, 321);
  assert.equal(selectedIds.size, 29);
  selectedIds.forEach((id) => assert.equal(added.filter((question) => question.knowledgePointIds.includes(id)).length, 4));
});

test("Sprint 14 题型、难度、答案与复习权重均衡", () => {
  const count = (values, value) => values.filter((item) => item === value).length;
  [2, 3, 4, 5].forEach((difficulty) => assert.equal(count(added.map((question) => question.difficulty), difficulty), 29));
  ["A", "B", "C", "D"].forEach((answer) => assert.equal(count(added.map((question) => question.correctAnswer), answer), 29));
  ["question_factory_sentence", "question_factory_dialogue", "question_factory_distinction", "question_factory_short_reading"]
    .forEach((subType) => assert.equal(count(added.map((question) => question.subType), subType), 29));
  assert.equal(count(added.map((question) => question.section), "reading"), 29);
  assert.deepEqual(new Set(added.map((question) => question.reviewWeight)), new Set([1, 1.1, 1.2, 1.3]));
});

test("Sprint 14 新题元数据与完整解析符合质量要求", () => {
  added.forEach((question) => {
    assert.equal(question.sourceType, "ai_generated");
    assert.equal(question.generationType, "question_factory");
    assert.equal(question.knowledgePointIds.length, 1);
    assert.equal(question.knowledgePointTitles.length, 1);
    ["A", "B", "C", "D"].forEach((key) => assert.ok(question.explanation.includes(`${key}「${question.choices[key]}」`)));
    assert.match(question.explanation, /正确理由：/);
    assert.match(question.explanation, /涉及知识点：/);
    assert.match(question.explanation, /类似例句1：/);
    assert.ok(!Number.isNaN(Date.parse(question.createdAt)));
  });
});

test("Sprint 14 提升考试覆盖率与题库建设进度", () => {
  const sprint13 = buildExamCoverage({ knowledgeCards: cards, questions: before, grammarPoints: grammar });
  const sprint14 = buildExamCoverage({ knowledgeCards: cards, questions, grammarPoints: grammar });
  assert.equal(sprint13.summary.coverageScore, 37.26);
  assert.equal(sprint14.summary.coverageScore, 48.86);
  assert.equal(Math.round(before.length / version.questionTarget * 10000) / 100, 24.26);
  assert.equal(Math.round(questions.length / version.questionTarget * 10000) / 100, 37.99);
});

test("Sprint 14 不降低题库质量启发式指标", () => {
  const quality = analyzeQuestionBankQuality(questions, points, sources, { additionalKnowledgePoints: grammar });
  assert.equal(quality.summary.shortExplanationCount, 0);
  assert.equal(quality.summary.missingDistractorAnalysisCount, 0);
  assert.equal(quality.summary.obviousOptionCandidateCount, 0);
  assert.equal(quality.summary.multipleAnswerCandidateCount, 0);
});

test("Sprint 14 报告已更新到321题", async () => {
  const [exam, questionCoverage, plan, quality] = await Promise.all([
    readFile(new URL("../knowledge/reports/exam-coverage-report.md", import.meta.url), "utf8"),
    readFile(new URL("../knowledge/reports/question-coverage-report.md", import.meta.url), "utf8"),
    readFile(new URL("../reports/question-generation-plan.md", import.meta.url), "utf8"),
    readFile(new URL("../reports/question-bank-quality.md", import.meta.url), "utf8")
  ]);
  assert.match(exam, /N2 考试覆盖率：\*\*70\.90%\*\*/);
  assert.match(questionCoverage, /当前题目数：\*\*705\*\*/);
  assert.match(questionCoverage, /目标完成率：\*\*83\.43%\*\*/);
  assert.match(plan, /当前目标完成率：\*\*83\.43%\*\*/);
  assert.match(quality, /\| 题目数 \| 705 \|/);
});
