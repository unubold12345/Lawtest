# Data Folder — LawTest Questions

Drop your 4,500 test data files here. The app auto-loads from this folder. No mocks — empty until you upload.

## Rule: filename = category
Each file is one category named after the file (without extension):
- `Эрх зүй.json` → all questions inside show under `Эрх зүй`
- `Гэр бүл.json` → category `Гэр бүл`
- `civil.txt` → category `civil`

You do NOT need a `category` field inside the questions — the filename wins automatically.
Exception: legacy `questions.json` keeps its per-question `category` fields (mixed categories in one file).

## Supported formats (pick one or mix)

### 1) `Эрх зүй.json` — preferred (one file per category)
Array of objects. `id` and `category` are optional — auto-filled from filename if missing.
```json
[
  {
    "id": "q001",
    "question": "What is...?",
    "options": ["A ...", "B ...", "C ...", "D ..."],
    "answer": 0,
    "explanation": "Because ...",
    "lawRef": "Article 12",
    "difficulty": "medium",
    "year": 2024
  }
]
```
Fields:
- `question` string — required
- `options` string[] (2-5 items) — required
- `answer` number (0-based index) or number[] for multiple — required
- `id` string — optional (auto: `<filename>_<n>`, de-duplicated across files)
- `category` — optional (ignored; filename wins, except in `questions.json`)
- `explanation`, `lawRef`, `difficulty`, `year`, `tags` — optional

### 2) `*.txt` — one file per category
Plain text, one question per block separated by `---`. `CATEGORY:` line is ignored — filename wins.
```
Q: What is habeas corpus?
A) Option A
B) Option B
C) Option C
ANSWER: B
EXPLANATION: ...
---
Q: Next question...
```

## Where to put files
- `data/Эрх зүй.json` — new: one file per category (recommended)
- `data/questions.json` — legacy mixed-category file (keeps embedded categories)
- `data/*.json` or `*.txt` — additional splits

## What happens after upload
1. Restart dev server or rebuild — `src/lib/questions.ts` loads via `fs` on server.
2. Home page `/` shows count.
3. `/api/questions` returns merged data.
4. Browse/Quiz filters use the filename categories automatically.

## Validation
If JSON is invalid, build will show exact file + line in console. Keep UTF-8 encoding.
