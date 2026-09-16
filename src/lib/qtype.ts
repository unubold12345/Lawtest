// Heuristic case/knowledge classifier for exam questions.
// Case = scenario with concrete actors/events that tests reasoning.
// Knowledge = direct recall of legal content.
// Pure module: no imports, safe for server use (used only in index building).

const L = "(?<![А-Яа-яЁёӨөҮү0-9])";
const R = "(?![А-Яа-яЁёӨөҮү])";
const Q = "[«»\"'“”‘’]";

const ROLES =
  "(?:иргэн|Иргэн|ажилтан|Ажилтан|захирал|дарга|шүүгч|прокурор|мөрдөгч|байцаагч|албан\\s?хаагч|төлөөлөгч|нотариатч|өмгөөлөгч|гэрч|хохирогч|удирдлага|компани|Компани|байгууллага|нарийн бичгийн дарга|нягтлан|инженер|эмч|сувилагч|оюутан|багш|жолооч|харилцагч|зорчигч|түшмэл|хуульч|Хуульч|сэтгүүлч|судлаач|гишүүн|нөхөр|эхнэр|төлбөр\\s?төлөгч|хөрөнгө\\s?оруулагч|зээлдэгч|зээлдүүлэгч|үйлчлүүлэгч|хэрэглэгч|хөрш|найз|ах|дүү|хүү|охин)";

const actorNamed = new RegExp(L + ROLES + "\\s+" + Q + "?[А-ЯЁӨҮ]{1,2}" + Q + "?(?![А-Яа-яЁёӨөҮү])");
const actorSuffix = new RegExp("(?:^|[\\s(«\"',;:.])[А-ЯЁӨҮ]{1,2}(?:-?\\s?(?:нь|д|г|т|ыг|ийн|ээс|тэй|тай|руу|дэх|гийн|ын|ы)(?![А-Яа-яЁёӨөҮү]))");
const actorStart = new RegExp("(?:^|[\\s(«\"',;:.])[А-ЯЁӨҮ]{1,2}\\s+[а-яөүё]");
const negOne = /(?:^|[.!?]\s+)(?:Нэгэн|нэгэн)\s/;
const letterOrg = new RegExp("(?:" + Q + "\\s?[А-ЯЁӨҮ0-9]{1,4}\\s?" + Q + "|(?<![А-Яа-яЁёӨөҮү])[А-ЯЁӨҮ0-9]{1,4})\\s?(?:ХХК|ХК|ТББ|ОҮИТБС|компани|Компани|нэртэй|гэх|банк)");
const narr = /(?:жээ(?![а-яөүё])|чээ(?![а-яөүё])|(?:сан|сэн|сон|сөн)\s+байна|болов(?![а-яөүё])|болжээ|гэжээ|гэж\s+(?:үзэж|үзэв|үзье|үзэхэд|шийдэв|тогтов|мэдэгдэв|дуулгав|хүсэв|хандсан)|тусгайлан|тэрээр|иймд|үүний\s+дараа|дараа\s+нь|энэхүү\s+(?:үйлдэл|байдал|шийдвэр))/g;
const scenOpen = /^(?:Дараах|Дээрх|Тодорхой)\s+(?:нөхцөл|тохиолдол|баримт|үйлдэл|маргаан|хэрэг|асуудал|зардлын)/;
const askJudge = /(?:шийдвэрлэх вэ|шийдвэрлэхэд|шийдвэр гарга|дүгнэлт (?:хийх|гарга|хийнэ|өгнө|өгөх)|\bүү\?|\bюу\?|болох уу\?|болох вэ\?|болох (?:уу|вэ)(?![а-яөүё])|үндэслэлтэй юу|зөрчих үү|зөрчихгүй юу|хариуцах вэ|тооцох вэ|хүлээн авах вэ|авах вэ\?|хэрэглэх үү|хамаарах уу|хамаарах вэ|эрхтэй юу|эрхгүй юу|эрхтэй вэ|шаардах эрхтэй юу|хэрхэн ажиллах вэ|хүчинтэй юу|хүчингүй юу|хийх үү|хийх уу|заавал уу|зөв юу|болохгүй юу)/;
const alNi = /^(?:Аль|Аль нь|Дараах|Доорх|Хэдэн|Хэд|Хэн|Юу)\b/;
const directAsk = /(?:хамаарахгүй вэ|хамаарах вэ|үл хамаарах|хамаарах бэ|зөв хариулт|тухай хууль|хуулийн .*?(?:заалт|хэм хэмжээ))/;
const multiSentence = /[.!?…]\s+[^.!?…]{10,}[.!?…]/;

export type QType = "case" | "knowledge";

export function classifyQType(question: string): QType {
  const t = (question || "").replace(/\s+/g, " ").trim();
  let score = 0;

  if (actorNamed.test(t)) score += 3;
  if (letterOrg.test(t)) score += 3;

  const actorN = (t.match(new RegExp(actorSuffix.source, "g")) || []).length;
  const actorS = (t.match(new RegExp(actorStart.source, "g")) || []).length;
  const narrN = (t.match(narr) || []).length;

  if (actorN >= 1) score += Math.min(actorN, 3) * 2;
  if (actorS >= 1) score += Math.min(actorS, 2);
  if (narrN >= 2) score += 3;
  else if (narrN === 1) score += 1;
  if (scenOpen.test(t)) score += 3;
  if (t.length > 220) score += 2;
  else if (t.length > 150) score += 1;
  if (askJudge.test(t)) score += 1;
  if (multiSentence.test(t)) score += 1;
  if ((t.match(/\d[\d.,]*/g) || []).length >= 2) score += 1;
  if (negOne.test(t)) score += 1;
  if (alNi.test(t)) score -= 1;
  if (directAsk.test(t)) score -= 1;

  return score >= 4 ? "case" : "knowledge";
}
