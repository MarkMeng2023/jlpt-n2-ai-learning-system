#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createQuestionMetadata } from "../src/question-factory.js";

const questionsUrl = new URL("../data/questions.json", import.meta.url);
const versionUrl = new URL("../data/version.json", import.meta.url);
const [questions, grammarPoints, version] = await Promise.all([
  readFile(questionsUrl, "utf8").then(JSON.parse),
  readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(versionUrl, "utf8").then(JSON.parse)
]);
const pointById = new Map(grammarPoints.map((point) => [point.knowledgePointId, point]));
const generatedAt = new Date();

// [knowledgePointId, prompt, choices A/B/C/D, answer, correct reason, difficulty, generation stage]
const specs = [
  ["KP-GRA-AGEKU-001","三時間も話し合った（　　）、結論は出なかった。",["以上は","あげく","限り","ばかりに"],"B","長時間の話し合いという過程の末に、望ましくない結果になったため「あげく」が合う。",2,"basic"],
  ["KP-GRA-AGEKU-001","彼は何度も店を回ったあげく、（　　）。",["何も買わずに帰った","明日から店を回る","店に着いたばかりだ","買う予定にしている"],"A","長い経過の末の残念な結果「何も買わずに帰った」が「あげく」と自然につながる。",3,"distinction"],
  ["KP-GRA-AGEKU-001","道に迷ったあげく、約束の時間に一時間も遅れて（　　）。",["しまった","以来だ","いる限りだ","すぎなかった"],"A","迷い続けた末の好ましくない結果なので「あげく～てしまった」が自然である。",3,"context"],
  ["KP-GRA-AGEKU-001","「あげく」の使い方として最も自然なものはどれか。",["朝起きたあげく、顔を洗った","よく考えたあげく、計画を中止した","日本にいるあげく、日本語を学ぶ","明日出発するあげく、準備する"],"B","十分に考えた長い過程と、計画中止という結果を結ぶ用法が適切である。",4,"integrated"],

  ["KP-GRA-IJOUWA-001","この仕事を引き受けた（　　）、最後まで責任を持つつもりだ。",["ものの","ばかりに","以上は","以来"],"C","仕事を引き受けた事実を前提に責任や決意を述べるため「以上は」が合う。",2,"basic"],
  ["KP-GRA-IJOUWA-001","約束した以上は、（　　）。",["守らなければならない","守ったことがない","守ったばかりだ","守るおそれがある"],"A","「以上は」は確定した前提から当然の義務を導くので「守らなければならない」が自然である。",3,"distinction"],
  ["KP-GRA-IJOUWA-001","代表に選ばれた以上、途中で（　　）わけにはいかない。",["あきらめる","あきらめた","あきらめて","あきらめない"],"A","代表に選ばれた以上は責任が生じるため、「途中であきらめるわけにはいかない」となる。",3,"context"],
  ["KP-GRA-IJOUWA-001","「以上は」が最も自然に使われている文はどれか。",["雨が降った以上は、道がぬれているらしい","参加すると決めた以上は、全力を尽くしたい","駅に着いた以上は、電車が出たばかりだ","春になった以上は、花が好きではない"],"B","参加を決めたという前提から決意を述べる文が「以上は」の用法に合う。",4,"integrated"],

  ["KP-GRA-KAGIRI-001","体力が続く（　　）、この仕事を続けたい。",["あげく","ばかりに","限り","以来"],"C","体力が続いている間という条件範囲を表すため「限り」が合う。",2,"basic"],
  ["KP-GRA-KAGIRI-001","この町に住んでいる限り、（　　）。",["地域の規則を守る必要がある","昨日引っ越してきた","来年引っ越したばかりだ","町を見たことがない"],"A","住んでいる期間・条件が続く間の義務を述べる文が自然である。",3,"distinction"],
  ["KP-GRA-KAGIRI-001","私が知っている限り、その店は日曜日も（　　）。",["営業している","営業したあげくだ","営業するばかりに","営業して以来だ"],"A","「知っている限り」は自分の知識の範囲内で判断を述べる表現である。",3,"context"],
  ["KP-GRA-KAGIRI-001","「限り」の使い方として適切なものはどれか。",["元気な限り、働き続けたい","失敗した限り、成功した","到着した限り、出発する","一度読んだ限り、まだ読んでいない"],"A","元気である状態が続く間という条件を示しており、後件との関係が自然である。",4,"integrated"],

  ["KP-GRA-NAIKOTONIWA-001","実際に使ってみ（　　）、この道具の便利さは分からない。",["ないことには","たあげく","た以上は","て以来"],"A","実際に使うことを必要条件としているため「使ってみないことには」が合う。",2,"basic"],
  ["KP-GRA-NAIKOTONIWA-001","本人に確認しないことには、（　　）。",["本当の理由は判断できない","理由がすぐ分かった","昨日確認したばかりだ","確認するおそれがある"],"A","本人への確認なしには判断できないという必要条件を表している。",3,"distinction"],
  ["KP-GRA-NAIKOTONIWA-001","現物を見ないことには、購入するかどうか（　　）。",["決められない","決めたあげくだ","決めて以来だ","決めるばかりだ"],"A","現物を見ることが購入判断の前提なので、後件は不可能を表す「決められない」となる。",3,"context"],
  ["KP-GRA-NAIKOTONIWA-001","「ないことには」が自然に使われている文はどれか。",["説明を聞かないことには、内容を理解できない","説明を聞かないことには、全部理解した","昨日聞かないことには、明日聞いた","簡単なことには、説明が長い"],"A","説明を聞くことが理解の必要条件となり、否定的な後件につながっている。",4,"integrated"],

  ["KP-GRA-NIMOKAKAWARAZU-001","激しい雨（　　）、試合は予定どおり行われた。",["にすぎず","にもかかわらず","て以来","ばかりに"],"B","激しい雨という条件に反して試合が行われたため「にもかかわらず」が合う。",2,"basic"],
  ["KP-GRA-NIMOKAKAWARAZU-001","十分に準備したにもかかわらず、（　　）。",["本番では力を出せなかった","予定どおり成功するはずだ","準備を始めるところだ","毎日準備することにした"],"A","十分な準備から期待される結果と反対の失敗を述べるため自然である。",3,"distinction"],
  ["KP-GRA-NIMOKAKAWARAZU-001","彼は医者に止められたにもかかわらず、無理な運動を（　　）。",["続けた","続ける限りだ","続けて以来だ","続けるにすぎない"],"A","医者の制止に反する行動を実際にしたことを表す「続けた」が合う。",3,"context"],
  ["KP-GRA-NIMOKAKAWARAZU-001","「にもかかわらず」の用法として正しいものはどれか。",["休日にもかかわらず、会社には多くの人がいた","休日にもかかわらず、休日になる予定だ","休日にもかかわらず、昨日は平日だった","休日にもかかわらず、休みたいと思った"],"A","休日なら人が少ないという予想に反して多くの人がいた、という逆接が成立する。",4,"integrated"],

  ["KP-GRA-NISUGINAI-001","これは私個人の意見（　　）。",["にすぎない","にもかかわらず","て以来だ","ばかりに"],"A","重要性や範囲を限定して「ただの個人意見だ」と述べるため「にすぎない」が合う。",2,"basic"],
  ["KP-GRA-NISUGINAI-001","彼は責任者ではなく、単なる担当者にすぎない。最も近い意味はどれか。",["担当者以上の権限がある","ただの担当者である","担当者になるおそれがある","担当者を辞めたばかりだ"],"B","「にすぎない」は範囲を限定するため、「ただの担当者である」が同じ意味になる。",3,"distinction"],
  ["KP-GRA-NISUGINAI-001","今回の成功は長い計画の第一歩に（　　）。",["すぎない","かかわらない","限らない","伴わない"],"A","成功を過大評価せず「第一歩だけだ」と限定する表現になる。",3,"context"],
  ["KP-GRA-NISUGINAI-001","「にすぎない」が適切な文はどれか。",["この数字は推測にすぎず、確定値ではない","この数字は推測にすぎず、必ず正しい","推測にすぎないから、事実そのものだ","確定したにすぎないので、推測ではない"],"A","推測という限定的な情報で、確定値ではないという対比が自然である。",4,"integrated"],

  ["KP-GRA-OSOREGAARU-001","このまま雨が続くと、川があふれる（　　）。",["以上は","おそれがある","にすぎない","て以来だ"],"B","雨による洪水という好ましくない可能性を述べるため「おそれがある」が合う。",2,"basic"],
  ["KP-GRA-OSOREGAARU-001","強い風のため、電車が遅れるおそれがある。最も近い意味はどれか。",["電車は必ず遅れる","電車が遅れる可能性がある","電車はすでに到着した","電車は遅れないと決まった"],"B","「おそれがある」は悪い事態が起こる可能性を表し、確定ではない。",3,"distinction"],
  ["KP-GRA-OSOREGAARU-001","情報を公開すると、個人が特定されるおそれが（　　）。",["ある","いる","する","なる"],"A","定型表現は「おそれがある」であり、個人特定という望ましくない可能性を示す。",3,"context"],
  ["KP-GRA-OSOREGAARU-001","「おそれがある」の使い方として自然なものはどれか。",["対策が遅れると、被害が拡大するおそれがある","努力すれば、目標を達成するおそれがある","誕生日なので、祝われるおそれがある","景色が美しくなるおそれがある"],"A","被害拡大という好ましくない可能性に使われており、表現の性質に合う。",4,"integrated"],

  ["KP-GRA-TEIRAI-001","日本に来（　　）、毎日日本語で日記を書いている。",["た以上","て以来","たあげく","る限り"],"B","日本に来た時点から現在まで習慣が続いているため「て以来」が合う。",2,"basic"],
  ["KP-GRA-TEIRAI-001","大学を卒業して以来、（　　）。",["一度も先生に会っていない","来年卒業する予定だ","卒業式が始まるところだ","卒業するかもしれない"],"A","卒業時から現在まで会っていない状態が継続している。",3,"distinction"],
  ["KP-GRA-TEIRAI-001","その本を読んで以来、環境問題に関心を持つ（　　）。",["ようになった","あげくになった","限りになった","おそれになった"],"A","本を読んだことを起点に現在まで意識の変化が続いているため自然である。",3,"context"],
  ["KP-GRA-TEIRAI-001","「て以来」が自然に使われている文はどれか。",["引っ越して以来、この町で暮らしている","引っ越して以来、来月引っ越す予定だだけ","引っ越す以来、荷物を準備した","昨日以来に、明日出発した"],"A","引っ越した時点から現在まで暮らしが続くことを正しく表している。",4,"integrated"],

  ["KP-GRA-BAKARIDA-001","物価は上がる（　　）で、生活は苦しくなっている。",["あげく","ばかり","以来","以上"],"B","物価上昇が一方向に進み続ける変化を表すため「上がるばかり」が合う。",2,"basic"],
  ["KP-GRA-BAKARIDA-001","薬を飲まなければ、症状は悪くなるばかりだ。最も近い意味はどれか。",["症状は改善し続ける","症状は悪化する一方だ","症状はすでに治った","症状は変化しない"],"B","「ばかりだ」は一方向への変化の進行を示し、「悪化する一方だ」と近い。",3,"distinction"],
  ["KP-GRA-BAKARIDA-001","何も対策をしなければ、ごみは増える（　　）。",["ばかりだ","て以来だ","にすぎない","にもかかわらず"],"A","対策がない状態でごみが一方向に増え続けることを表す。",3,"context"],
  ["KP-GRA-BAKARIDA-001","変化を表す「ばかりだ」が適切な文はどれか。",["練習しないので、成績は下がるばかりだ","駅に着いたばかりだが、電車に乗る","本を一冊ばかり買った","彼ばかりが発表した"],"A","成績が一方向に下がり続ける変化を表す用法である。",4,"integrated"],

  ["KP-GRA-BAKARINI-001","少し油断した（　　）、大切な機会を逃してしまった。",["以上は","ばかりに","て以来","限り"],"B","油断という原因から重大で望ましくない結果が生じたため「ばかりに」が合う。",2,"basic"],
  ["KP-GRA-BAKARINI-001","正直に話したばかりに、（　　）。",["かえって相手を怒らせてしまった","相手に話す予定を立てた","今から話すところだ","毎日話すことにしている"],"A","正直に話したことが皮肉にも悪い結果を招いた関係が自然である。",3,"distinction"],
  ["KP-GRA-BAKARINI-001","近道を選んだばかりに、道に迷って余計に時間が（　　）。",["かかった","かかる限りだ","かかって以来だ","かかるにすぎない"],"A","近道を選んだことが原因で、逆に時間がかかったという後悔を表している。",3,"context"],
  ["KP-GRA-BAKARINI-001","「ばかりに」が最も自然な文はどれか。",["一言余計なことを言ったばかりに、関係が悪くなった","朝起きたばかりに、顔を洗った","本を読んだばかりに、内容を知っている","駅に着いたばかりに、電車を待つ"],"A","余計な一言だけが原因で悪い結果を招いた、という後悔の因果関係を表す。",4,"integrated"]
];

function explanation(point, choices, answer, reason) {
  const analysis = Object.entries(choices).map(([key, value]) => key === answer
    ? `${key}「${value}」：正确。${reason}`
    : `${key}「${value}」：错误。${point.title}所要求的接续、语义关系或语境功能不成立，不能表达本题的目标含义。`).join(" ");
  return `知识点：${point.title}（${point.meaning}）。正确答案：${answer}。正确理由：${reason} 选项分析：${analysis} 类似例句：${point.examples[0]}`;
}

const generated = specs.map(([pointId, prompt, values, answer, reason, difficulty, stage], index) => {
  const point = pointById.get(pointId);
  const choices = Object.fromEntries(["A", "B", "C", "D"].map((key, choiceIndex) => [key, values[choiceIndex]]));
  return {
    questionId: `Q-N2-FAC-GRA-${String(index + 1).padStart(4, "0")}`,
    level: "N2", section: "grammar", type: "grammar_choice", subType: `question_factory_${stage}`,
    prompt, choices, correctAnswer: answer, explanation: explanation(point, choices, answer, reason),
    knowledgePointIds: [pointId], knowledgePointTitles: [point.title],
    ...createQuestionMetadata({ knowledgePointId: pointId, generationType: "question_factory", difficulty, now: generatedAt }),
    sourceName: "JLPT N2 AI Learning System Question Factory", tags: ["question_factory", stage, ...point.tags.slice(0, 1)], estimatedTime: 60
  };
});

const approvedIds = new Set(["KP-GRA-AGEKU-001","KP-GRA-IJOUWA-001","KP-GRA-KAGIRI-001","KP-GRA-NAIKOTONIWA-001","KP-GRA-NIMOKAKAWARAZU-001","KP-GRA-NISUGINAI-001","KP-GRA-OSOREGAARU-001","KP-GRA-TEIRAI-001","KP-GRA-BAKARIDA-001","KP-GRA-BAKARINI-001"]);
if (generated.length !== 40) throw new Error(`Expected 40 questions, received ${generated.length}`);
if (generated.some((question) => !approvedIds.has(question.knowledgePointId))) throw new Error("Question outside approved Phase 2 Top 10");
const generatedIds = new Set(generated.map((question) => question.questionId));
const retained = questions.filter((question) => !generatedIds.has(question.questionId));
await Promise.all([
  writeFile(questionsUrl, `${JSON.stringify([...retained, ...generated], null, 2)}\n`),
  writeFile(versionUrl, `${JSON.stringify({ ...version, lastUpdated: generatedAt.toISOString() }, null, 2)}\n`)
]);
console.log(`Sprint 10 Question Factory: ${generated.length} questions generated; bank total ${retained.length + generated.length}.`);
