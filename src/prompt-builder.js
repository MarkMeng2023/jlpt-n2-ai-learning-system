export function buildChatGptPrompt({ question, answerRecord }) {
  const choiceLines = Object.entries(question.choices)
    .map(([key, value]) => `${key}. ${value}`)
    .join("\n");
  const confidenceLabels = { sure: "确定", uncertain: "不确定", guessed: "蒙的" };

  return `请讲解这道 JLPT N2 题：

题目ID：${question.questionId}
题型：${question.typeLabel}
题目：${question.prompt}
选项：
${choiceLines}
我的答案：${answerRecord.userAnswer}. ${question.choices[answerRecord.userAnswer]}
正确答案：${answerRecord.correctAnswer}. ${question.choices[answerRecord.correctAnswer]}
我选择时的确定度：${confidenceLabels[answerRecord.confidence]}
是否正确：${answerRecord.isCorrect ? "正确" : "错误"}
涉及知识点：${question.knowledgePointIds.join("、")}

请你：
1. 解释正确答案
2. 解释其他选项为什么错
3. 判断我是否需要加入弱点复习
4. 给我补充 2 个类似例句
5. 下一题继续训练`;
}
