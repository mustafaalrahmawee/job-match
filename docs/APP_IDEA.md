# job-match – App Idea

As of: October 15, 2026

job-match accompanies applicants from the job ad to the offer: it analyses the CV once, shows how well they fit a job, keeps every application in view and trains the interview in writing.

## Problem & Target Audience

Applicants read dozens of job ads against their own CV, cannot tell where they really fit and where they have gaps, rarely practise interviews, and lose track once several applications run at the same time.

Demo scenario: a frontend developer in Germany with three years of experience uploads a CV, gets five matching jobs from the pool, sees a match score of 68 with a Kubernetes gap, applies, trains two interviews on that gap and negotiates the salary with the coach.

- **Target audience:** everyone who is actively applying in Germany: career starters, job changers, career switchers
- **Value for applicants:** one place for CV, jobs, match, applications, interview training and a coach who already knows the CV
- **Value for the project:** a learning project for building LLM applications with the Claude API, one topic per stage

## Roles

One role is enough: the applicant. Everything in the app belongs to the account that created it; a record of another account behaves as if it did not exist.

Until go-live, accounts are created by a script; registration opens with go-live. Evals, costs and model choice are developer tools on the command line, not an admin role in the app.

## Domain Model

The core of the domain is the chain CV version → analysis (once, stored) → active version with role; every other feature builds on that stored analysis instead of sending the PDF again. The exact fields live in `backend/prisma/schema.prisma`.

| Entity | Meaning | Key fields | Relationships |
| --- | --- | --- | --- |
| User | Person with a login | email, password | has many CV versions, jobs, applications, conversations, interviews |
| AuthToken | Login token | expires_at | belongs to a user |
| CvVersion | Uploaded CV with its stored analysis | pdf, role, is_active, analysis, analysis_status (`none`, `running`, `ready`, `failed`) | belongs to a user; has many match results; at most one active per user |
| Role | Target role from a fixed list, e.g. "Frontend" | name | value on a CV version, not a table |
| Job | A job ad, from the pool or saved by the user | source (`ba`, `own`), title, company, city, description | pool jobs belong to nobody; own jobs belong to a user |
| MatchResult | How well the active version fits a job | score 0–100, strengths, gaps, tips | belongs to a CV version and a job |
| Application | An application for a job | status (`saved`, `applied`, `interview`, `offer`, `rejected`, `withdrawn`) | belongs to a user and a job; has many status changes, notes, documents, appointments |
| StatusChange | One step in the application history | status, changed_at | belongs to an application |
| Note | Free entry on an application | content | belongs to an application |
| InterviewSession | A written interview training for a job | difficulty, status, report | belongs to a user and a job; has many turns |
| InterviewTurn | One question, answer and grade | question, answer, score, feedback | belongs to an interview session |
| Conversation | A chat with the coach | title | belongs to a user; has many messages |
| Message | One turn in a chat | role, content, model, effort | belongs to a conversation |
| Document | Generated file, e.g. a cover letter | kind, file_name | belongs to an application |
| Appointment | An interview date | starts_at | belongs to an application |

## Use Cases

Sixteen use cases, ordered by stage; after stage 3 (UC-01 to UC-09) the app is already presentable.

Work happens in two phases. **Phase A** builds every use case, stage by stage, without evals: each prompt unit gets a model and an effort from the estimate table in `EVAL_PLAN.md` §5, written as constants. **Phase B** starts once the app is complete and online: one eval per prompt unit, which may change model, effort and prompt. The two suites that already exist (`coach_chat`, `cv_analysis`) wait for phase B.

| ID | Actor | Use case | Outcome | Stage |
| --- | --- | --- | --- | --- |
| UC-01 | Applicant | Log in and log out | Bearer token; logout revokes it; wrong email and wrong password give the same answer | 1 |
| UC-02 | Applicant | Chat with the career coach | Streamed answer, stop at any time, retry on error, history saved | 1 |
| UC-03 | Applicant | Manage conversations and choose quality and effort | List, rename, delete; Normal/Extended, Medium/High sent explicitly | 1 |
| UC-04 | Applicant | Upload a CV as PDF (German or English) | Analysed once; status changes from "processing" to "ready"; role suggested from the fixed list, confirmed or changed | 2 |
| UC-05 | Applicant | Upload a new version, reactivate or delete an old one | New version becomes active, old one is archived; reactivation reuses the stored analysis; deletion removes analysis and match results, keeps applications, chats and trainings | 2 |
| UC-06 | Applicant | Ask the coach about the own CV | Coach knows the analysis of the active version without attachments | 2 |
| UC-07 | System | Import jobs from the Bundesagentur into the pool (no AI) | Only Germany, only the last 30 days, duplicates skipped, offer type stored | 3 |
| UC-08 | Applicant | Save an own job from pasted text or a screenshot | Structured job with title, company, city, text; screenshot is read by the model | 3 |
| UC-09 | Applicant | Run a match analysis for a job | Score 0–100, strengths, gaps, tips, each tied to a concrete statement in CV or ad; stored, archived when the version changes | 3 |
| UC-10 | Applicant | Track applications with status, history and notes | Every status change dated; list stays visible after a role change | 4 |
| UC-11 | Applicant | Let the coach act in the chat | Coach saves a job, sets a status, generates interview questions, researches a company via web search; steps visible in the UI | 4 |
| UC-12 | Applicant | Train an interview in writing | Question, written answer, grade with feedback, next question; final report; pause and resume | 5 |
| UC-13 | Applicant | Run long trainings and chats | No context overflow; stable prefix cached; cost per request visible in the logs | 6 |
| UC-14 | Applicant | Ask for the five best jobs | Vector search in the pool, filtered by role; model explains each pick with a reference to the job | 7 |
| UC-15 | Applicant | Generate a cover letter and put an interview date in the calendar | Word file for the job and the active version; calendar entry via MCP | 8 |
| UC-16 | Applicant | Register, change the password, delete the account, download own data | Public registration; deletion removes everything; usage limit per account | Go-live |

## Core Flow: Analysing the CV

UC-04 is the most important flow; the role, the match, the recommendations, the training and the coach all depend on the stored analysis.

1. The applicant uploads the PDF.
2. The app checks size and type and stores it as the new active version; the previous version is archived.
3. The app sends the PDF to the model for analysis; the version shows "processing".
4. The app validates the answer, rejects non-CVs and stores the analysis; the version shows "ready".
5. The applicant sees positions, skills, education, languages, strengths, weaknesses and tips, and a suggested role from the fixed list.
6. The applicant confirms the role or picks another one; from now on jobs, matches and the coach work only with this version and this role.

If the analysis fails, nothing is stored and the version shows "failed" with a reason; the applicant can retry.

## Coverage of Claude Topics

Every stage introduces one topic; the table shows where each one naturally appears in the project.

| Topic | Where in job-match | Use case |
| --- | --- | --- |
| Messages API, streaming | Coach chat via Server-Sent Events, stop reasons, effort sent explicitly | UC-02, UC-03 |
| Working with files, Structured Outputs | PDF as document block, analysis as validated JSON | UC-04 |
| Message Batches, prompt caching | CV analysis as batch with cached system prompt; stable prefix for long chats | UC-04, UC-13 |
| Vision | Screenshot of a job ad to text | UC-08 |
| Prompting, prompt injection | CV and ad text go into the prompt as marked data, never as instructions; what must hold is checked in code | UC-08, UC-09 |
| Tools, agent loop | Coach tools (save job, set status, generate questions) with own loop and stop conditions; server tool web search | UC-11 |
| Workflow vs. agent | Interview training as fixed flow or agent; decision written down before building | UC-12 |
| Context management | Compaction for long sessions, token counting before sending | UC-13 |
| RAG | Embeddings in ChromaDB behind the `VectorStore` interface, Postgres stays the source of truth, "top 5 jobs" with reasons | UC-14 |
| Agent Skills, Files API, MCP | Cover letter as Word file; calendar via MCP | UC-15 |
| Eval | Phase B: example suite per prompt unit; model and effort first estimated (phase A), then confirmed or changed by measurement; glm-5.3 as independent judge | all AI features |

## Out of Scope

job-match stays a focused learning and portfolio project; these points are deliberately not part of the scope.

- No interview training by voice; written only
- No applying on the applicant's behalf and no emails to companies
- No sharing of applicant data with employers or third parties
- No job board for employers; jobs come from external boards or from the applicant
- No job pool outside Germany
- No mobile app; the SPA is responsive
