# Brain Train AI — Modes, Review & Timers Upgrade

Builds on the existing app. PDF upload, extraction, PDF-only generation, Quiz Mode, scoring and results all keep working.

## 1. Review Answers (priority)

Today "Review answers" just re-opens the quiz. It becomes a real read-only review screen listing every question with:

- Full question text
- The student's answer (green if correct, red if wrong), or "Not answered"
- The correct answer, always marked green
- Correct / Wrong badge
- Explanation
- PDF page/section when the generator supplied one

Review uses the answers and correct answers already stored from the quiz session. Nothing is regenerated or re-sent to the AI during review.

To make explanations possible, the generator starts returning a short `explanation` for each question, drawn only from the PDF. Older sessions without explanations simply hide that line.

## 2. Mode picker

After a PDF is read successfully, the home screen shows four cards:

- Study Mode
- Quiz Mode
- Theory Mode
- Timed Exam

Each mode reveals its own settings below the picker, then a single primary action button. All content is generated from the uploaded PDF only.

## 3. Study Mode

Multiple-choice questions, one at a time. The student picks an answer and taps Check Answer; the app immediately reveals correct/wrong, the correct option, the explanation and the PDF source, then Next Question. No score screen — it ends with a short "session complete" card and options to restart or pick another mode.

## 4. Quiz Mode (preserved)

Existing behaviour unchanged: Easy/Medium/Hard, 5/10/20/30 questions, previous/next navigation, scoring, results.

New optional timer: No limit / 10 / 20 / 30 / 45 / 60 minutes. The countdown is derived from a start timestamp saved with the session, so refreshing or backgrounding the phone does not reset it and each student's clock is their own. At zero the quiz auto-submits to results.

## 5. Theory Mode

Written questions generated strictly from the PDF. The student types answers into text areas, with the same optional timer options and auto-submit at zero.

On submission each answer is graded once against the PDF and shown with:

- Score out of 10
- Correct points covered
- Missing points
- Feedback
- Model answer
- PDF source

Grading accepts different wording when the meaning is supported by the PDF.

## 6. Timed Exam

Settings screen: 10/20/30/50 questions, Easy/Medium/Hard, MCQ/Theory/Mixed, 10/20/30/60 minutes, randomize questions on/off, randomize options on/off.

During the exam: timer, question number, progress bar, Previous/Next, answers preserved across navigation, and no answers or explanations revealed. Non-blocking warnings appear at 5 minutes and 1 minute remaining. At zero the exam auto-submits.

## 7. Results

One results screen serving Quiz, Theory and Exam:

- Score, percentage, correct / wrong / unanswered, time used
- Short performance summary
- MCQ review entries: student answer, correct answer, explanation, PDF source
- Theory review entries: student answer, score /10, missing points, feedback, model answer, PDF source
- Buttons: Review Answers, Try Again, New Quiz, New Exam, New PDF (Try Again reuses the same questions; New Quiz/New Exam regenerates from the same PDF; New PDF returns to upload)

## 8. PDF-only rule

Every generation and grading prompt keeps the existing strict instruction set: the uploaded document is the sole source, no outside knowledge or search, fewer questions instead of invented ones, and no invented page references — a source line is only shown when the model cites text actually present in the document.

## 9. Quality and mobile

Prompts ask for non-duplicated questions, plausible distractors, varied correct-answer positions and genuine difficulty separation. All new screens follow the current design tokens and stay single-column, thumb-friendly and safe-area aware on iPhone and Android.

## Technical notes

- `src/lib/quiz.ts` gains a session model covering mode, timer start/limit, MCQ answers, theory answers and grading results, still stored in `sessionStorage` (no database, no auth).
- `src/lib/quiz.functions.ts` gains `explanation` on MCQ output plus two new server functions: theory question generation and theory grading, both on the existing AI Gateway model with the same PDF-only system prompt and Zod validation.
- New routes: `/study`, `/theory`, `/exam`, `/review`; `/quiz` and `/results` are extended rather than replaced.
- Timer logic lives in one shared hook driven by stored `startedAt` + `limitMinutes`, so refresh-safety and auto-submit behave identically in Quiz, Theory and Exam.
- Verification: run the four flows end to end in a mobile-sized browser (Quiz → scoring → review, Study, Theory → grading, Exam → auto-submit → results) and clear any runtime errors before finishing.
