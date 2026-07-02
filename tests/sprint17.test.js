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
const added = questions.filter((question) => question.questionId.startsWith("Q-N2-FAC-S17-"));
const before = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-S17-"));
const selectedIds = new Set(added.flatMap((question) => question.knowledgePointIds));

test("Sprint 17 最终批次新增128题并更新版本", () => {
  assert.equal(version.version, "v1.17.0");
  assert.equal(version.sprint, "Sprint 17");
  assert.equal(added.length, 128);
  assert.equal(questions.length, 705);
  assert.equal(selectedIds.size, 32);
  selectedIds.forEach((id) => assert.equal(added.filter((question) => question.knowledgePointIds.includes(id)).length, 4));
});

test("Sprint 17 优先覆盖阅读、词汇、固定表达与低覆盖文法", () => {
  const categories = new Map(cards.map((card) => [card.knowledgePointId, card.category]));
  const selectedCategories = [...selectedIds].map((id) => categories.get(id));
  assert.equal(selectedCategories.filter((category) => category === "reading").length, 5);
  assert.equal(selectedCategories.filter((category) => category === "vocabulary").length, 5);
  assert.equal(selectedCategories.filter((category) => category === "fixed_expression").length, 5);
  assert.equal(selectedCategories.filter((category) => category === "grammar").length, 17);
});

test("Sprint 17 八种考试语境、难度与答案位置均衡", () => {
  const expectedTypes = ["sentence", "dialogue", "notice", "email", "explanation", "reason", "author_viewpoint", "short_reading"];
  expectedTypes.forEach((name) => assert.equal(added.filter((question) => question.subType === `question_factory_${name}`).length, 16));
  for (let index = 1; index < added.length; index += 1) assert.notEqual(added[index].subType, added[index - 1].subType);
  assert.deepEqual([2, 3, 4, 5].map((difficulty) => added.filter((question) => question.difficulty === difficulty).length), [16, 32, 48, 32]);
  ["A", "B", "C", "D"].forEach((answer) => assert.equal(added.filter((question) => question.correctAnswer === answer).length, 32));
});

test("Sprint 17 新题元数据与完整解析符合最终质量标准", () => {
  added.forEach((question) => {
    assert.equal(question.sourceType, "ai_generated");
    assert.equal(question.generationType, "question_factory");
    assert.equal(question.knowledgePointIds.length, 1);
    ["A", "B", "C", "D"].forEach((key) => assert.ok(question.explanation.includes(`${key}「${question.choices[key]}」`)));
    assert.match(question.explanation, /正确理由：/);
    assert.match(question.explanation, /涉及知识点：/);
    assert.match(question.explanation, /类似例句1：/);
  });
});

test("Sprint 17 考试覆盖率超过70%且题库完成率达到83.43%", () => {
  const sprint16 = buildExamCoverage({ knowledgeCards: cards, questions: before, grammarPoints: grammar });
  const sprint17 = buildExamCoverage({ knowledgeCards: cards, questions, grammarPoints: grammar });
  assert.equal(sprint16.summary.coverageScore, 66.5);
  assert.equal(sprint17.summary.coverageScore, 70.9);
  assert.equal(Math.round(questions.length / version.questionTarget * 10000) / 100, 83.43);
});

test("Sprint 17 质量启发式与最终报告通过", async () => {
  const quality = analyzeQuestionBankQuality(questions, points, sources, { additionalKnowledgePoints: grammar });
  assert.equal(quality.summary.shortExplanationCount, 0);
  assert.equal(quality.summary.missingDistractorAnalysisCount, 0);
  assert.equal(quality.summary.obviousOptionCandidateCount, 0);
  assert.equal(quality.summary.multipleAnswerCandidateCount, 0);
  const finalReport = await readFile(new URL("../FINAL_RELEASE_REPORT.md", import.meta.url), "utf8");
  ["v1.17.0", "Sprint 17", "705", "70.90%", "83.43%", "111 / 111 PASS", "Ready For Exam：YES"]
    .forEach((value) => assert.match(finalReport, new RegExp(value.replaceAll(".", "\\."))));
});
