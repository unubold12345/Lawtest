# Data Folder — Lexlab Questions

Drop your 4,500 test data files here. The app auto-loads from `data/` recursively.

> **Vision AI (images → JSON)?** This file IS the prompt: [`data/README_IMAGE_AI.md`](./README_IMAGE_AI.md) — attach it + your images to ChatGPT/Claude/Gemini. Set TARGET FILE at the bottom before sending.



---

## 🤖 COPY-PASTE THIS TO YOUR IMAGE-TO-JSON AI

> **Use this prompt when you give images to ChatGPT / Claude / Gemini:**

```
You are converting LAW EXAM images into JSON for Lexlab.

RULES — FOLLOW STRICTLY OR FILE WILL FAIL:

1. OUTPUT ONLY raw JSON array — no markdown, no ```json fences, no explanations before/after. First char must be [ and last char must be ].
2. Extract EVERY question visible in the images, in order. Do not skip, do not merge.
3. Language: keep question and options EXACTLY as in image (Mongolian, preserve punctuation). Do not translate, do not summarize.
4. Each object MUST have:
   - "question": string (full question text, no "Q:" prefix, trim whitespace)
   - "options": string[] (2-6 strings, exactly as shown, strip leading "A) ", "B) ", "1.", etc — keep only option text)
   - "answer": number (0-based index of correct option: A=0, B=1, C=2, D=3, E=4). If image shows correct answer, use it. If NOT shown/unclear, OMIT the field entirely — do not guess.
5. Optional fields — include only if visible / useful:
   - "id": string — if image has numbers like "1.", use "q001", "q002"... else omit (auto-generated)
   - "explanation": string
   - "year": number (e.g. 2026)
6. Do NOT add "category" or "subCategory" — they come from folder/file name.
7. Valid JSON only: double quotes, no trailing commas, no comments, UTF-8 without BOM.
8. If multiple images = one file, combine into single array.

CORRECT OUTPUT EXAMPLE:
[
  {
    "question": "Монгол Улсын бүрэн эрхт байдлыг Үндсэн хуульд хэрхэн тунхагласан бэ?",
    "options": [
      "Монгол Улс бол тусгаар тогтносон, ардчилсан, Бүгд найрамдах улс мөн",
      "Монгол Улс бол ард түмний засаглалтай, бүрэн эрхт Бүгд найрамдах улс мөн",
      "Монгол Улс бол нэгдмэл, тусгаар тогтносон, Бүгд найрамдах улс мөн",
      "Монгол Улс бол тусгаар тогтносон, бүрэн эрхт, Бүгд найрамдах улс мөн"
    ],
    "answer": 3,
    "year": 2026
  }
]

WRONG (will break):
```json
[ ... ]```  <- no fences!
Бүх асуултын хариулт... <- no preamble!
{'question': '...'} <- single quotes invalid!
```

After you generate, tell user to save as: data/<Main Category>/<Sub Category>.json  (UTF-8, no BOM)
```

---

## Rule: folder = main category, file = subcategory

The loader at `src/lib/questions.ts:51` `walkDataFiles` derives categories from paths:

- `data/Иргэний эрх зүй/Гэрээ.json` -> `category="Иргэний эрх зүй"`, `subCategory="Гэрээ"`
- `data/1. Нийтийн эрх зүй/1.1 Монгол Улсын Үндсэн Хууль.json` -> `category="1. Нийтийн эрх зүй"`, `subCategory="1.1 Монгол Улсын Үндсэн Хууль"`
- `data/Гэр бүлийн эрх зүй/Ерөнхий.json` -> `category="Гэр бүлийн эрх зүй"`, `subCategory="Ерөнхий"`

You do NOT need `category`/`subCategory` inside JSON — folder/file names win. They are ignored if present.

Exceptions:
- Flat `data/*.json` (e.g. `Гэр бүл.json`) -> `category` from filename.
- `data/questions.json` legacy -> keeps embedded `category`.

## Supported formats

### 1) `<Main>/<Sub>.json` — preferred
Array of objects. `id`, `category`, `subCategory` auto-filled if missing.

```json
[
  {
    "id": "q001",
    "question": "Аль нь Монгол Улсын Үндсэн хуульд заасан төрийн үйл ажиллагааны үндсэн зарчимд хамаарахгүй вэ?",
    "options": ["Ардчилсан ёс", "Шударга ёс", "Тэгш байдал", "Ил тод байх"],
    "answer": 3,
    "explanation": "Үндсэн хуулийн ...",
    "year": 2026
  }
]
```

Fields:
- `question` string — required
- `options` string[] (2-6) — required
- `answer` number (0-based) or number[] — required if known, optional if you want crowd-verification (omit -> users vote in Browse)
- `id` string — optional (auto: `<sub>_<n>`, de-duplicated)
- `category`/`subCategory` — optional (ignored when folder/file provides it)
- `explanation`, `lawRef`, `difficulty`, `year`, `tags` — optional

### 2) `*.txt` — one block per question, separated by `---`
```
Q: What is habeas corpus?
A) Option A
B) Option B
C) Option C
ANSWER: B
EXPLANATION: ...
---
```

## Where to put files
- `data/<Main>/<Sub>.json` — recommended (creates new Main card on home `/`)
- `data/<Main>/<Sub>.txt` — also supported
- `data/Эрх зүй.json` — flat compat
- `data/questions.json` — legacy mixed

Naming tips:
- Use exact Mongolian for folder/file (e.g. `1. Нийтийн эрх зүй`, not `1. Niitiin`).
- Keep `.json` lowercase, UTF-8 without BOM, no markdown fences.

## After upload
1. Save file as UTF-8 (no BOM). No text before `[`.
2. Run `npm run build` or restart dev — loader `src/lib/questions.ts:67` `loadQuestions()` validates.
3. Check: Home `/` total + category cards, `/browse` filters `Бүх үндсэн/Бүх дэд`, `/quiz` main/sub selects, `/api/questions`.

## Validation & common failures
- `Unexpected token 'Б'` -> file has preamble text before `[` (remove everything before first `[` and after last `]`).
- `Unexpected token '`'` -> file wrapped in ```json fences (remove fences).
- `Invalid JSON shape` -> missing `question` or `options` not an array.
- Mojibake `Ð'Ñ…` -> file saved as ANSI/Latin1 instead of UTF-8 (re-save as UTF-8).
- Questions not showing: `npm run build` loads via `src/lib/questions.ts:84` `.replace(/^\uFEFF/,"")` — but preamble or BOM still breaks `JSON.parse`.
- Verify locally: `npx tsx -e "import{loadQuestions} from './src/lib/questions.ts'; console.log(loadQuestions())"`
