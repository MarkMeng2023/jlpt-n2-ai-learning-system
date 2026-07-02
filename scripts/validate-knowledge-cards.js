#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validateKnowledgeCards } from "../src/knowledge-card.js";

const [cards, questions] = await Promise.all([
  readFile(new URL("../data/knowledge-cards.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/questions.json", import.meta.url), "utf8").then(JSON.parse)
]);
const result = validateKnowledgeCards(cards, questions);
if (!result.valid) {
  console.error(`Knowledge Card validation failed with ${result.errors.length} error(s):`);
  result.errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exitCode = 1;
} else console.log(`Knowledge Cards valid: ${cards.length} cards.`);
