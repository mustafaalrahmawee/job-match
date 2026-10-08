# Curated Anchor — Application Evaluation (Offline)

## 1. Source Basis

- Berryman, John & Ziegler, Albert, _Prompt Engineering for LLMs — The Art and Science of Building Large Language Model–Based Applications_ (O'Reilly Media, 2025):
  - **Chapter 10 — Evaluating LLM Applications**, the passages read so far:
    the chapter introduction (evaluation first, offline vs. online), _What Are
    We Even Testing?_ (model, single interaction, interplay; unit vs.
    regression tests), _Offline Evaluation_ — _Example Suites_ (Figure 10-1
    tech tree, Figure 10-2 canned conversations, the model as user mock),
    _Finding Samples_ (existing records, app usage, synthetic samples),
    _Evaluating Solutions_ (gold standard with exact and partial match and
    Figure 10-3, functional testing, LLM assessment), _SOMA Assessment_
    (Example 10-1), grounding the judge in human evaluation, and the summary
    of offline choices.
  - Not yet covered: _Online Evaluation_, the rest of Chapter 10. It is added
    to this anchor once read.
- Read by the author; concepts below are distilled from these passages, not
  summarized from memory. Where Chapter 10 points to another chapter (Ch. 4
  loop, Ch. 6 advice conversation, Ch. 7 logprobs and fluff), only the pointer
  is kept.
- **Not only from the book.** Besides Berryman's concepts, this anchor holds
  additions by the agent (Claude): the generic framing for every AI app, the
  evaluation sheet (§6), the judge prompt skeleton built from Example 10-1
  (§7), the forbidden terms and the usage rule (§8, §9), and these sharpened
  rules — EV-09 (example suite from the first prompt on), EV-19 (write down how
  a proxy source deviates), EV-24 (remove weak synthetic samples), EV-25
  (samples never from the model under test), EV-26 (easiest grading approach
  first), EV-48 (code reads the score line), EV-50 (two to three human graders
  on 10–20 cases, Kendall's Tau per aspect, taken over from the author's
  spec-forge anchor).

## 2. Purpose

This anchor decides **how an LLM application is evaluated offline**: what is
tested, where the samples come from, and how the app's solutions are graded.
It is generic — it holds for every AI app idea, whether a single extraction
call, a chat assistant, a tool-using agent, or a multi-step workflow — and is
reused unchanged in each project; the choices one app has to make are written
into that app's evaluation sheet (§6).

Philosophy: the evaluation comes first and guides all later development,
because with it every change can be checked — a step in the right direction, a
mistake, or a good attempt without much impact.

The anchor binds the **evaluation design**, not a framework or a runner. How a
single prompt is written is bound by `app-prompting-anchor.md`; online
evaluation is not covered yet (§1).

Terms used in the rules:

- **loop** — one run of the app, from the user's input to the app's output (Berryman Ch. 4);
- **pass** — one call to the model inside the loop;
- **maintainer** — the person who builds the app and runs its evaluation;
- **user** — the person who uses the app.

## 3. Accepted Concepts

### 3a. Evaluation First

| #     | Concept                       | Rule for every LLM app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EV-01 | Evaluation is the first code  | The evaluation is started with the app's very first code, not added once the app works. GitHub Copilot's oldest code is its evaluation, written before proxy, prompts, UI, and boilerplate; it is what let the team move fast. Every change — prompt, parameter, model, or architecture — is judged by it: a step in the right direction, a mistake, or a good attempt without much impact.                                                                                                                                                                                                                                  |
| EV-02 | Offline and online evaluation | Which evaluation is available depends on the app and its point in the lifecycle. **Offline evaluation** judges example cases independent of any live run; it needs no real users and often no working end-to-end app, so it is implemented first — but it is somewhat theoretical and possibly disconnected from the real world. **Online evaluation** tests ideas directly on real users once the app is deployed; the stakes are higher (an idea must not ruin the user experience) and it needs enough users for clear feedback, but its data is valid for the use case in a way offline data cannot be. Both are needed. |

### 3b. What Is Tested

| #     | Concept                                 | Rule for every LLM app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EV-03 | Three test objects                      | Evaluation can assess (1) the **model**, (2) the **single interaction** with the model — the prompt of one pass — and (3) the **interplay** of many interactions in the whole app.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| EV-04 | Unit and regression tests               | As in classical software testing: a **regression test** covers the whole interaction (the loop or a large part of it); a **unit test** covers the smallest building block, one pass of the model. For an app with a single model call the distinction hardly matters. For loops with iterated calls, the harness carves out parts of the loop and declares "this is what I'm testing now"; the choice is not free, because some parts are hard to test. Ideal: regression tests that cover as much of the loop's feedforward pass as possible, plus unit tests for every **critical** interaction — hard and important. |
| EV-05 | Latency and tokens always recorded      | Every test records total latency and token consumption. They are rarely the focus, but easy to measure, and any large effect there must be known.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| EV-06 | Test level follows the change           | **Model swap or upgrade** → regression tests over as large a part of the app as possible; per pass instead when models are mixed and matched (e.g. for cost or latency). **Prompt or API parameter** (temperature, completion length) → unit tests on the affected pass, because that is what a prompt change affects directly; strong regression tests may be used as well, but their statistical noise easily drowns effects that are clear at unit level. **Architecture** (the overall shape of the loop) → regression tests, by definition.                                                                        |
| EV-07 | Whole loop first, critical passes added | If one setup must come first, it tests the whole loop (or close to it): testing should mirror reality, and in reality the performance of the whole system is what is optimized. Specific tests for particularly critical passes are added afterwards.                                                                                                                                                                                                                                                                                                                                                                   |

### 3c. Example Suites

| #     | Concept                             | Rule for every LLM app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EV-08 | Start simple                        | Offline suites range widely in complexity; start simple. Version 0 of a prompt is usually tried by hand in an LLM chat or a completion playground on one or two examples. That does not scale; its scalable version is the example suite.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| EV-09 | Example suite: three parts          | Every app gets one from its first prompt: (1) **5 to 20 example inputs** to the app or one of its central steps, spanning the range of scenarios expected in reality; (2) **a script** that applies the app's own prompt-making to each example, asks the model for the completion, and writes both the assembled prompt and the completion as files; (3) **a way to eyeball differences** between such files, e.g. commit them and read the git diffs.                                                                                                                                                                                                                                                                                 |
| EV-10 | Not a test suite                    | An example suite has no automatic verdict: the maintainer goes through the differences and decides whether they are improvements or regressions. That costs more than reading a headline result. The suite may later grow into a test suite.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| EV-11 | What the example suite gives        | (1) It starts the moment the first prompts are codified, before there is any way to assess output. (2) Knowing the examples well, the maintainer sees not only whether a new prompt works but its **typical shortcomings**, and adjusts the prompt against them. Berryman's PR-summary case (tens of pull requests mined from GitHub): too terse → add the word "detailed"; too verbose → limit to one or two paragraphs; wild assumptions about the motives → ask for one paragraph on the functionality and a second on its place in the project goals, and do not surface the second (the fluff trick, Ch. 7). Systematic enough to show the consequences of a change, flexible enough to help before strict quality criteria exist. |
| EV-12 | Limit of the example suite          | It serves directed exploration; its scale is limited by how many examples the maintainer is willing to eyeball after each change. Subtle effects need many hundreds of examples, maybe thousands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| EV-13 | Tech tree to the evaluation harness | Figure 10-1: **idea → playground tinkering → example suite** (unlocked by a skeleton implementation, the first code) **→ evaluation harness** (unlocked by a source of lots of examples **and** an automatic assessment of the app's suggestions). The two problems to solve for the harness: where the example problems come from (§3e), and how the app's solutions are assessed (§3f – §3h).                                                                                                                                                                                                                                                                                                                                         |
| EV-14 | What an example is                  | An example is one particular situation the app might run in. For a simple loop with one model call, one instance of all the context that could go into the prompt is the **example problem**, and what one hopes to get out of it (after processing) is the **example solution**.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### 3d. Conversations and Dependent Calls

When the model is called several times and the calls depend on each other —
most of all in a conversation between user and model — there are two options.

| #     | Concept              | Rule for every LLM app                                                                                                                                                                                                                                                                                                                                      |
| ----- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EV-15 | Canned conversations | Figure 10-2: a whole conversation is written out as a script. For each model turn the model gets the script's prefix up to that turn and answers; the answer is compared with the script; then the test moves on **with the scripted answer**, regardless of what the model said. This judges each pass on its own and gives up evaluating the whole loop.  |
| EV-16 | Model as user mock   | A model plays the user's side of the conversation; the example is a **user profile**, like the instructions in improv theater. This tests the whole loop, at the price of baking in the model's shortfalls — in particular misunderstandings of the domain and prejudices about how users are likely to behave. Not perfect, but often the best one can do. |

### 3e. Finding Samples

| #     | Concept                                | Rule for every LLM app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EV-17 | Three sample sources                   | Samples (a) already exist and only have to be found, (b) are created by the app and collected, or (c) are made up. Each source has advantages and drawbacks; one or several may be combined. The result is lots of samples, with or without gold-standard solutions; running the app on them gives one candidate solution per sample, which is then graded (§3f – §3h).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| EV-18 | Existing records                       | Best case: users have solved the app's problem (or a subproblem) themselves, without AI, thousands of times, and left records — e.g. an AI that prefills the summary field of an online form, where tens of thousands of human-written summaries exist. Critical question: can plenty of them be found?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| EV-19 | Similar records as a stepping stone    | Often only a **similar** problem can be mined. The source must be common enough in real-world corpora to scale and similar enough to the app's problem to allow valid conclusions — a stepping stone between lab and reality. Copilot's real problem ("what will the user want to type next?") has no corpus, but open-source code does: take a repository → one code file → one function, remove the function body as if the user's cursor stood where the implementation goes, and ask what to type next. Known deviations: the distribution is skewed (whole function bodies are longer than typical suggestions), and changes that depend on the body (e.g. imports in the preamble) have already happened — accepted for a near-infinite well of samples. The known deviations of a proxy source are written down next to it. |
| EV-20 | App usage                              | The app creates samples of its own problem as users use it — as realistic as samples get. Drawbacks: data flows only once the first prototype is rolled out; significant app updates can make earlier data obsolete; recording extensive user telemetry needs very high standards of consent, handling, and safeguarding; and it yields great example **problems** (inputs), not necessarily great example **solutions** (outputs) — what the user finally did is heavily influenced by what the app suggested. Critical question: does the data trickle fast enough, given that app changes invalidate old data?                                                                                                                                                                                                                  |
| EV-21 | App usage only without a gold standard | Usage data serves offline evaluation only where no gold-standard solution is needed; otherwise it is left to online evaluation, which avoids some of the data-handling problems and adds advantages of its own.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| EV-22 | Synthetic samples                      | The LLM generates the samples — at scale, not by hand. This works amazingly well where one can start from the **solution** and make up the problem from there, and where no gold standard is needed at all, because generating situations is what LLMs excel at. Critical question: is the maintainer willing to spend the time crafting the synthesis procedure?                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| EV-23 | Hierarchical generation                | (1) **Topics** — proposed by the LLM or given by the maintainer. When problems have several combinable aspects, n options for aspect A × m for B × l for C × k for D give n·m·l·k combinations; this combinatorial explosion yields a large number of topics spread well over a large space. (2) **Several samples per topic in one call** when more samples than topics are needed, provided the context window holds them all — this usually gives more variety than asking repeatedly at temperature > 0.                                                                                                                                                                                                                                                                                                                       |
| EV-24 | Weak synthetic samples are removed     | If the LLM may not fully command the problem space, generated samples can be overly simplistic, exaggerated tropes, built on popular misunderstandings, or simply incorrect. Generated samples are read, and such samples are removed before use.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| EV-25 | Generator ≠ tested model               | The relationship between the LLM that makes up the tests and the LLM that takes them is incestuous: if they are the same, the outcome is biased — when deciding whether to switch from model A to model B, samples made up by A give A a leg up. Synthetic samples are never generated by the model under test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### 3f. Evaluating Solutions — Gold Standard

| #     | Concept                                    | Rule for every LLM app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EV-26 | Three ways to grade, easiest first         | Ordered by difficulty: **gold-standard match** (exact or partial), **functional testing**, **LLM assessment**. The easiest one that works for the app is used.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| EV-27 | Gold standard                              | The easiest way, if it can be managed: an example solution one has confidence in — e.g. from mined records, what the human did without LLM help. If the app's solution can be expressed very simply, this may be all that is ever needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| EV-28 | Yes/no and classification                  | If the app ends in one yes/no answer and gold decisions exist, count how often the app's decision matches — e.g. the first step of a unit-test generator, "Do I even need unit tests for this piece of code?". Binary decisions and multilabel classification are graded by counting; for more statistical power, use logprobs (Ch. 7).                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| EV-29 | Exact match only where answers are short   | For free-form text one can count verbatim matches with the gold standard, but the more freedom and the longer the answer, the rarer exact matches become, even for great models — until the metric is more or less meaningless. Even before that, it raises the question whether correct solutions or solutions in a particular style are being optimized.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| EV-30 | Partial match                              | A partial match picks out one particularly important aspect of the solution and matches only on it — for code, "exact match after deleting all comment lines and removing all whitespace"; for travel suggestions, the destination country, ignoring all other details.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| EV-31 | Choosing the aspect                        | The hard choice: in most apps a catastrophic failure in any aspect can invalidate the whole solution, but some failure modes are more likely, so one guards against those. Figure 10-3: for "I'm a little chilly" with the gold standard `set_room_temp {"temp": 77}`, check that the heating is regulated at all, not that it is set to exactly 77 °F — not reacting through the heating is a real and likely failure, while a heating call usually sets something sensible (0 °F is possible but far less likely).                                                                                                                                                                                                                                                           |
| EV-32 | Two criteria for the aspect                | The aspect (a) separates a **breaking** divergence from the gold standard from a **benign** one — this makes the evaluation meaningful and valid; and (b) is neither too specific (the LLM would have little chance of getting it right) nor too general (the evaluation would mean nothing). Both require playing with the model to see its typical mistake patterns and how bad they are. The circularity — the test is chosen on what the setup is good at now and then guides its development — is accepted: still far better than a weak or misleading aspect.                                                                                                                                                                                                            |
| EV-33 | Critical field of structured output        | If the output is not pure free text, partial matching on the one especially critical field among several is often the right aspect. For tool-heavy apps: is the right tool called, and with the right syntax?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| EV-34 | First decision with a real chance of error | When the model makes several decisions in a row while emitting its tokens, evaluate the first decision that has a real chance of going wrong; later decision points are invalidated by it. Figure 10-3: (1) use any tool at all (`to=functions.`), (2) which tool (`set_room_temp`), (3) which values (`{"temp": 77}`). Breaking outcomes — the suggestion is most likely useless: no tool executed (warm-up tips, an offer to call emergency services), wrong tool (`add_shopping {"item": "chilli"}`, `set_oven_temp`), incorrect syntax (`set_room_temp(77)`), wrong parameter (`{"value": 77}`), parameter out of the expected range (`{"temp": 25}`). Benign — still a substantial chance of a reasonable suggestion: the right call with another value (75, 76, 78, 79). |

### 3g. Evaluating Solutions — Functional Testing

| #     | Concept                       | Rule for every LLM app                                                                                                                                                                                                                                                                                                                                                  |
| ----- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EV-35 | Functional testing            | Without a gold standard, or when it cannot easily be compared with the app's solution, check that things "work" with the completion: it can be parsed; it calls only the functions and tools that are available; the arguments have the right types. In most apps this alone is too weak, but occasionally it goes far.                                                 |
| EV-36 | Checks the domain already has | Copilot's harness simulated re-implementing a function from an open-source repository and checked whether the repository's own unit tests still passed with the suggested code (weaker version: linters agree with the code). Code brings its own functional test; other domains may have no programmatic test at all — then the model itself is the last resort (§3h). |

### 3h. Evaluating Solutions — LLM Assessment

| #     | Concept                             | Rule for every LLM app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EV-37 | Where LLM assessment fits           | Numbers are compared with the gold standard, classifications by string comparison, programs by unit tests; but how friendly and how helpful a text answer is is woolly and hard to pin down. Such assessments are where LLMs shine. That the same model may have produced the answer does not make it a student grading their own essay — if it is done right (EV-39).                                                                                                                                                                                                                                                                                                                                                                           |
| EV-38 | Relative, not absolute              | Even when the judge is asked an absolute question ("Is this correct?"), its result is a priori only a **relative** judgement ("version A is considered right more often than version B"). "The LLM judges the app to be correct in 81 % of cases" carries little meaning on its own.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| EV-39 | Third-party framing                 | The judge must not think it grades its own work. An assessment is an advice conversation (Ch. 6), which works best when the model thinks it grades a **third party**. It gets a bit less accurate when it thinks it grades the user, and much worse when it thinks it grades itself, because it is pulled between conflicting biases: training data with a good chunk of forum discussions, not known for objective self-reflection, and RLHF, which teaches it to fall over itself correcting its output at the slightest expression of user doubt.                                                                                                                                                                                             |
| EV-40 | SOMA assessment                     | **S**pecific questions, **O**rdinal scaled answers, **M**ulti-**a**spect coverage (EV-41 – EV-43).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| EV-41 | Specific questions                  | "Is this right?" is enough only where verifying a solution is much easier than producing it — inventing a limerick on the spot is hard, checking that a poem is one is easy. Mostly a generic question gains little: for the smart home, "Is the completion right?" is hardly easier than producing the completion, and its answer may even be worse than the original, because the question can be read in several ways.                                                                                                                                                                                                                                                                                                                        |
| EV-42 | Ordinal scale with described levels | Under yes/no it is unclear how good an answer must be to be "right": the standard drifts with the model's capriciousness from one answer to the next, or is biased systematically — e.g. answers that try for more accuracy are held to higher standards, or generally OK answers (more than 50 % correct) are accepted while almost perfect answers that are not completely right are rejected. Therefore yes/no is dropped; the judge rates on an ordinal scale, e.g. 1 to 5, with a description or examples for each level — this conveys nuance and makes the measurement consistent.                                                                                                                                                        |
| EV-43 | Multi-aspect coverage               | Asked whether a completion is right, the judge looks sometimes at the temperature, sometimes at whether the assistant should have asked first, sometimes at whether `set_room_temp` was the right function. Instead, the aspects are prepared in advance and each is rated — for the smart home: (1) the completion implemented the action the model intended (right tool, right syntax); (2) the action remedies the user's problem (being chilly); (3) the model is restrained enough not to do anything crazy without asking and assertive enough not to need too much hand-holding. The scores are added up or read for more complex patterns.                                                                                               |
| EV-44 | Question before the example         | The judge is told that it does an assessment and on which aspects **before** it sees the example: the model reads the text only once and cannot backtrack, so it reads the example with the evaluation framework already in mind and focuses on the right aspects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| EV-45 | Intent and execution                | A common choice of aspects: **intent** — did the model aim at the right thing (is turning the heat up to 77 °F really the solution to the user's problem)? — and **execution** — did it carry the intent out correctly (right tools, right tool-calling syntax)?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| EV-46 | Relevance, truth, completeness      | For apps that give advice in a chat: **relevance** — did the advice address the right thing (sights not to miss in Morocco, not "don't miss your flight")? **completeness** — not only the best cafés? **truth** — is the advice correct? The relevance-truth-completeness (RTC) system was developed for scoring GitHub Copilot's chat conversations.                                                                                                                                                                                                                                                                                                                                                                                           |
| EV-47 | Split Goldilocks questions          | A question whether something was "just right" holds two aspects: it was **enough**, and it was **not too much**. Asked separately, they give cleaner results.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| EV-48 | Judge prompt form                   | Example 10-1, one chosen aspect per prompt: say that it is an evaluation of a named system — a third party — on a 1–5 scale; name the aspect and define it; describe every level; show the interaction; ask for a thorough analysis that ends in a fixed line `<Aspect>: X`. The fixed line lets code read the score. Skeleton in §7.                                                                                                                                                                                                                                                                                                                                                                                                            |
| EV-49 | Calibration against human graders   | SOMA works as a guardrail that defines the task so precisely that the model has no choice but to be objective — hopefully; whether the questions, aspects, and level descriptions work or went over the model's head is checked against humans. The model scales and people do not, so the judge is a **replacement for human annotators** and must not be a substantial regression. Comparing one human with the model only shows some disagreement, which is normal — humans disagree too. Therefore several humans answer the same questions, the disagreement within that pool is measured with a standard method such as **Kendall's Tau**, and it must stay stable when the model — queried once, at temperature 0 — is added to the pool. |
| EV-50 | Calibration before decisions        | A judge's scores steer decisions only after calibration (EV-49): at least two human graders, three recommended, on 10–20 cases, Kendall's Tau per aspect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### 3i. Choosing the Offline Setup

| #     | Concept              | Rule for every LLM app                                                                                                                                                                    |
| ----- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EV-51 | One source, one test | Offline evaluation needs a **source for inputs** and a **test for outputs**. Each option below has one critical question; an option whose question cannot be answered yes cannot be used. |

| Source             | Critical question                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Existing records   | Can plenty of them be found?                                                              |
| App usage          | Does the data trickle fast enough, also considering that app changes invalidate old data? |
| Synthetic examples | Is the maintainer willing to spend the time crafting the synthesis procedure?             |

| Test                | Critical question                                                 |
| ------------------- | ----------------------------------------------------------------- |
| Gold-standard match | Is a (complete or partial) match realistic and meaningful?        |
| Functional test     | Can a critical aspect be isolated and assessed automatically?     |
| LLM assessment      | Are good and bad outputs recognizably different (to people, say)? |

## 4. Rejected Concepts (Skip List)

| #     | Concept                                        | Why excluded                                                                                                                                                                         |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RC-01 | Playground tinkering as the evaluation         | Trying one or two examples by hand does not scale and leaves nothing to compare. Replaced by the example suite from the first prompt on (EV-09).                                     |
| RC-02 | Exact match on long free-form output           | Exact matches grow rare with freedom and length until the metric means nothing, and it rewards wording over correctness. Replaced by partial match (EV-30).                          |
| RC-03 | Over-specific or over-general aspects          | An exact value where benign divergence is likely (exactly 77 °F) fails good answers; an aspect that almost anything passes says nothing. Replaced by the two criteria (EV-32).       |
| RC-04 | Gold solutions from app usage                  | What users finally did is shaped by the app's own suggestion. App usage serves offline only where no gold standard is needed (EV-21).                                                |
| RC-05 | Samples made up by the model under test        | Biases the outcome towards that model (EV-25).                                                                                                                                       |
| RC-06 | Variety by repeated calls at temperature > 0   | Several samples per topic in one call usually give more variety (EV-23).                                                                                                             |
| RC-07 | Self-grading                                   | A judge that thinks it grades its own work is pulled between conflicting biases and grades much worse. Replaced by third-party framing (EV-39).                                      |
| RC-08 | Generic "Is this correct?" and yes/no verdicts | Little information, several readings, a drifting or biased standard. Allowed only where verifying is much easier than producing (EV-41); otherwise replaced by SOMA (EV-40 – EV-43). |
| RC-09 | One overall quality question                   | The judge picks a different criterion each time. Replaced by aspects prepared in advance (EV-43).                                                                                    |
| RC-10 | Unsplit Goldilocks questions                   | "Just right" mixes enough and not too much (EV-47).                                                                                                                                  |
| RC-11 | Question after the example                     | The model reads once and cannot backtrack (EV-44).                                                                                                                                   |
| RC-12 | Absolute judge scores read as quality          | "81 % correct" carries little meaning on its own; judge results compare versions (EV-38).                                                                                            |
| RC-13 | Calibration against a single human             | Only shows normal disagreement; calibration needs a pool of human graders (EV-49).                                                                                                   |

## 5. Application Rules (How to apply these concepts to any project)

- **Start the evaluation with the first code.** Every change to a prompt, a
  parameter, the model, or the architecture is judged by it. Offline evaluation
  comes before online evaluation.
- **Start with an example suite.** 5–20 inputs spanning the expected scenarios,
  a script through the app's own prompt-making, prompt and completion as files,
  git diffs read after every change.
- **Cover the whole loop first, then the critical passes.** Regression tests
  over (almost) the whole loop; unit tests for hard and important passes.
- **Pick the test level by the change.** Model → regression tests (per pass
  when mixing models); prompt or parameter → unit tests; architecture →
  regression tests.
- **Record latency and tokens in every test.**
- **Test conversations two ways.** Canned conversations judge single turns; a
  user mock driven by a user profile tests the whole loop.
- **Grow towards a harness.** It needs lots of examples and an automatic
  assessment: pick one source and one test whose critical questions are
  answered yes (EV-51).
- **Keep samples honest.** Never let the model under test invent them; remove
  simplistic, cliché, or wrong ones; write down how a proxy source deviates
  from the real problem.
- **Grade with the easiest approach that works.** Gold standard (a partial
  match on an aspect that separates breaking from benign divergence), then
  functional tests, then an LLM judge.
- **Check the first decision that can really go wrong.** For tool calls: any
  tool, the right tool, the right syntax — before the values.
- **Build the judge with SOMA.** Third-party framing; assessment and aspects
  stated before the example; specific questions; a 1–5 scale with every level
  described; aspects such as intent and execution or RTC; Goldilocks questions
  split; analysis first, a fixed score line last.
- **Read judge scores relatively and calibrate before they decide.** Compare
  versions; add the judge (once, temperature 0) to a pool of human graders;
  Kendall's Tau must stay stable.

## 6. Evaluation Sheet per App

The project-specific choices of one app, copied into that app's docs and
filled in; one sheet per app, or per critical pass.

```markdown
## Evaluation sheet — <app>

- Loop: <single call | several dependent calls | conversation>
- Critical passes (hard and important): <...>
- Example suite: <5–20 inputs, which scenarios> · script: <path> · diff: git
- Sample source: <existing records | app usage | synthetic> — critical question answered yes because <...>
- Known deviations of a proxy source: <...>
- Synthetic samples generated by: <model> (≠ model under test)
- Conversations: <canned scripts | user mock with profiles | none>
- Test: <gold standard: exact | partial on aspect ...> · <functional: checks ...> · <LLM assessment: aspects ...>
- First decision with a real chance of error: <...>
- Judge: third-party framing · aspects: <...> · scale 1–5, every level described · score line `<Aspect>: X`
- Calibration: <graders, cases> · Kendall's Tau per aspect
- Recorded in every test: latency, tokens
```

## 7. Judge Prompt Skeleton

After Example 10-1; one prompt per aspect.

```text
I need your help with evaluating <system, named as a third party>. I'm going to
give you some <interactions | outputs> of that <system>, which you are to grade
on a scale of 1 to 5. Grade each <interaction> for <aspect>: <what the aspect
means>.

Please rate <aspect> on a scale of 1 to 5, where the values mean the following:
1. <...>
2. <...>
3. <...>
4. <...>
5. <...>

The <interaction> was as follows:
<sample>

Please provide a thorough analysis and then conclude your answer with
"<Aspect>: X," where X is your chosen <aspect> rating from 1 to 5.
```

Worked example (Example 10-1): system — a smart home assistant; aspect —
**effectiveness**, whether the assistant's attempted action would have remedied
the user's problem. Levels: 1 — would do nothing to address the problem or
might even make it worse; 2 — might address a small part but leaves the main
part unaddressed; 3 — has a good chance of addressing a substantial part; 4 —
not guaranteed to work completely, but should solve most of the problem; 5 —
will definitely solve the problem completely. Interaction:
`User: I'm a bit chilly.` / `Assistant: to=functions.set_room_temp {"temp": 77}`.
Score line: `Effectiveness: X`.

## 8. Binding Vocabulary

**Use these terms** — the controlled vocabulary of this anchor:

- Evaluation kinds: `offline evaluation`, `online evaluation`, `example suite`, `evaluation harness`, `playground tinkering`, `skeleton implementation`
- Test objects: `model`, `interaction`, `loop`, `pass`, `feedforward pass`, `unit test`, `regression test`, `critical interaction`
- Samples: `example problem`, `example solution`, `candidate solution`, `canned conversation`, `user mock`, `user profile`, `sample source`, `existing records`, `app usage`, `synthetic samples`, `topic`, `combinatorial explosion`
- Grading: `gold standard`, `exact match`, `partial match`, `aspect`, `breaking divergence`, `benign divergence`, `functional test`, `LLM assessment`, `third party`, `SOMA assessment`, `specific question`, `ordinal scale`, `multi-aspect coverage`, `intent and execution`, `relevance`, `truth`, `completeness`, `RTC`, `Goldilocks question`, `logprobs`
- Calibration: `human annotators`, `pool of graders`, `Kendall's Tau`, `temperature 0`
- Measures: `latency`, `token consumption`
- Project terms: `judge`, `calibration`; `maintainer`, `evaluation sheet`, `proxy source`

**Forbidden** — any occurrence in an evaluation definition means it has drifted into excluded scope:

- Self-grading: `grade your own answer`, `self-grading` _(see RC-07)_
- Generic verdicts: `Is this correct?` as the only judge question, `yes/no judge verdict` _(see RC-08, RC-09)_
- Unsplit questions: `just right` as a judge question _(see RC-10)_
- Absolute reading: `absolute judge score` _(see RC-12)_

## 9. Usage Rule

This anchor binds the **evaluation definition of every LLM app**: example
suites and their scripts, the evaluation harness, sample generation, user
mocks, canned conversations, functional checks, judge prompts, and the
calibration against human graders. It does not bind how the app's own prompts
are written (`app-prompting-anchor.md`) and does not cover online evaluation
yet. Nothing from this anchor is loaded into a prompt at run time.

Hard rules for every evaluation definition:

1. The evaluation starts with the first code; every change to a prompt, a
   parameter, the model, or the architecture is judged by it before it is
   kept.
2. Every app has an example suite from its first prompt; the first standing
   harness covers the whole loop, unit tests follow for critical passes; every
   test records latency and tokens.
3. Synthetic samples never come from the model under test.
4. Grading uses the easiest approach that works — gold standard, functional
   test, LLM assessment; a partial match checks the first decision with a real
   chance of error, on an aspect that separates breaking from benign
   divergence.
5. An LLM judge grades a third party with SOMA questions stated before the
   sample; its results are read as relative, and it steers decisions only
   after calibration against a pool of human graders.

---

> **Scope note.** This anchor rests on Berryman & Ziegler **Chapter 10**
> (Evaluating LLM Applications) up to the summary of offline choices.
> Out of scope: online evaluation (added once read), how prompts are written
> (`app-prompting-anchor.md`), and workflow design (Chapter 9).
> Open debt: an example suite shows large effects only; subtle effects need
> hundreds to thousands of samples (EV-12).
