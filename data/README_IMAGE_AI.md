You are converting LAW EXAM IMAGES into JSON for Lexlab.

TARGET FILE: data/<Main Category>/<Sub Category>.json
Example: data/1. Нийтийн эрх зүй/1.10 Эрүүгийн хуулийн ерөнхий анги.json
I will tell you the exact TARGET FILE at the bottom of this prompt. Folder name = Main category, file name = Sub category — do NOT add "category" or "subCategory" inside JSON (they are derived from the file path). You MUST add "id" for every question (see rule 4).

RULES — FOLLOW STRICTLY OR FILE WILL FAIL:

1. OUTPUT ONLY raw JSON array — no markdown, no ``` fences, no preamble, no postscript, no explanations. First character must be [ and last character must be ].
2. Extract EVERY question visible in the images, in order (top to bottom, page01 to pageN). Do not skip, do not merge, do not invent, do not translate.
3. Keep question and options EXACTLY as in image — Mongolian, preserve punctuation, law numbers (e.g. "Эрүүгийн хууль 11.1"), and case. Strip only the leading label: "1.", "Q:", "Асуулт 1:", "A)", "А.", "a)", "1)" — keep only the text after it. Preserve option order A→E.
4. Each object MUST have:
   - "id": string (STABLE — copy the number printed in the image if visible: "1."→"q001", "15."→"q015", "23)"→"q023" (pad to 3 digits). If no number printed, assign sequentially in reading order: first question "q001", second "q002", etc. Keep ids unique and sorted. NEVER omit, NEVER reuse.)
   - "question": string (full question text, trimmed)
   - "options": string[] (2 to 6 strings, order preserved)
5. "answer": number — FOR THIS BATCH ALL ANSWERS ARE 'D' — set "answer": 3 for EVERY question (D=3, 0-based: A=0, B=1, C=2, D=3, E=4). Do not omit, do not guess other letters. If a question has fewer than 4 options, still use 3 if D exists; if only 3 options exist, use the last index (2) and add a note [???] — but for these images all have 4 options with D correct.
6. Optional only if literally visible in image: "explanation": string, "year": number (e.g. 2026). Do NOT add "category"/"subCategory".
7. Valid JSON only: double quotes, no trailing commas, no single quotes, no comments, UTF-8 without BOM, LF. If an option/question contains a double quote, escape it as \".
8. If multiple images belong to one file, combine into a SINGLE array.
9. Mongolian OCR: preserve Ү Ө Ё correctly (ү≠у, ө≠о). If a word is unreadable keep what is legible and insert [???] inside the string — do not drop the question. For 2-column pages read left column top→bottom then right column.

CORRECT OUTPUT (raw file, no fences):
[
  {
    "id": "q001",
    "question": "Монгол Улсын бүрэн эрхт байдлыг Үндсэн хуульд хэрхэн тунхагласан бэ?",
    "options": [
      "Монгол Улс бол тусгаар тогтносон, ардчилсан, Бүгд найрамдах улс мөн",
      "Монгол Улс бол тусгаар тогтносон, бүрэн эрхт, Бүгд найрамдах улс мөн"
    ],
    "answer": 3,
    "year": 2026
  },
  {
    "id": "q002",
    "question": "Үндсэн хуулийн нэмэлт өөрчлөлтийг батлахад УИХ-ын хэдэн хувийн санал хэрэгтэй вэ?",
    "options": ["50%", "66.6%", "75%", "80%"],
    "answer": 3
  }
]

WRONG (will break JSON.parse):
```json [ ... ]```  <- no fences
Бүх асуултын ...    <- no preamble
{'question': '...'} <- no single quotes

Before returning, verify: array length equals visible question count, each id unique "q001" format, each question non-empty, each options 2-6, EVERY object has "answer": 3 (D). If you forget an id or answer, the file will break discussions/votes and quizzes.

TARGET FILE IS: data/____/____.json  <- replace ____ before sending to AI (or tell AI separately: "Target: data/1. Нийтийн эрх зүй/1.5 Захиргааны хууль.json")
Now process the attached images.
