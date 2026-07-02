import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  analyzeQuestionBankQuality,
  renderQualityReportMarkdown,
  validateKnowledgePointSources
} from "../src/question-bank-quality.js";

const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"))
  .filter((question) => !question.questionId.startsWith("Q-N2-FAC-S14-") && !question.questionId.startsWith("Q-N2-FAC-S15-") && !question.questionId.startsWith("Q-N2-FAC-S16-") && !question.questionId.startsWith("Q-N2-FAC-S17-"));
const knowledgePoints = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const sourceRegistry = JSON.parse(await readFile(new URL("../data/knowledge-point-sources.json", import.meta.url), "utf8"));
const grammarPoints = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const allKnownPoints = [...knowledgePoints, ...grammarPoints];

test("Sprint 6 暂停扩题并为每个知识点建立来源登记项", () => {
  assert.ok(questions.length >= 80);
  assert.equal(sourceRegistry.length, new Set(allKnownPoints.map((point) => point.knowledgePointId)).size);
  assert.deepEqual(validateKnowledgePointSources(allKnownPoints, sourceRegistry), []);
});

test("质量报告输出知识点覆盖、题目来源和当前扩题门禁", () => {
  const report = analyzeQuestionBankQuality(questions, knowledgePoints, sourceRegistry, { additionalKnowledgePoints: grammarPoints });
  assert.equal(report.summary.questionCount, 205);
  assert.equal(report.summary.knowledgePointCount, 30);
  assert.equal(report.summary.onlyAiKnowledgePointCount, 25);
  assert.equal(report.summary.missingValidationSourceCount, 25);
  assert.equal(report.summary.expansionGate, "HOLD");
  assert.equal(report.knowledgePointCoverage.length, 30);
  assert.equal(report.questionSources.length, 205);
  assert.equal(report.shortExplanations.length, 0);
  assert.equal(report.missingDistractorAnalysis.length, 0);

  const markdown = renderQualityReportMarkdown(report);
  assert.match(markdown, /知识点覆盖与来源依据/);
  assert.match(markdown, /题目来源/);
  assert.match(markdown, /选项过于明显候选/);
  assert.match(markdown, /可能存在多个正确答案的候选/);
});

test("登记可靠证据后，知识点可脱离 AI-only 与缺少来源列表", () => {
  const registry = structuredClone(sourceRegistry);
  registry[0].validationStatus = "verified";
  registry[0].evidence = [{
    evidenceType: "linguistic_reference",
    sourceName: "Test Japanese Reference",
    sourceUrl: "https://example.com/reference",
    citation: "Entry 1, page 10",
    usagePermission: "reference_only",
    verifiedBy: "reviewer",
    verifiedAt: "2026-06-30T00:00:00.000Z"
  }];
  registry[0].lastReviewedAt = "2026-06-30T00:00:00.000Z";
  assert.deepEqual(validateKnowledgePointSources(allKnownPoints, registry), []);
  const report = analyzeQuestionBankQuality(questions, knowledgePoints, registry, { additionalKnowledgePoints: grammarPoints });
  assert.equal(report.summary.verifiedKnowledgePointCount, 6);
  assert.equal(report.summary.onlyAiKnowledgePointCount, 24);
  assert.equal(report.summary.missingValidationSourceCount, 24);
});

test("来源登记不能在无证据时伪标 verified", () => {
  const registry = structuredClone(sourceRegistry);
  const target = registry.find((entry) => entry.validationStatus === "unverified");
  target.validationStatus = "verified";
  if (Object.hasOwn(target, "verificationStatus")) target.verificationStatus = "verified";
  const errors = validateKnowledgePointSources(allKnownPoints, registry);
  assert.ok(errors.some((error) => /verified knowledge point must include evidence/.test(error)));
});

test("启发式检查能发现重复选项造成的多答案风险", () => {
  const candidate = structuredClone(questions[0]);
  candidate.choices.B = candidate.choices.A;
  const report = analyzeQuestionBankQuality([candidate], knowledgePoints, sourceRegistry, { additionalKnowledgePoints: grammarPoints });
  assert.equal(report.multipleAnswerCandidates.length, 1);
  assert.match(report.multipleAnswerCandidates[0].reasons[0], /A 与 B/);
});

test("来源策略文档包含官方优先、版权、AI 与分阶段扩题规则", async () => {
  const document = await readFile(new URL("../docs/question-bank-source-strategy.md", import.meta.url), "utf8");
  assert.match(document, /题库来源优先级/);
  assert.match(document, /知识点验证标准/);
  assert.match(document, /AI 出题标准/);
  assert.match(document, /真题与教材录入标准/);
  assert.match(document, /80 → 300 题/);
  assert.match(document, /300 → 1000 题/);
  assert.match(document, /1000 → 3000 题/);
  assert.match(document, /npm run report:quality/);
});
