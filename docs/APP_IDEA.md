# job-match – App Idea

As of: October 12, 2026

job-match accompanies applicants from the job ad to the offer: it analyses the CV once, shows how well they fit a job, keeps every application in view and trains the interview in writing.

## Problem & Target Audience

Applicants read dozens of job ads against their own CV, cannot tell where they really fit and where they have gaps, rarely practise interviews, and lose track once several applications run at the same time.

Demo scenario: a frontend developer in Germany with three years of experience uploads a CV, gets five matching jobs from the pool, sees a match score of 68 with a Kubernetes gap, applies, trains two interviews on that gap and negotiates the salary with the coach.

- **Target audience:** everyone who is actively applying in Germany: career starters, job changers, career switchers
- **Value for applicants:** one place for CV, jobs, match, applications, interview training and a coach who already knows the CV
- **Value for the project:** a learning project for building LLM applications with the Claude API, one topic per stage

## Roles

One role is enough; everything in the app belongs to the account that created it, and a foreign record behaves as if it did not exist.

| Role | Can | Cannot |
| --- | --- | --- |
| Applicant | Upload CVs, see jobs of their role, run matches, manage applications, train interviews, chat with the coach | See or touch another account's data |

Until go-live, accounts are created by a script; registration opens with go-live. Evals, costs and model choice are developer tools on the command line, not an admin role in the app.

## Domain Model

The core of the domain is the chain CV version → analysis (once, stored) → active version with role; every other feature builds on that stored analysis instead of sending the PDF again.

| Entity | Meaning | Key fields | Relationships |
| --- | --- | --- | --- |
| User | Person with a login | email, password_hash | has many CV versions, jobs, applications, conversations, interviews |
| AuthToken | Opaque bearer token | token_hash, expires_at | belongs to a user |
| CvVersion | Uploaded CV with its stored analysis | pdf, file_name, role, is_active, analysis (JSON), analysis_status (`none`, `running`, `ready`, `failed`), tokens | belongs to a user; has many match results; at most one active per user |
| Role | Target role from a fixed list, e.g. "Frontend" | name | value on a CV version, not a table |
| Job | A job ad, from the pool or saved by the user | source (`ba`, `own`), external_id, title, company, city, description, offer_type, salary, url, published_at, raw, embedded_at (when the job was last written to the vector index) | pool jobs belong to nobody; own jobs belong to a user |
| MatchResult | How well the active version fits a job | score 0–100, strengths, gaps, tips, is_archived | belongs to a CV version and a job |
| Application | An application for a job | status (`saved`, `applied`, `interview`, `offer`, `rejected`, `withdrawn`), cv_version_id (nullable) | belongs to a user and a job; has many status changes, notes, documents, appointments |
| StatusChange | One step in the application history | status, changed_at | belongs to an application |
| Note | Free entry on an application | content, created_at | belongs to an application |
| InterviewSession | A written interview training for a job | question_count, difficulty, status, report | belongs to a user and a job; has many turns |
| InterviewTurn | One question, answer and grade | question, answer, score, feedback | belongs to an interview session |
| Conversation | A chat with the coach | title, user_id | has many messages |
| Message | One turn in a chat | role, content (content blocks), model, effort, stop_reason, input_tokens, output_tokens | belongs to a conversation |
| Document | Generated file, e.g. a cover letter | kind, file_id, file_name | belongs to an application |
| Appointment | An interview date | starts_at, calendar_event_id | belongs to an application |

## Use Cases

Sixteen use cases, ordered by stage; after stage 3 (UC-01 to UC-09) the app is already presentable.

| ID | Actor | Use case | Outcome | Stage |
| --- | --- | --- | --- | --- |
| UC-01 | Applicant | Log in and log out | Bearer token; logout revokes it; wrong email and wrong password give the same answer | 1 |
| UC-02 | Applicant | Chat with the career coach | Streamed answer, stop at any time, retry on error, history saved | 1 |
| UC-03 | Applicant | Manage conversations and choose quality and effort | List, rename, delete; Normal/Extended, Low/High sent explicitly | 1 |
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

1. The applicant drops the PDF on the Vue page; the SPA sends it via `fetch` with the bearer token to `POST /api/v1/cvs`.
2. Express checks the token, the size (at most 5 MB) and the type (only PDF) and stores the file as the new active version; the previous version becomes archived.
3. Express sends the PDF to Claude as a `document` block, with a cached system prompt and a JSON schema derived from the Zod schema (Structured Outputs), as a Message Batch to halve the cost.
4. The version shows status "processing"; the SPA polls `GET /api/v1/cvs/{id}` until the batch result is in.
5. Express validates the result against the same Zod schema, trims lists, rejects non-CVs, stores the analysis with its tokens and sets the status to "ready".
6. The SPA shows positions, skills, education, languages, strengths, weaknesses and tips, and suggests a role from the fixed list.
7. The applicant confirms the role or picks another one; from now on jobs, matches and the coach work only with this version and this role.

If the model stops at `max_tokens` or refuses, nothing is stored and the version shows "failed" with a reason; the applicant can retry. From stage 4 on, the coach reads the stored analysis as context in every chat and acts through tools.

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
| Eval | Example suite per prompt unit from the first prompt on; Haiku 5.5 by default, model chosen per unit by measurement; glm-5.3 as independent judge | all AI features |

## Decisions

- **Backend with Express and TypeScript (October 12, 2026).** The backend is Express 5 with TypeScript, Prisma 7 for the database and Zod 4 for request, environment and model-output validation, organised as modules per domain in class style (service, controller, routes, schemas, module); the frontend stays Vue 3 with Tailwind CSS. The repository is built stage by stage from the foundation.
- **Vector search with ChromaDB behind `VectorStore` (October 12, 2026).** PostgreSQL 17 is the only source of truth for all domain data; Chroma is a search index only and stores per job the `id`, the embedding and the filter fields (`role`). Access goes only through the `VectorStore` interface (`upsert`, `search`, `delete`) with a Chroma implementation for the app and an in-memory one for tests. Three sync rules: (1) every write runs through `JobsService`, first Postgres, then `vectors.upsert` or `vectors.delete`, and `upsert` is idempotent; (2) the search tolerates ids that no longer exist in Postgres and filters them out; (3) `Job` carries `embedded_at`, and after every Bundesagentur import a reconciliation re-embeds jobs whose `embedded_at` is empty or older than `updated_at` and deletes ids from Chroma that have no job in Postgres. The Chroma container joins `docker-compose.yml` with stage 7. Open: the embedding provider (the Claude API has no embedding endpoint; candidate: Voyage AI), decided in stage 7.
- **Analyse the CV once and store the result.** Every feature reads the stored analysis; the PDF is never sent again.
- **One active CV version** decides the role; everything runs only with jobs of that role. A new upload, also with the same role, replaces the active version; old versions can be reactivated.
- **Roles come from a fixed list** so they match the job pool. The model suggests one; the applicant confirms.
- **Job pool covers Germany only**, imported from the Bundesagentur in a scheduled run; own jobs can be added.
- **Interview training is written only**, no voice.
- **Haiku 5.5 is the default model**; per prompt unit the cheapest variant above a quality bar set in advance is chosen by measurement. Opus 5.5 never runs in the app. glm-5.3 over z.ai is the judge of the evals and the model of the integration tests.
- **Free with a usage limit per account** during development; the app goes public only after the go-live items are done.

## Out of Scope

job-match stays a focused learning and portfolio project; these points are deliberately not part of the scope.

- No interview training by voice; written only
- No applying on the applicant's behalf and no emails to companies
- No sharing of applicant data with employers or third parties
- No job board for employers; jobs come from external boards or from the applicant
- No job pool outside Germany
- No mobile app; the SPA is responsive
