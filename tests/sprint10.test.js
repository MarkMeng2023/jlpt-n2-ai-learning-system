import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeQuestionBankQuality } from "../src/question-bank-quality.js";
import { buildQuestionFactoryPlan } from "../src/question-factory.js";
import { validateQuestionBank } from "../src/question-bank.js";
import { buildProjectStatus, loadProjectStatusData } from "../src/project-status.js";

const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"))
  .filter((question) => !question.questionId.startsWith("Q-N2-FAC-S14-") && !question.questionId.startsWith("Q-N2-FAC-S15-"));
const points = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const grammar = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const sources = JSON.parse(await readFile(new URL("../data/knowledge-point-sources.json", import.meta.url), "utf8"));
const version = JSON.parse(await readFile(new URL("../data/version.json", import.meta.url), "utf8"));
const sprint10Version = { ...version, version: "v1.10.0", sprint: "Sprint 10" };
const sprint10Questions = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-S12-"));
const phase2 = questions.filter((question) => question.questionId.startsWith("Q-N2-FAC-GRA-"));
const phase2Ids = ["KP-GRA-AGEKU-001","KP-GRA-IJOUWA-001","KP-GRA-KAGIRI-001","KP-GRA-NAIKOTONIWA-001","KP-GRA-NIMOKAKAWARAZU-001","KP-GRA-NISUGINAI-001","KP-GRA-OSOREGAARU-001","KP-GRA-TEIRAI-001","KP-GRA-BAKARIDA-001","KP-GRA-BAKARINI-001"];

test("Phase 2 仅为未参与 Sprint 9 的 Top 10 新增40题", () => {
  assert.equal(sprint10Questions.length, 165);
  assert.equal(phase2.length, 40);
  assert.deepEqual(new Set(phase2.map((question) => question.knowledgePointId)), new Set(phase2Ids));
  phase2Ids.forEach((id) => assert.equal(questions.filter((question) => question.knowledgePointIds.includes(id)).length, 4));
  assert.deepEqual(validateQuestionBank(questions, points, grammar), { valid: true, errors: [] });
});

test("Phase 2 每个知识点包含基础、辨析、语境、综合四类", () => {
  phase2Ids.forEach((id) => {
    const stages = phase2.filter((question) => question.knowledgePointId === id).map((question) => question.subType).sort();
    assert.deepEqual(stages, ["question_factory_basic","question_factory_context","question_factory_distinction","question_factory_integrated"]);
  });
});

test("Phase 2 元数据和完整解析符合约束", () => {
  phase2.forEach((question) => {
    assert.equal(question.generationType, "question_factory");
    assert.equal(question.sourceType, "ai_generated");
    assert.equal(question.knowledgePointId, question.knowledgePointIds[0]);
    ["difficulty","reviewWeight","version","createdAt","updatedAt"].forEach((field) => assert.ok(question[field]));
    ["A","B","C","D"].forEach((key) => assert.ok(question.explanation.includes(`${key}「${question.choices[key]}」`)));
    assert.match(question.explanation, /类似例句：/);
  });
});

test("Sprint 10 Coverage 为165/845与19.53%", () => {
  const factory = buildQuestionFactoryPlan({ basePoints: points, grammarPoints: grammar, questions: sprint10Questions });
  assert.equal(factory.summary.knowledgePointCount, 100);
  assert.equal(factory.summary.currentAssociations, 165);
  assert.equal(factory.summary.totalTarget, 845);
  assert.equal(factory.summary.totalGap, 680);
  assert.equal(factory.summary.targetCoverageRate, 19.53);
  assert.equal(factory.summary.pointCoverageRate, 40);
});

test("Project Status 从版本和题库数据自动计算", async () => {
  const status = buildProjectStatus({ questions: sprint10Questions, basePoints: points, grammarPoints: grammar, version: sprint10Version });
  assert.equal(status.version, "v1.10.0");
  assert.equal(status.sprint, "Sprint 10");
  assert.equal(status.questionCount, 165);
  assert.equal(status.knowledgePointCount, 100);
  assert.equal(status.coverage, 19.53);
  assert.equal(status.questionTarget, 845);
  assert.ok(!Number.isNaN(Date.parse(status.lastUpdated)));

  const fetchMock = async (url) => ({ ok: true, json: async () => url.includes("version") ? sprint10Version : grammar });
  assert.deepEqual(await loadProjectStatusData(sprint10Questions, points, fetchMock), status);
});

test("首页 Project Status 无硬编码统计值", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="project-status-heading"/);
  assert.match(html, /id="project-question-count">—/);
  assert.match(html, /id="project-coverage">—/);
  assert.doesNotMatch(html, /165 Questions|19\.53%|v1\.10\.0|Sprint 10/);
});

test("新增题不降低质量启发式指标", () => {
  const quality = analyzeQuestionBankQuality(questions, points, sources, { additionalKnowledgePoints: grammar });
  assert.equal(quality.summary.shortExplanationCount, 0);
  assert.equal(quality.summary.missingDistractorAnalysisCount, 0);
  assert.equal(quality.summary.obviousOptionCandidateCount, 0);
  assert.equal(quality.summary.multipleAnswerCandidateCount, 0);
});

test("历史流水线与当前自动报告保持可用", async () => {
  const [coverage, plan, quality, pkg] = await Promise.all([
    readFile(new URL("../knowledge/reports/question-coverage-report.md", import.meta.url), "utf8"),
    readFile(new URL("../reports/question-generation-plan.md", import.meta.url), "utf8"),
    readFile(new URL("../reports/question-bank-quality.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  assert.match(coverage, /当前题目数：\*\*449\*\*/);
  assert.match(coverage, /目标完成率：\*\*53\.14%\*\*/);
  assert.match(plan, /建议新增关联数：\*\*396\*\*/);
  assert.match(quality, /\| 题目数 \| 449 \|/);
  assert.match(pkg.scripts["pipeline:sprint10"], /generate-sprint10-questions/);
});
