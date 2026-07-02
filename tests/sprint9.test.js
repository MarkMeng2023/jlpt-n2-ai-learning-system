import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeQuestionBankQuality } from "../src/question-bank-quality.js";
import { buildQuestionFactoryPlan } from "../src/question-factory.js";
import { validateQuestionBank } from "../src/question-bank.js";

const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"))
  .filter((question) => !question.questionId.startsWith("Q-N2-FAC-S14-") && !question.questionId.startsWith("Q-N2-FAC-S15-"));
const points = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const grammar = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const sources = JSON.parse(await readFile(new URL("../data/knowledge-point-sources.json", import.meta.url), "utf8"));
const approved = new Set(["KP-READ-GUIDE-001","KP-READ-MAINIDEA-001","KP-READ-MEMO-001","KP-READ-NOTICE-001","KP-READ-REASON-001","KP-SYN-DATO-001","KP-SYN-HABUKU-001","KP-SYN-METTANI-001","KP-SYN-OOYOSO-001","KP-SYN-TADACHINI-001"]);
const generated = questions.filter((question) => question.generationType === "question_factory" && approved.has(question.knowledgePointId));
const sprint9Questions = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-GRA-") && !question.questionId.startsWith("Q-N2-FAC-S12-"));

test("Sprint 9 仅为 Factory Phase 1 Top 10 新增45题", () => {
  assert.equal(sprint9Questions.length, 125);
  assert.equal(generated.length, 45);
  assert.ok(generated.every((question) => question.knowledgePointIds.length === 1 && approved.has(question.knowledgePointIds[0])));
  assert.deepEqual(validateQuestionBank(questions, points, grammar), { valid: true, errors: [] });
});

test("Top 10 分别达到本阶段50%目标", () => {
  const counts = Object.fromEntries([...approved].map((id) => [id, questions.filter((question) => question.knowledgePointIds.includes(id)).length]));
  [...approved].filter((id) => id.startsWith("KP-READ-")).forEach((id) => assert.equal(counts[id], 8));
  [...approved].filter((id) => id.startsWith("KP-SYN-")).forEach((id) => assert.equal(counts[id], 5));
});

test("Factory 新题包含完整元数据和逐项解析", () => {
  generated.forEach((question) => {
    assert.equal(question.sourceType, "ai_generated");
    assert.equal(question.generationType, "question_factory");
    assert.equal(question.knowledgePointId, question.knowledgePointIds[0]);
    ["difficulty","reviewWeight","version","createdAt","updatedAt"].forEach((field) => assert.ok(question[field]));
    ["A","B","C","D"].forEach((key) => assert.ok(question.explanation.includes(`${key}「${question.choices[key]}」`)));
  });
});

test("Coverage 自动从9.47%提升到14.79%", () => {
  const factory = buildQuestionFactoryPlan({ basePoints: points, grammarPoints: grammar, questions: sprint9Questions });
  assert.equal(factory.summary.currentAssociations, 125);
  assert.equal(factory.summary.totalTarget, 845);
  assert.equal(factory.summary.totalGap, 720);
  assert.equal(factory.summary.targetCoverageRate, 14.79);
  assert.equal(factory.summary.pointCoverageRate, 30);
});

test("新增题不降低现有质量启发式指标", () => {
  const quality = analyzeQuestionBankQuality(questions, points, sources, { additionalKnowledgePoints: grammar });
  assert.equal(quality.summary.shortExplanationCount, 0);
  assert.equal(quality.summary.missingDistractorAnalysisCount, 0);
  assert.equal(quality.summary.obviousOptionCandidateCount, 0);
  assert.equal(quality.summary.multipleAnswerCandidateCount, 0);
  assert.equal(quality.summary.publicationBlockerCount, 25);
});

test("页面保留可动态更新的版本标识位置", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="project-eyebrow"/);
  assert.doesNotMatch(html, /JLPT N2 · Sprint 5/);
});

test("package.json 提供完整 Sprint 9 流水线命令", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(pkg.scripts["pipeline:sprint9"], /generate-sprint9-questions/);
  assert.match(pkg.scripts["pipeline:sprint9"], /validate-question-bank/);
  assert.match(pkg.scripts["pipeline:sprint9"], /validate-grammar-map/);
  assert.match(pkg.scripts["pipeline:sprint9"], /generate-question-factory-reports/);
  assert.match(pkg.scripts["pipeline:sprint9"], /report-question-bank-quality/);
});
