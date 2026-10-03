# Curated Anchor — Application Prompting (User-Interactive AI)

## 1. Source Basis

- Berryman, John & Ziegler, Albert, _Prompt Engineering for LLMs — The Art and Science of Building Large Language Model–Based Applications_ (O'Reilly Media, 2025):
  - **Chapter 4 — The user's problem, the model domain, and the loop**: four
    complexity dimensions (medium, abstraction, context required, statefulness),
    the four conversion criteria incl. the Little Red Riding Hood Principle,
    transforming back to the user domain, the basic feedforward pass
    (retrieval → snippetizing → scoring → assembly), loop complexity (state,
    external context / RAG, reasoning depth, tools), model-choice tradeoffs
    (size, latency, fine-tuning).
  - **Chapter 5 — Content sources, clarification, few-shot, dynamic context**:
    static vs. dynamic content, explicit clarification and its three rules of
    thumb, system-message placement, the three few-shot drawbacks,
    latency / urgency / preparability / comparability, context discovery via
    mind map and via proximity + stability.
  - **Chapter 6 — Prompt anatomy, archetypes, snippets, assembly**:
    introduction / context / refocus / transition, Valley of Meh, sandwich
    technique; advice conversation, analytic report, structured document;
    snippet formatting (modularity, naturalness, brevity, inertness), asides,
    elastic snippets, position / importance / dependency, minimal prompt
    crafter vs. greedy assembly engines.
  - **Chapter 7 — The completion preamble**: structural boilerplate, reasoning
    preamble, fluff — and how each is handled.
  - **Chapter 8 — Tools and reasoning**: tool-definition guidelines, dangerous
    tools and application-layer interception, chain-of-thought, zero-shot
    reasoning cue, ReAct (think–act–observe), plan-and-solve, reflexion,
    branch-solve-merge.
  - **Chapter 9 — LLM workflows**: the conversational-agent sufficiency check,
    task decomposition and interfaces, pipeline / DAG / cyclic topologies,
    batch vs. streaming, task variety (non-LLM tasks, humans, model mix),
    advanced agent-driven workflows and their instability.
  - **Chapter 10 — Evaluation**: what is even being tested, example suites,
    sample sources, gold-standard / functional / LLM assessment, SOMA,
    grounding model judgement in human judgement, A/B testing, metric families.
- Read by the author; concepts below are distilled, not summarised from memory.
- Full derivation: the maintainer's private reading notes (`anchor-sources/prompt-engineering.md`).

## 2. Provenance Legend

- `[K B 4.x]` / `[K B 5.x]` / … = Direct concept from Berryman, the named chapter.
- `[K B → P]` = Berryman concept, sharpened into a Project decision (applies to all my user-facing AI projects).
- `[K B → A]` = Berryman concept, restructured by the Agent for readability.
- `[A]` = Agent / author suggestion (no direct source).
- `[P]` = Pure Project decision.

## 3. Purpose

This anchor decides **how application prompts are written** and binds the
vocabulary for every prompt an app sends to a model at run time in a project
where a human user is in the loop — a chat assistant, a RAG assistant, a
tool-using agent, or a workflow with human checkpoints.

The unit of work is the **prompt unit**: one named, versioned prompt that the
application assembles and sends for **one model call**. A prompt unit declares
five things, and the anchor binds all five:

1. **Frame** — the document type the prompt imitates, named in its first sentence.
2. **Conduct rules** — the static instructions, as positives with reasons.
3. **Context slots** — the dynamic material, each classified and placed.
4. **Output contract** — what the completion looks like and which **surface** consumes it.
5. **Stop** — what makes the call structurally complete.

Philosophy, in three lines: **the prompt conditions, the application enforces**
— anything that must hold is checked in code, never merely requested in prose.
**The document frame carries the persona** — a named document type beats a
second-person role label. **The surface decides the format** — markdown, voice,
a widget or a parsed object is a product decision that reaches back into the
prompt. [K B 4/5/6/8 → P]

Every conduct rule states what to do and why; absolutes are reserved for
machine-checked structure; examples appear only where frame plus prose leave
real ambiguity. "Be helpful" is not a rule; "open with the direct answer and
put the reasoning after it, so the user sees the point first" is. [P]

**Runtime shapes.** Prompt units compose into five shapes, all legitimate:
(1) **single call** — one unit, one answer;
(2) **multi-turn chat** — one system unit plus a managed history;
(3) **retrieval-augmented turn** — a chat unit whose context slots are filled from an index;
(4) **agent loop** — a unit plus tools, iterated think–act–observe until a finish signal;
(5) **workflow** — several units wired by deterministic software, each owning one task.
The anchor binds the unit and the rules for composing units; it does not bind
which framework runs them. [K B 4/8/9 → P]

## 4. Scope Boundary — This Anchor vs. the Role-File Anchor

The sibling anchor (`prompt-engineering-anchor.md` in a spec-forge-style
methodology repo) binds a different artifact. The two do not compete; a project
may use both, for different files.

| Dimension        | Role-file anchor                               | This anchor                                                         |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| Artifact         | A statically authored markdown role file       | A prompt string in product code, assembled at run time              |
| Reader           | An agent or chat model producing a domain spec | A model answering a live user, inside an app                        |
| Author's control | Full — the whole document is written by hand   | Partial — slots are filled by retrieval, history and user input     |
| Archetype        | Structured document only                       | Advice conversation, analytic report or structured document, chosen |
| Persona          | Out of scope, unsupported                      | Carried by the document frame, bound by this anchor                 |
| Runtime layer    | Explicitly out of scope                        | **In scope** — assembly, retrieval, tools, loop, evaluation         |
| Stop             | Section skeleton filled                        | Skeleton filled, schema satisfied, or finish tool called            |
| Lifetime         | Edited by hand, reviewed under anchors         | Versioned, measured, A/B-tested, regularly rewritten                |

What the role-file anchor rejects as "application concern" — retrieval, tool
definitions, loops, conversation state, assembly, evaluation — is precisely
what this anchor accepts, because here the machinery _is_ part of the prompt. [P]

## 5. Accepted Concepts

### 5a. Problem Fit and Framing (Ch. 4)

| #     | Concept                            | Provenance    | Rule for prompt units                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ---------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-01 | Four-dimension complexity profile  | [K B 4 → P]   | Before writing, profile the feature on medium, level of abstraction, context required and statefulness, and record the profile beside the prompt unit. Each dimension answers one authoring question: medium decides the transform-back step, abstraction decides whether reasoning is needed, context decides the retrieval layer, statefulness decides history handling.                                                                                                                      |
| AP-02 | Little Red Riding Hood Principle   | [K B 4]       | The prompt reads like a document type the model has seen many times in training, and stays on that path. Inside a chat API this still applies: the system message is written as a document, and markdown structure is used inside messages because the model knows that shape.                                                                                                                                                                                                                  |
| AP-03 | Document frame over role assertion | [K B 4+6 → P] | The unit opens by naming the document and its parties in the third person — "This is the transcript of a career coaching session; the coach answers the last message" — rather than asserting a role in the second person. The frame delivers persona, scope and turn-taking in one sentence and keeps the model on a trained path; a role label asks the model to infer behaviour from one word. Writing the assistant's voice is the author's privilege (playwriting), not the model's alone. |
| AP-04 | Four-criterion check, per call     | [K B 4 → P]   | Before shipping a unit, confirm: (i) training-data resemblance, (ii) every fact the answer needs is present, (iii) the prompt conditions toward a solution rather than toward more problem statement, (iv) the completion has a natural endpoint. An author check, not a step inside the prompt.                                                                                                                                                                                                |
| AP-05 | Transform-back is part of the unit | [K B 4 → P]   | Each unit names its **surface**: rendered markdown, plain text, speech, a UI widget, a tool call, or a parsed object. The output contract is derived from the surface, because a completion is not a solution until the app turns it into one. "Use markdown" is justified by "the surface renders markdown", never by taste.                                                                                                                                                                   |
| AP-06 | Model, latency and cost as bounds  | [K B 4 → P]   | The unit records its model and its urgency tier; both cap how much context and how much visible reasoning the prompt may ask for. A high-urgency surface cannot afford a long reasoning preamble however much accuracy it would buy, and a cheap small model is the right answer for a narrow task.                                                                                                                                                                                             |

### 5b. Instruction Craft (Ch. 5, Ch. 7)

| #     | Concept                                  | Provenance  | Rule for prompt units                                                                                                                                                                                                                                                                                                                |
| ----- | ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AP-07 | Clarification buys consistency           | [K B 5]     | The purpose of explicit instruction is that like inputs are treated alike across runs. Consistency is what makes the app optimisable, learnable for users, and trustworthy — so each conduct rule is justified by the behaviour it stabilises.                                                                                       |
| AP-08 | Positives, reasons, no absolutes         | [K B 5]     | Every conduct rule says what to do and why, in the form "…, so that …" or "…, because …". Instructive absolutes (always, never) are avoided — they cost robustness and produce inconsistent runs. **Structural** absolutes about machine-checked form (schema fields, section names, the finish tool) are exempt and marked as such. |
| AP-09 | Conduct rules, not Dos-and-Don'ts lists  | [K B 5 → P] | A system prompt carries a small set of load-bearing conduct rules in prose. Long industrial don't-lists are rejected (RP-03): every added line competes for attention with the context that actually decides the answer, and unenforced lines create false confidence.                                                               |
| AP-10 | Static instruction in the system message | [K B 5]     | RLHF-trained models follow the system message best, so the frame, conduct rules and output contract live there, while dynamic material rides in the user turn. No model is perfectly compliant, which is why AP-49 and RP-04 exist.                                                                                                  |
| AP-11 | Answer first, justification after        | [K B 7 → P] | The output contract puts the main answer before any explanation, and pushes disclaimers, background and commentary behind it. Fluff is cheapest to ignore when it sits after the payload — for the parser and for the reader.                                                                                                        |
| AP-12 | Named abstention behaviour               | [K B 4 → P] | The prompt states positively what to do when a needed fact is missing: ask one targeted follow-up, or name the gap and answer around it. The model fills gaps by default; an apology is worth more to the user than a confident invention.                                                                                           |
| AP-13 | Language policy                          | [K B 5 → P] | The unit states which language the answer uses and that it follows the user when they switch, because the answer is read by a person in a specific context and silent language drift breaks the product.                                                                                                                             |
| AP-14 | No secrecy as a security mechanism       | [K B 5 → P] | System prompts are extractable — the Sydney instructions are the public proof. Confidentiality sentences are not a control: anything that must not reach the user stays out of the prompt entirely, and any secret the prompt needs is handled by the app layer.                                                                     |

### 5c. Context Supply and Assembly (Ch. 4–6)

| #     | Concept                               | Provenance  | Rule for prompt units                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-15 | Static vs. dynamic, declared per slot | [K B 5 → P] | The unit declares which prose is hardcoded and which slots are interpolated. The boundary is an architecture decision, not a given: a dislike the app always suppresses is static clarification, the same dislike derived from one user's history is dynamic context.                                                                                                                                                                         |
| AP-16 | Direct / indirect / boilerplate       | [K B 4 → P] | Every slot is classified: **direct** (the user's own input and current app state), **indirect** (retrieved documents, profile data, tool results, earlier turns), **boilerplate** (the glue that joins them into one readable document). Boilerplate is authored, not accidental.                                                                                                                                                             |
| AP-17 | The feedforward pass is named         | [K B 4 → P] | Context reaches the prompt through four explicit steps — retrieve, snippetize, score and prioritise, assemble — and each step is a place in the code. Priorities are integer tiers consumed highest-first; scores order items inside one tier.                                                                                                                                                                                                |
| AP-18 | Brevity and Chekhov's gun             | [K B 5]     | Only context that contributes to this answer is included. Material that is merely related invites hallucination from noise, because the model treats everything present as load-bearing.                                                                                                                                                                                                                                                      |
| AP-19 | Urgency tier and preparability        | [K B 5 → P] | The unit records its urgency — low (no user waiting), medium (seconds, multi-pass retrieval affordable), high (keystroke latency) — and everything stable enough is prepared in advance or speculatively, because latency cannot be recovered at assembly time.                                                                                                                                                                               |
| AP-20 | Context discovery, both directions    | [K B 5 → P] | Needed context is found by mind-mapping what the model would want to know, and separately by listing what the app can actually obtain, ordered by **proximity** (app state, stored data, recordable data, public APIs, user-permissioned systems) and **stability** (constant, slow-changing, ephemeral). Implement the near and stable sources first.                                                                                        |
| AP-21 | Position, importance, dependency      | [K B 6]     | Elements relate in three dimensions: **position** (source order, chronology, correct section), **importance** (instructions and output contract top tier, explanations next, context last), **dependency** (requirements that must precede an element, incompatibilities that exclude it). All three are decided before assembly, not during.                                                                                                 |
| AP-22 | Valley of Meh placement               | [K B 6 → P] | Frame and conduct rules sit at the top; the output contract, the refocus, the live user turn and the highest-scoring snippet sit at the bottom. Bulk and low-score material goes in the early middle, where the model uses it least. Filtering harder is the only real remedy.                                                                                                                                                                |
| AP-23 | Snippet envelope and asides           | [K B 6 → P] | Every injected snippet is wrapped in a marked aside that names source, title and date and ends with an explicit end marker, so the model can tell reference material from instruction and can cite it. Formatting follows four goals: modularity (insertable and removable), naturalness (a comment in code, a sentence in prose, a field in a schema), brevity, inertness (separated by whitespace, with one consistent newline convention). |
| AP-24 | History handling                      | [K B 4 → P] | Multi-turn units declare how history is bounded — truncation of the oldest turns, or summarisation of earlier ones into a standing digest — and the live turn always stays adjacent to the refocus.                                                                                                                                                                                                                                           |
| AP-25 | Retrieval query is generated          | [K B 4 → P] | The raw user utterance is not forwarded to the index. Either a cheap call turns the turn into a precise query, or retrieval is exposed as a tool so the model decides whether and what to search. Long unstructured utterances make poor queries.                                                                                                                                                                                             |
| AP-26 | Grounded answer with citations        | [K B 6 → P] | A retrieval-augmented unit requires the answer to rest on the supplied passages and to name which passage carries which claim, in a form the app can parse (markdown links or snippet ids). Reason: a citation is the only cheap check the app and the user have, and the rule gives AP-12's abstention something concrete to be about.                                                                                                       |
| AP-27 | Elastic snippets                      | [K B 6]     | Where one source can be included at several lengths, the unit declares the versions and assembly asks "which is the largest version that still fits" instead of "does this fit".                                                                                                                                                                                                                                                              |
| AP-28 | Minimal crafter first                 | [K B 6 → P] | The first assembly implementation sorts the elements and fills the budget from the end of the collected material. It ships before any scoring engine, because models handle document suffixes well and recent material dominates chat-shaped apps. Greedy engines arrive only when measurement demands them (RP-08).                                                                                                                          |

### 5d. Turn Anatomy and Output Contract (Ch. 6–7)

| #     | Concept                          | Provenance    | Rule for prompt units                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | -------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-29 | Four-part anatomy and sandwich   | [K B 6 → P]   | Every assembled prompt runs introduction → context → refocus → transition. The introduction sets the frame and focus; the refocus restates the task after the context so attention returns to it; the transition hands the floor to the answer. Introduction and refocus form the sandwich. The focus-opener recurses into each named section.                                          |
| AP-30 | Archetype is chosen, not assumed | [K B 6 → P]   | Three archetypes are admitted and one is chosen per unit: **advice conversation** for the user-facing turn (natural, multi-round, tool-friendly); **analytic report** for internal analysis where a declared scope holds better than a dialogue instruction; **structured document** for anything the app parses. Mixing archetypes inside one unit is avoided.                         |
| AP-31 | Scope as a sentence, not a ban   | [K B 6]       | Exclusions are stated as scope — "this report covers novels, excluding self-help" — rather than as prohibitions in a dialogue, because models respect a declared scope more consistently than a negative instruction.                                                                                                                                                                   |
| AP-32 | Format follows the parser        | [K B 6 → P]   | Parsed units use a format the model knows well and the app can validate: XML or YAML where indentation or long text matters, JSON where the provider enforces schemas. Long free text inside JSON arguments is avoided because escaping failures scale with length; XML-encoded tool arguments tolerate it better.                                                                      |
| AP-33 | Structural stop                  | [K B 4+6 → P] | Completion is defined structurally: the named sections are filled, the schema is satisfied, or the finish tool has been called. The unit states which. API stop parameters and token limits are safety nets, not the mechanism.                                                                                                                                                         |
| AP-34 | Preamble policy, three kinds     | [K B 7 → P]   | Each unit decides what happens before the main answer. **Structural boilerplate** is moved into the prompt rather than generated, because it is cheaper and enforces the format. **Reasoning** is requested where accuracy needs it and then hidden from the surface — a long reasoning preamble is a virtue. **Fluff** is pushed behind the answer (AP-11) and stripped by the parser. |
| AP-35 | Scratchpad section               | [K B 6 → P]   | Where reasoning is wanted but must not reach the user, the output contract names a section for it before the conclusion, and the app displays only the conclusion. The table of contents of the answer is the control surface.                                                                                                                                                          |

### 5e. Few-Shot Examples (Ch. 5)

| #     | Concept                            | Provenance  | Rule for prompt units                                                                                                                                                                                                                                                                     |
| ----- | ---------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-36 | Few-shot as implicit clarification | [K B 5]     | Examples teach format, tone and persona more cheaply than prose, because the model's pull to continue a pattern is stronger than its compliance with a stated rule. Used selectively, not as the primary instruction mechanism.                                                           |
| AP-37 | The three drawbacks                | [K B 5]     | (a) Poor scaling — examples carrying full context crowd out the real context and make similar blocks compete for attention. (b) Anchoring — the model adopts the distribution and surface features of the examples. (c) Spurious patterns — ordering teaches rules nobody intended.       |
| AP-38 | Countermeasures and limits         | [K B 5 → P] | Where context is large, examples demonstrate the **output format only**. Where classes matter, the sample mirrors the real distribution and includes the edge cases the model must not guess at. Examples are shuffled, never "happy path first". Full-deliverable examples are not used. |

### 5f. Reasoning and Agency (Ch. 8)

| #     | Concept                             | Provenance  | Rule for prompt units                                                                                                                                                                                                                                                                                                                                               |
| ----- | ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-39 | Thinking must be written out        | [K B 8]     | The model has no internal monologue; a first token is an intuition and everything after it is rationalisation. Where the task needs deliberation, the prompt asks for the reasoning as text before the answer, and the app hides it (AP-35).                                                                                                                        |
| AP-40 | Chain-of-thought and the cue        | [K B 8]     | Step-by-step reasoning is requested either by examples that think before answering or by the plain cue placed before the answer is demanded. It is used where the task has multiple constraints, not as decoration on simple calls.                                                                                                                                 |
| AP-41 | Plan before solving                 | [K B 8 → P] | For tasks with several interacting constraints, the unit asks for an understanding of the problem and a plan first, then execution of that plan, because planning and solving in one pass degrades both.                                                                                                                                                            |
| AP-42 | Think–act–observe for multi-step    | [K B 8 → P] | Agent loops iterate thought, action and observation until a **finish tool** submits the result. Reasoning stays in the loop even when actions alone would retrieve facts, because it is what decomposes goals, tracks state and recovers from exceptions. The loop carries an attempt budget.                                                                       |
| AP-43 | Deliberation before the first call  | [K B 9 → P] | Where a unit calls tools too eagerly, one pass is made with tool invocation disabled while the tool definitions stay in the request, so the model reasons about which tool to use before it is allowed to use one.                                                                                                                                                  |
| AP-44 | Reflexion where a do-over exists    | [K B 8 → P] | Self-correction is wired as an orchestration loop: run, evaluate the result outside the model (format check, compile, tests, or a judge), and on failure start a new call carrying the requirements, the previous attempt and the analysis. It is used only where the action is repeatable — an irreversible mistake cannot be apologised away.                     |
| AP-45 | Branch-solve-merge for breadth      | [K B 8]     | Where an answer benefits from several perspectives, independent calls are prompted toward _different_ perspectives and a merging call combines them. Variety comes from the prompts, not only from temperature.                                                                                                                                                     |
| AP-46 | Tool definitions are product design | [K B 8 → P] | Tools are few, non-overlapping, and simple; a web API is never pasted in wholesale. Names are self-explanatory and follow the provider's internal convention. Arguments are few and typed, with enums and defaults to condition use; nested-parameter descriptions and most validation keywords may never reach the model, so constraints are also checked in code. |
| AP-47 | Argument hallucination              | [K B 8 → P] | Any argument the app already knows is filled by the app and removed from the definition, because a model shown an empty required field invents a placeholder. Asking the model to check back is a weak second line.                                                                                                                                                 |
| AP-48 | Tool results and errors             | [K B 8 → P] | Results carry what the definition promised and nothing "just in case", since spurious content distracts. Errors are rewritten for the model in the vocabulary of the tool definition and say what to do differently, because an actionable error is a free retry.                                                                                                   |
| AP-49 | Dangerous actions are intercepted   | [K B 8 → P] | Irreversible or costly actions are gated in the **application layer** with explicit user sign-off. The model may freely request them; the prompt never carries the guarantee, because a probabilistic system will eventually do the forbidden thing. This is the sharpest instance of "the prompt conditions, the app enforces".                                    |

### 5g. Workflow Composition (Ch. 9)

| #     | Concept                                | Provenance  | Rule                                                                                                                                                                                                                                                                                              |
| ----- | -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-50 | Conversational-agent sufficiency check | [K B 9 → P] | Before building a workflow, state honestly whether one agent with tools would do. Multi-step work with queues, per-item quality bars and unclear failure attribution is the signal that it would not — a growing system message is a recommendation, not a mechanism.                             |
| AP-51 | Ask whether an LLM is needed           | [K B 9]     | Each task first answers: can classical software, or a small classifier, do this? Models are slower, dearer, non-deterministic and less reliable. Keeping them out of a step is a win, not a failure of ambition.                                                                                  |
| AP-52 | Interface before internals             | [K B 9 → P] | Each task declares its input and output schema and holds them stable; the prompt inside the task is free to change. Downstream tasks consume the declared output only, which is what keeps a failure attributable to one task.                                                                    |
| AP-53 | Topology: pipeline, then DAG           | [K B 9 → P] | Work flows one way. A DAG is the default when a producer feeds several consumers; passing data through an unrelated task to avoid an edge is rejected as false simplicity. Cycles are allowed only when hidden inside a task, with an attempt counter, so the rest of the workflow stays acyclic. |
| AP-54 | Humans and model mix in the workflow   | [K B 9 → P] | Irreversible steps, judgement calls and repeatedly failing reflexion loops have a human in the task. Model choice is per task — small and cheap for light work, large for hard work — not one model for the whole app.                                                                            |
| AP-55 | Autonomy last                          | [K B 9 → P] | A deterministic workflow with models inside tasks ships first. Letting a model route the work, spawn tasks or hold state is a later, measured step, because autonomy trades stability and debuggability for flexibility.                                                                          |

### 5h. Evaluation Hooks (Ch. 10)

| #     | Concept                         | Provenance   | Rule                                                                                                                                                                                                                                                                                                                        |
| ----- | ------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-56 | Example suite from version zero | [K B 10 → P] | A prompt unit ships with 5–20 representative inputs, a script that assembles the prompt and fetches the completion, and committed output files whose diffs are reviewed by hand. It is not a test suite and does not need a quality criterion — it exists so that a prompt change has a visible consequence.                |
| AP-57 | Test the loop, then the units   | [K B 10 → P] | The primary harness covers as much of the feedforward pass as possible, because that is what users experience; unit-level checks are added for the calls judged hard and important. Prompt and parameter changes are judged on unit-level checks, architecture changes on the loop harness.                                 |
| AP-58 | Always log latency and tokens   | [K B 10]     | Every run records total latency and token consumption. They rarely drive a decision, they are nearly free to collect, and a large movement in either is something the project must know about.                                                                                                                              |
| AP-59 | Judge framing                   | [K B 10 → P] | An LLM judge grades a **third party**, never "your own answer", and its verdicts are read as relative comparisons between versions, not as absolute quality. Judgement questions are stated **before** the sample is shown, because the model reads once and cannot look back.                                              |
| AP-60 | SOMA assessment                 | [K B 10 → P] | Judge prompts ask **specific** questions, on an **ordinal** scale whose levels are described, across **multiple aspects** declared in advance — typically intent and execution, with "just right" split into "enough" and "not too much". Scores are anchored against a pool of human raters before they steer development. |
| AP-61 | Online metrics that matter      | [K B 10 → P] | Acceptance and impact metrics come first, direct feedback only where no trustworthy behavioural signal exists, and guardrail metrics (errors, complaints, latency) always. Ambiguous signals such as session length are tracked but never used alone, because the same number can mean satisfaction or surrender.           |

## 6. Rejected Concepts (Skip List)

| #     | Concept                                      | Provenance   | Why excluded                                                                                                                                                                                                                                                                                                  |
| ----- | -------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RP-01 | Role-file / spec-generation authoring        | [P]          | Writing methodology role files that produce domain specs is bound by the sibling anchor (§4). This anchor covers prompts that ship inside an application.                                                                                                                                                     |
| RP-02 | Bare persona priming                         | [K B → P]    | "You are an expert X" as the mechanism for quality is not supported. The document frame (AP-03) plus explicit conduct rules and, where needed, few-shot voice (AP-36) do the same work verifiably. Persona wording is permitted inside a frame; it is not a quality lever this anchor claims.                 |
| RP-03 | Long Dos-and-Don'ts lists                    | [K B 5 → P]  | Industrial prompts do carry them, and the Sydney leak shows what they look like. They contradict brevity (AP-18) and attention placement (AP-22), and the unenforced lines create false confidence. A small set of justified conduct rules replaces them.                                                     |
| RP-04 | Prompt-level safety for irreversible actions | [K B 8 → P]  | "Check with the user before running this" in a tool description is not a control; a probabilistic model will occasionally do the opposite. Gating lives in the application layer (AP-49).                                                                                                                     |
| RP-05 | Prompt confidentiality as security           | [K B 5 → P]  | Instructions to keep the rules secret do not keep them secret. Secrets stay out of the prompt (AP-14).                                                                                                                                                                                                        |
| RP-06 | Inline self-verification as correctness      | [K B 8 → P]  | "Verify your answer before responding" is unreliable in the same way as RP-04. Verification is orchestration: a programmatic check, a separate pass, or a reflexion loop with an external criterion (AP-44).                                                                                                  |
| RP-07 | Completion-model transcript mechanics        | [K B 6 → P]  | Freeform, named-transcript and markerless formats, the inception trick as the standard transition, and API stop sequences as the stop mechanism are legacy for chat-API products. Assistant-voice framing survives as AP-03; prefill, where a provider offers it, is a narrow technique, not the house style. |
| RP-08 | Assembly engines as a starting point         | [K B 6 → P]  | Greedy additive and subtractive engines, knapsack framing and incompatibility solvers are premature before measurement. The minimal crafter (AP-28) ships first; an engine is justified by an example suite showing it is needed.                                                                             |
| RP-09 | Tokenizer golf                               | [K B 6 → P]  | Provider-specific tokenizer quirks are real but are not a quality lever. The project takes only the cheap discipline from them — whitespace between elements, one consistent newline convention (AP-23) — and spends no further effort on token-level merging behaviour.                                      |
| RP-10 | Agent-driven architecture by default         | [K B 9 → P]  | Model-chosen routing, agents of agents, tasks created on the fly, stateful task agents and role-delegation crews are the frontier, not the baseline. They are admitted only after a deterministic workflow exists and is measured (AP-55).                                                                    |
| RP-11 | Framework abstractions as binding vocabulary | [K B 9 → P]  | Chains, group-chat managers, crews, optimiser compilers and similar framework nouns do not define this anchor's terms. A framework may implement a unit or a workflow; it never renames the concepts.                                                                                                         |
| RP-12 | Fine-tuning as a prompt-craft substitute     | [K B 4 → P]  | Fine-tuning is a legitimate project decision for missing knowledge or deviant behaviour, and it is recorded with the model choice (AP-06). It is not a technique this anchor binds, and it is not an answer to an unclear prompt.                                                                             |
| RP-13 | Thumbs and session length as primary signals | [K B 10 → P] | Explicit rating buttons are biased toward frustration and starve of data below high traffic; session length is ambiguous by construction. Both are kept as secondary signals behind acceptance and impact (AP-61).                                                                                            |
| RP-14 | Self-grading judges and incestuous samples   | [K B 10 → P] | A model told it is grading its own output is pulled by conflicting biases; samples generated by the same model that is being compared give that model a home advantage. Judges grade third parties (AP-59), and sample provenance is recorded.                                                                |
| RP-15 | "There are no bad ideas" as a shipping rule  | [K B 5 → P]  | Collecting widely is an early design exercise, not a property of a prompt. By the time a unit exists, every element in it is justified (AP-18).                                                                                                                                                               |

## 7. Application Rules — Authoring Order for One Prompt Unit

Work in this order; each step closes a decision the next step needs.

1. **Profile the problem.** Medium, abstraction, context required, statefulness —
   plus the surface and the urgency tier. Write them above the prompt as a
   comment. [K B 4 → P]
2. **Choose the archetype.** Advice conversation for a user-facing turn,
   analytic report for internal analysis, structured document for parsed
   output. One per unit. [K B 6 → P]
3. **Write the frame sentence.** Name the document type and its parties in the
   third person; let it carry persona, scope and turn-taking. [K B 4+6 → P]
4. **Write the conduct rules.** A handful, each a positive with its reason.
   Include language policy, answer-first ordering, abstention behaviour, and
   the output format justified by the surface. No absolutes except about
   machine-checked structure. [K B 5+7 → P]
5. **Declare the slots.** For each: static or dynamic; direct, indirect or
   boilerplate; where it comes from; how it is bounded. Delete any slot that
   does not change the answer. [K B 4+5 → P]
6. **Place the elements.** Frame and rules at the top; bulk and low-score
   material in the early middle; output contract, refocus, best snippet and
   live turn at the bottom. Respect requirements and incompatibilities. [K B 6 → P]
7. **Write the refocus and the transition.** Restate the task after the
   context, then hand the floor to the answer. [K B 6 → P]
8. **Decide the preamble.** Boilerplate into the prompt; reasoning requested
   and hidden where accuracy needs it; fluff pushed behind the answer. [K B 7 → P]
9. **Define the stop.** Sections filled, schema satisfied, or finish tool
   called — and what the parser extracts. [K B 4+6 → P]
10. **Draw the enforcement line.** List what the prompt merely requests and
    what the app checks: schema validation, citation presence, dangerous-action
    gating, retry budget. Anything that must hold moves to code. [K B 8 → P]
11. **Add examples only if something is still ambiguous.** Format-level,
    shuffled, distribution-aware, never a full deliverable. [K B 5 → P]
12. **Wire the evaluation.** 5–20 inputs, a script, committed outputs, latency
    and token logging — before the prompt is tuned by feel. [K B 10 → P]

## 8. Prompt Unit Skeletons

Entry-level skeletons, one per archetype. They show shape, not content; the
bracketed names are slots. [K B 6 → A]

**Chat system prompt (advice conversation, user-facing surface):**

```
<frame: this is the transcript of a {document type}; {role} answers the last message>

<conduct rules: language policy; answer first, reason after; grounding in the
 user's own data; one targeted follow-up when a fact is missing; output format
 justified by the surface — each with its "so that ...">

<standing context: profile digest, history summary — indirect, bounded>
```

**Retrieval turn (advice conversation plus indirect context):**

```
<frame + conduct rules>                      <-- system message

<passages, each in a marked aside: id, source, date, text, end marker;
 lowest score first, highest score last>     <-- user message, middle

<refocus: the user's question, restated>     <-- user message, bottom
<contract: answer from the passages above, naming the id behind each claim;
 where they do not cover the question, say so>
```

**Agent loop (advice conversation plus tools):**

```
<frame: {role} working on {goal} with the tools listed below>
<conduct rules + the loop's own rule: reason briefly, act, read the result,
 and submit through the finish tool when the goal is met>
<tool definitions: few, non-overlapping, app-known arguments removed>
<budget: attempt limit and what to do when it is reached — enforced in code>
```

**Extraction sub-task (structured document, parsed surface):**

```
<frame: this is a {document type} to be transcribed into {schema name}>
<source document>
<contract: the schema, field by field, with what to do when a field is absent>
```

## 9. Worked Example

The pattern applied, in the app's own language. The original unit from the
career-coaching project — frame first, then positives with reasons:

```ts
export const CHAT_SYSTEM_PROMPT = `Dies ist das Protokoll eines Karriere-Coachings: Eine Person bespricht mit ihrem Coach Lebenslauf, Stellenanzeigen und Vorstellungsgespräche. Der Coach antwortet auf die letzte Nachricht.

Der Coach antwortet auf Deutsch, damit das Gespräch in der Sprache der Bewerbung bleibt, und folgt der Person, wenn sie die Sprache wechselt. Er beginnt mit der direkten Antwort und liefert die Begründung danach, damit der Kern sofort sichtbar ist. Er bezieht sich auf konkrete Angaben der Person, damit seine Hinweise umsetzbar sind. Fehlt eine Angabe, stellt er eine gezielte Rückfrage, damit Empfehlungen auf Fakten statt auf Annahmen beruhen. Er schreibt in kurzen Absätzen oder Listen in Markdown, weil die Oberfläche Markdown darstellt.`;
```

What it already satisfies: AP-02/AP-03 (document frame, third person, no role
assertion), AP-08 (every rule positive and reasoned), AP-11 (answer first),
AP-12 (targeted follow-up instead of invention), AP-13 (language policy),
AP-05 (format justified by the surface), AP-09 (five rules, each load-bearing).

What a unit under this anchor adds: a profile comment (surface, urgency, model),
a declared scope sentence (AP-31) so out-of-domain turns have a defined answer,
named slots for the standing context and their bounds (AP-15/AP-16/AP-24), and
the enforcement line (AP-49, AP-33) for anything the app must guarantee.

```ts
/**
 * Prompt unit: chat turn, career coaching.
 * Surface: rendered markdown in the chat panel. Urgency: medium. Model: {model}.
 * Slots: profileDigest (indirect, standing), historySummary (indirect, bounded
 * to the last {n} turns plus a digest), userTurn (direct, live).
 * Stop: one coach reply. Enforced in code: markdown sanitising, history bound.
 */
export const CHAT_SYSTEM_PROMPT = `Dies ist das Protokoll eines Karriere-Coachings: Eine Person bespricht mit ihrem Coach Lebenslauf, Stellenanzeigen und Vorstellungsgespräche. Der Coach antwortet auf die letzte Nachricht. Das Coaching behandelt Bewerbungsunterlagen, Stellensuche und Gesprächsvorbereitung; bei anderen Anliegen nennt der Coach kurz die Grenze und bietet den passenden nächsten Schritt an.

Der Coach antwortet auf Deutsch, damit das Gespräch in der Sprache der Bewerbung bleibt, und folgt der Person, wenn sie die Sprache wechselt. Er beginnt mit der direkten Antwort und liefert die Begründung danach, damit der Kern sofort sichtbar ist. Er bezieht sich auf konkrete Angaben der Person, damit seine Hinweise umsetzbar sind. Fehlt eine Angabe, stellt er eine gezielte Rückfrage, damit Empfehlungen auf Fakten statt auf Annahmen beruhen. Er schreibt in kurzen Absätzen oder Listen in Markdown, weil die Oberfläche Markdown darstellt.`;
```

The lesson the example carries: the frame does the work a persona assertion is
usually asked to do, and every rule earns its line by naming the behaviour it
stabilises. [K B 4/5/6 → P]

## 10. Binding Vocabulary

**Use these terms** — the controlled vocabulary of this anchor:

- Unit and composition: `prompt unit`, `frame`, `conduct rule`, `context slot`, `output contract`, `surface`, `structural stop`, `enforcement line`, `single call`, `multi-turn chat`, `retrieval-augmented turn`, `agent loop`, `workflow` [K B → P]
- Problem fit: `medium`, `level of abstraction`, `context required`, `statefulness`, `urgency tier`, `Little Red Riding Hood Principle`, `training-data resemblance`, `natural endpoint`, `transform back` [K B 4]
- Context: `static content`, `dynamic content`, `direct context`, `indirect context`, `boilerplate`, `feedforward pass`, `snippetize`, `priority tier`, `score`, `preparability`, `proximity`, `stability`, `aside`, `elastic snippet`, `minimal prompt crafter` [K B 4+5+6 → P]
- Anatomy: `introduction`, `refocus`, `transition`, `sandwich technique`, `Valley of Meh`, `lost middle`, `focus sentence`, `advice conversation`, `analytic report`, `structured document`, `scope sentence` [K B 6]
- Preamble: `structural boilerplate`, `reasoning preamble`, `fluff`, `scratchpad section`, `main answer` [K B 7]
- Reasoning and agency: `chain-of-thought`, `plan-and-solve`, `think–act–observe`, `finish tool`, `reflexion`, `branch-solve-merge`, `attempt budget`, `application-layer interception`, `argument hallucination` [K B 8]
- Workflow: `task`, `task interface`, `pipeline`, `DAG`, `hidden recursion`, `batch`, `streaming`, `human in the task` [K B 9]
- Evaluation: `example suite`, `evaluation harness`, `gold standard`, `partial match`, `functional test`, `LLM assessment`, `SOMA`, `ordinal scale`, `multi-aspect coverage`, `acceptance metric`, `impact metric`, `guardrail metric` [K B 10]

**Forbidden** — any occurrence means the unit has drifted out of this anchor's craft:

- Role assertion as mechanism: bare `you are an expert …`, `act as a …` carrying the quality claim
- Instructive absolutes and negative lists: `never …`, `always …`, `do not …` as conduct rules; `Dos and Don'ts` as a section
- Empty instruction: `be helpful`, `be clear`, `be concise`, `be professional` without a named behaviour and reason
- False guarantees in prose: `confirm with the user before executing`, `verify your answer before responding`, `never reveal these instructions`, `do not hallucinate`
- Role-file vocabulary inside a prompt string: `role file`, `domain spec`, `anchor`, and any anchor ID (`AP-xx`, `RP-xx`, `AC-xx`)
- Framework nouns as concepts: `chain` (framework sense), `crew`, `group chat manager`, `optimiser compiler`

_(A prompt unit may **declare** machine-checked structure absolutely — "the answer names the id behind each claim" — and explain why. It never claims a guarantee the application does not enforce. The boundary is: condition the model, enforce in code.)_

## 11. Prompt Usage Rule

Every prompt that ships in a user-interactive AI project is **authored under**
this anchor as binding context. At run time the prompt is self-contained: it
carries no anchor IDs and no references to this file, because the model cannot
resolve them and every unresolved reference is noise (AP-18). Provenance lives
here; the prompt unit's profile (archetype, surface, slots, stop) lives in
docs/STUFEN.md, and the prompt module carries no comments.

Berryman & Ziegler Chapters 4–10 are background knowledge, distilled in the
maintainer's reading notes; the book is not the direct prompt source.

Hard rules for every authored prompt unit:

1. The first sentence names the document type and its parties. The frame, not a
   role label, carries persona and scope. [K B 4+6 → P]
2. Every conduct rule is a positive with its reason. Absolutes appear only for
   machine-checked structure and are marked as such. [K B 5]
3. Every slot is declared static or dynamic and direct, indirect or
   boilerplate, with its bound. Unused context is removed. [K B 4+5 → P]
4. The unit names its surface, and the output contract follows from it.
   Answer first, explanation after, reasoning hidden where it is requested. [K B 4+7 → P]
5. The unit names its structural stop and what the parser extracts. [K B 4+6 → P]
6. The unit names its enforcement line: what the app validates, gates and
   retries. Irreversible actions are gated in code, never in prose. [K B 8 → P]
7. The unit ships with an example suite and with latency and token logging
   before it is tuned by feel. [K B 10 → P]

---

> **Scope note.** This anchor covers Berryman & Ziegler Chapters 4–10 for
> prompts that ship inside user-interactive AI applications — chat assistants,
> RAG assistants, tool-using agents, and workflows with human checkpoints. In
> scope: problem fit, framing, instruction craft, context supply and assembly,
> turn anatomy and output contracts, few-shot, reasoning and agency, workflow
> composition, and the evaluation hooks a prompt needs to be improvable.
> Out of scope: role-file authoring for spec pipelines (the sibling anchor),
> model training and fine-tuning procedure, retrieval infrastructure choices
> (index, embedding provider, reranking) as opposed to how retrieved material
> enters a prompt, framework selection, and autonomy patterns beyond a
> measured deterministic workflow. The anchor binds the **writing** of prompt
> units and the contract between a unit and the application around it; it does
> not choose the stack that runs them.
