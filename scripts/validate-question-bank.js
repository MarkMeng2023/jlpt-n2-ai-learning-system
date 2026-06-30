#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validateQuestionBank } from "../src/question-bank.js";

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error.message}`);
  }
}

try {
  const [questions, knowledgePoints] = await Promise.all([
    readJson("../data/questions.json", "questions.json"),
    readJson("../data/knowledge-points.json", "knowledge-points.json")
  ]);
  const result = validateQuestionBank(questions, knowledgePoints);
  if (!result.valid) {
    console.error(`Question bank validation failed with ${result.errors.length} error(s):`);
    result.errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`Question bank valid: ${questions.length} questions, ${knowledgePoints.length} knowledge points.`);
  }
} catch (error) {
  console.error(`Question bank validation failed: ${error.message}`);
  process.exitCode = 1;
}
