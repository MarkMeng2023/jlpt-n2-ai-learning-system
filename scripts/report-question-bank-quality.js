#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateQuestionBank } from "../src/question-bank.js";
import { analyzeQuestionBankQuality, renderQualityReportMarkdown } from "../src/question-bank-quality.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  const fullPath = resolve(projectRoot, relativePath);
  try {
    return JSON.parse(await readFile(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`);
  }
}

function getOutputPath(args) {
  const outputIndex = args.indexOf("--output");
  if (outputIndex === -1) return null;
  if (!args[outputIndex + 1]) throw new Error("--output requires a file path");
  return resolve(projectRoot, args[outputIndex + 1]);
}

try {
  const args = process.argv.slice(2);
  const [questions, knowledgePoints, sourceRegistry, grammarPoints] = await Promise.all([
    readJson("data/questions.json"),
    readJson("data/knowledge-points.json"),
    readJson("data/knowledge-point-sources.json"),
    readJson("knowledge/grammar/grammar-points.json")
  ]);
  const structural = validateQuestionBank(questions, knowledgePoints, grammarPoints);
  if (!structural.valid) {
    structural.errors.forEach((error) => console.error(error));
    throw new Error(`structural validation failed with ${structural.errors.length} error(s)`);
  }
  const report = analyzeQuestionBankQuality(questions, knowledgePoints, sourceRegistry, { additionalKnowledgePoints: grammarPoints });
  const markdown = renderQualityReportMarkdown(report);
  const outputPath = getOutputPath(args);
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${markdown}\n`);
    console.log(`Quality report written to ${outputPath}`);
  } else {
    console.log(markdown);
  }
  console.log(`Expansion gate: ${report.summary.expansionGate}; publication blockers: ${report.summary.publicationBlockerCount}.`);
  if (args.includes("--strict") && report.summary.expansionGate !== "PASS") process.exitCode = 1;
} catch (error) {
  console.error(`Quality report failed: ${error.message}`);
  process.exitCode = 1;
}
