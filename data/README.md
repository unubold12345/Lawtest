# Data Folder — LawTest Questions

Drop your 4,500 test data files here. The app auto-loads from this folder. No mocks — empty until you upload.

## Supported formats (pick one or mix)

### 1) `questions.json` — preferred
Array of objects. Empty starter file already exists.
```json
[
  {
    "id": "q001",
    "category": "Constitutional Law",
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
- `id` string (unique) — required
- `question` string — required
- `options` string[] (2-5 items) — required
- `answer` number (0-based index) or string[] for multiple — required
- `category`, `explanation`, `lawRef`, `difficulty`, `year` — optional

### 2) `questions.txt` / `*.txt`
Plain text, one question per block separated by `---`:
```
Q: What is habeas corpus?
A) Option A
B) Option B
C) Option C
ANSWER: B
EXPLANATION: ...
CATEGORY: Criminal Law
---
Q: Next question...
```

### 3) `*.json` — any extra JSON files
All `*.json` files in `/data` are merged (except `questions.json` already handles). Useful to split by category: `civil.json`, `criminal.json`.

## Where to put files
- `C:\Users\PC\Desktop\Codes\LawTest\data\questions.json` — main file (created empty)
- `C:\Users\PC\Desktop\Codes\LawTest\data\*.json` or `*.txt` — additional splits

## What happens after upload
1. Restart dev server or rebuild — `src/lib/questions.ts:12` loads via `fs` on server.
2. Home page `/` shows count.
3. `/api/questions` returns merged data.
4. No DB needed for now — file-based for 4,500 rows is instant (<20ms). DB (Prisma/Postgres) added later when you add login/history.

## Validation
If JSON is invalid, build will show exact file + line in console. Keep UTF-8 encoding.
