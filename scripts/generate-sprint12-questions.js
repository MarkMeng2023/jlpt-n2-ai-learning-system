#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { buildQuestionFactoryPlan, createQuestionMetadata } from "../src/question-factory.js";

const questionsUrl = new URL("../data/questions.json", import.meta.url);
const cardsUrl = new URL("../data/knowledge-cards.json", import.meta.url);
const versionUrl = new URL("../data/version.json", import.meta.url);

const [questions, knowledgeCards, version] = await Promise.all([
  readFile(questionsUrl, "utf8").then(JSON.parse),
  readFile(cardsUrl, "utf8").then(JSON.parse),
  readFile(versionUrl, "utf8").then(JSON.parse)
]);

const pointById = new Map(knowledgeCards.map((point) => [point.knowledgePointId, point]));
const questionsBeforeSprint12 = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-S12-"));
const existingPlan = buildQuestionFactoryPlan({ knowledgeCards, questions: questionsBeforeSprint12 });
const approvedIds = existingPlan.generationPlan.slice(0, 10).map((entry) => entry.knowledgePointId);
const expectedIds = [
  "KP-GRA-AMARI-001",
  "KP-GRA-BAKARIKA-001",
  "KP-GRA-BEKIDA-001",
  "KP-GRA-BEKIDEWANAI-001",
  "KP-GRA-BEKU-001",
  "KP-GRA-DOKORODEWANAI-001",
  "KP-GRA-HANMEN-001",
  "KP-GRA-HAZUDA-001",
  "KP-GRA-HODO-001",
  "KP-GRA-IPPOUDE-001"
];
if (JSON.stringify(approvedIds) !== JSON.stringify(expectedIds)) {
  throw new Error(`Sprint 12 Top 10 mismatch: ${approvedIds.join(", ")}`);
}

const generatedAt = new Date();

// [knowledgePointId, prompt, choices A/B/C/D, answer, correct reason, difficulty, generation stage]
const specs = [
  ["KP-GRA-AMARI-001","緊張の（　　）、面接で名前を言い間違えてしまった。",["あまり","ばかりか","反面","一方で"],"A","感情や状態が強すぎた結果、思わぬ行動が起きたので「あまり」が自然である。",2,"basic"],
  ["KP-GRA-AMARI-001","うれしさのあまり、彼女は（　　）。",["涙を流した","予定を立てるべきだ","静かな反面だ","帰るはずだった"],"A","喜びが強すぎた結果として涙が出た、という因果関係が「あまり」に合う。",3,"distinction"],
  ["KP-GRA-AMARI-001","仕事に集中するあまり、昼食を（　　）。",["忘れてしまった","食べるばかりか","食べるべく","食べる一方で"],"A","集中しすぎた結果の失敗・不注意を表すため「忘れてしまった」が自然である。",3,"context"],
  ["KP-GRA-AMARI-001","「～あまり」が最も自然な文はどれか。",["心配のあまり、眠れなかった","心配のあまり、明日は晴れる","心配のあまり、駅は近い","心配のあまり、資料を配るべく"],"A","心配が強すぎて眠れないという結果を表している。",4,"integrated"],

  ["KP-GRA-BAKARIKA-001","彼は英語（　　）、中国語も話せる。",["ばかりか","あまり","べく","ほど"],"A","一つだけでなく、さらに別の能力もあることを追加するため「ばかりか」が合う。",2,"basic"],
  ["KP-GRA-BAKARIKA-001","その店は値段が高いばかりか、（　　）。",["サービスもよくない","値段が高いはずだ","安くするべきだ","店を開くべく"],"A","悪い特徴をさらに追加して述べており、「ばかりか」の累加用法に合う。",3,"distinction"],
  ["KP-GRA-BAKARIKA-001","このアプリは便利なばかりか、操作も（　　）。",["とても簡単だ","簡単なあまりだ","簡単であるどころではない","簡単するべきではない"],"A","便利さに加えて操作性の良さを追加しているので自然である。",3,"context"],
  ["KP-GRA-BAKARIKA-001","「ばかりか」の用法として正しいものはどれか。",["彼は遅刻したばかりか、宿題も忘れた","彼は遅刻したばかりか、もう到着するはずだ","遅刻のばかりか、早く出た","遅刻するべく、早く起きた"],"A","遅刻に加えて宿題忘れという別の問題を追加している。",4,"integrated"],

  ["KP-GRA-BEKIDA-001","約束は最後まで守る（　　）。",["べきだ","べく","どころではない","一方で"],"A","一般的な義務・当然の判断を述べるため「べきだ」が合う。",2,"basic"],
  ["KP-GRA-BEKIDA-001","困ったときは、一人で抱え込まずに（　　）。",["相談すべきだ","相談したあまりだ","相談どころではない","相談ばかりか"],"A","望ましい行動として助言しているため「相談すべきだ」が自然である。",3,"distinction"],
  ["KP-GRA-BEKIDA-001","資料に誤りがあれば、すぐに担当者へ知らせる（　　）。",["べきだ","はずだ","ほどだ","反面だ"],"A","誤りを見つけた時の適切な対応・義務を述べている。",3,"context"],
  ["KP-GRA-BEKIDA-001","「べきだ」が最も自然な文はどれか。",["安全のため、決められた手順を守るべきだ","安全のため、手順を守るあまりだ","安全のため、手順どころではない","安全のため、手順ばかりか"],"A","話者が当然取るべき行動として助言している。",4,"integrated"],

  ["KP-GRA-BEKIDEWANAI-001","人を見た目だけで判断する（　　）。",["べきではない","はずではない","どころではない","一方ではない"],"A","望ましくない行為を禁止・忠告する表現なので「べきではない」が合う。",2,"basic"],
  ["KP-GRA-BEKIDEWANAI-001","体調が悪いのに、無理をして働き続けるべきではない。近い意味はどれか。",["働き続けないほうがよい","働き続けるはずだ","働き続けるほど元気だ","働き続ける反面だ"],"A","「べきではない」は避けるべき行動を述べる助言である。",3,"distinction"],
  ["KP-GRA-BEKIDEWANAI-001","個人情報を、本人の許可なく外部に（　　）。",["出すべきではない","出すべく","出すばかりか","出すはずだ"],"A","してはいけない行為として強く忠告しているため自然である。",3,"context"],
  ["KP-GRA-BEKIDEWANAI-001","「べきではない」の用法として適切なものはどれか。",["失敗した人を必要以上に責めるべきではない","失敗した人を責めるべく、助けた","失敗した人を責める反面、責めた","失敗した人を責めるほど、責めない"],"A","相手を責める行為を避けるべきだと述べている。",4,"integrated"],

  ["KP-GRA-BEKU-001","問題を解決す（　　）、専門家チームが作られた。",["べく","べきだ","ばかりか","あまり"],"A","目的を表す硬めの表現で、「解決するために」の意味になる。",3,"basic"],
  ["KP-GRA-BEKU-001","目標を達成するべく、（　　）。",["計画を立て直した","達成するべきではない","達成したあまりだ","達成どころではない"],"A","目標達成を目的として具体的な行動をした文が自然である。",3,"distinction"],
  ["KP-GRA-BEKU-001","新制度を周知すべく、説明会が各地で（　　）。",["開かれた","開くべきではない","開く反面だ","開くばかりか"],"A","周知する目的で説明会を開催したという関係が成立する。",4,"context"],
  ["KP-GRA-BEKU-001","「べく」が自然に使われている文はどれか。",["原因を明らかにすべく、調査を始めた","原因を明らかにすべく、何もしなかった","原因を明らかにすべく、原因がない","原因を明らかにすべく、昨日は休みだった"],"A","原因解明を目的として調査を始めるという目的関係が明確である。",4,"integrated"],

  ["KP-GRA-DOKORODEWANAI-001","仕事が山ほどあって、旅行（　　）。",["どころではない","ばかりか","べきだ","一方で"],"A","忙しすぎて旅行を考える余裕がないため「どころではない」が合う。",2,"basic"],
  ["KP-GRA-DOKORODEWANAI-001","熱が高くて、勉強どころではない。近い意味はどれか。",["勉強できる状態ではない","勉強するべきだ","勉強するためだ","勉強に加えて運動もする"],"A","ある行為をする余裕・状態ではないことを表している。",3,"distinction"],
  ["KP-GRA-DOKORODEWANAI-001","急なトラブルで、昼休みを取る（　　）。",["どころではなかった","ほどではなかった","反面ではなかった","はずではなかった"],"A","トラブル対応で休憩する余裕がなかった状況に合う。",3,"context"],
  ["KP-GRA-DOKORODEWANAI-001","「どころではない」が適切な文はどれか。",["締切前で忙しく、映画を見るどころではない","締切前で忙しく、映画を見るべく忙しい","映画を見るどころではないので、映画を二本見た","映画を見るどころではないばかりか、映画だけを見る"],"A","忙しさのため映画を見る余裕がないことを表している。",4,"integrated"],

  ["KP-GRA-HANMEN-001","都会は便利な（　　）、生活費が高い。",["反面","あまり","べく","はず"],"A","良い面と悪い面を対比して述べているため「反面」が合う。",2,"basic"],
  ["KP-GRA-HANMEN-001","この仕事は自由な反面、（　　）。",["責任も重い","自由であるべきだ","自由どころではない","自由のあまりだ"],"A","自由という利点と責任の重さという別面を対比している。",3,"distinction"],
  ["KP-GRA-HANMEN-001","オンライン会議は移動時間が減る反面、雑談の機会が（　　）。",["少なくなる","少なくするべく","少ないはずだだけ","少ないばかりか"],"A","利点と欠点を対照的に述べる文として自然である。",3,"context"],
  ["KP-GRA-HANMEN-001","「反面」が最も自然な文はどれか。",["この方法は簡単な反面、細かい調整が難しい","この方法は簡単な反面、簡単するべきだ","この方法は簡単な反面、昨日始めた","この方法は簡単な反面、簡単のあまりだ"],"A","簡単さと調整の難しさという二面性を表している。",4,"integrated"],

  ["KP-GRA-HAZUDA-001","地図では駅はこの近くにある（　　）。",["はずだ","べく","反面","どころではない"],"A","根拠にもとづく当然の推量を述べるため「はずだ」が合う。",2,"basic"],
  ["KP-GRA-HAZUDA-001","彼は昨日出発したから、もう現地に着いているはずだ。近い意味はどれか。",["着いていると思われる","着いてはいけない","着くためだ","着く余裕がない"],"A","出発時刻という根拠から当然そうだと判断している。",3,"distinction"],
  ["KP-GRA-HAZUDA-001","予約確認メールが来ているので、席は確保されている（　　）。",["はずだ","あまりだ","ばかりか","べきではない"],"A","確認メールを根拠にした推量なので「はずだ」が自然である。",3,"context"],
  ["KP-GRA-HAZUDA-001","「はずだ」が適切な文はどれか。",["今日は祝日だから、銀行は休みのはずだ","今日は祝日だから、銀行は休むべく","銀行は休みのはずだが、休むべきではない反面","銀行は休みのはずだので、昨日休みだった"],"A","祝日という根拠から銀行が休みだと判断している。",4,"integrated"],

  ["KP-GRA-HODO-001","声が出ない（　　）、驚いた。",["ほど","べく","ばかりか","反面"],"A","驚きの程度が声が出ないくらい強いことを表すため「ほど」が合う。",2,"basic"],
  ["KP-GRA-HODO-001","練習すればするほど、（　　）。",["上達する","練習するべきではない","練習どころではない","練習する反面だ"],"A","「～ば～ほど」は一方が進むにつれて他方も変化する関係を表す。",3,"distinction"],
  ["KP-GRA-HODO-001","この坂は、息が切れるほど（　　）。",["とても急だ","急ぐべく","急なばかりか","急なはずだった"],"A","息が切れるくらい坂の程度が强いことを表している。",3,"context"],
  ["KP-GRA-HODO-001","「ほど」が最も自然な文はどれか。",["涙が出るほど感動した","涙が出るほど、感動するべきではない","涙が出るほど、感動どころではない","涙が出るほど、感動すべく"],"A","感動の強さを程度で表している。",4,"integrated"],

  ["KP-GRA-IPPOUDE-001","この町は人口が減る（　　）、駅前では新しい店が増えている。",["一方で","あまり","べく","ほど"],"A","一つの側面と別の側面を並べて対比するため「一方で」が合う。",2,"basic"],
  ["KP-GRA-IPPOUDE-001","オンライン授業は便利な一方で、（　　）。",["集中しにくい面もある","便利であるべきだ","便利どころではない","便利のあまりだ"],"A","便利さと集中のしにくさという別側面を対比している。",3,"distinction"],
  ["KP-GRA-IPPOUDE-001","この制度は負担を減らす一方で、新しい手続きも（　　）。",["増やしている","増やすべく","増やすべきではないほど","増やすはずだだけ"],"A","負担軽減と手続き増加という二つの側面を述べている。",3,"context"],
  ["KP-GRA-IPPOUDE-001","「一方で」が自然に使われている文はどれか。",["都市部では人口が増える一方で、地方では減少している","人口が増える一方で、人口だけが増えるべきだ","人口が増える一方で、増えたあまりだ","人口が増える一方で、増えるどころではない"],"A","都市部と地方の対照的な状況を並べている。",4,"integrated"]
];

function explanation(point, choices, answer, reason) {
  const analysis = Object.entries(choices).map(([key, value]) => key === answer
    ? `${key}「${value}」：正确。${reason}`
    : `${key}「${value}」：错误。它不能满足「${point.title}」要求的接续、语义关系或语境功能，因此不适合本题。`).join(" ");
  return `知识点：${point.title}（${point.meaning}）。接续：${point.grammarPattern}。正确答案：${answer}。正确理由：${reason} 选项分析：${analysis} 涉及知识点：${point.title}。类似例句1：${point.examples[0]} 类似例句2：${point.examples[1]}`;
}

const generated = specs.map(([pointId, prompt, values, answer, reason, difficulty, stage], index) => {
  const point = pointById.get(pointId);
  if (!point) throw new Error(`Unknown point: ${pointId}`);
  const choices = Object.fromEntries(["A", "B", "C", "D"].map((key, choiceIndex) => [key, values[choiceIndex]]));
  return {
    questionId: `Q-N2-FAC-S12-${String(index + 1).padStart(4, "0")}`,
    level: "N2",
    section: "grammar",
    type: "grammar_choice",
    subType: `question_factory_${stage}`,
    prompt,
    choices,
    correctAnswer: answer,
    explanation: explanation(point, choices, answer, reason),
    knowledgePointIds: [pointId],
    knowledgePointTitles: [point.title],
    ...createQuestionMetadata({ knowledgePointId: pointId, generationType: "question_factory", difficulty, now: generatedAt }),
    sourceName: "JLPT N2 AI Learning System Question Factory",
    tags: ["question_factory", "sprint12", stage, ...((point.tags || [point.category]).slice(0, 1))],
    estimatedTime: 60
  };
});

if (generated.length !== 40) throw new Error(`Expected 40 questions, received ${generated.length}`);
if (generated.some((question) => !expectedIds.includes(question.knowledgePointId))) {
  throw new Error("Question outside approved Sprint 12 Top 10");
}
const generatedIds = new Set(generated.map((question) => question.questionId));
const retained = questions.filter((question) => !generatedIds.has(question.questionId));
await Promise.all([
  writeFile(questionsUrl, `${JSON.stringify([...retained, ...generated], null, 2)}\n`),
  writeFile(versionUrl, `${JSON.stringify({ ...version, version: "v1.12.0", sprint: "Sprint 12", lastUpdated: generatedAt.toISOString() }, null, 2)}\n`)
]);
console.log(`Sprint 12 Question Factory: ${generated.length} questions generated; bank total ${retained.length + generated.length}.`);
