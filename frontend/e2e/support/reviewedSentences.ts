// The reviewed list for the fail-closed promise scan (R2/R1, 13 Oct). Every sentence in a shipped file (src/ non-spec, public/) that mentions training, tuning,
// scoring or improving a model must be listed here, EXACTLY as the scan splits it, with the reason it is not a statement about what happens to a submission.
// Every entry is a sentence the app already ships; adding one here is a copy decision for R1. A stale entry fails the scan.
export const REVIEWED: Readonly<Record<string, { reason: string; sentences: readonly string[] }>> = {
  "public/films/nyayasiddhi-firm-narrated/captions.vtt": {
    reason: "the R1-confirmed bridge caption of the narrated firm cut (the voice-review preview, bf_emma voice; captions sha256 f9e50fa65f20..., to be confirmed by R1 by hash; the scan reads the cue number and times with it): the organisers' own models; not a statement about submissions. Lapses with a new bridge text or hash",
    sentences: [
      "15 00:00:53.157 --> 00:00:59.050 Prabh\u0101sa-Ny\u0101ya is the set of models we trained ourselves, and they work quietly inside it.",
    ],
  },
  "src/lib/howItWasBuiltData.ts": {
    reason: "R1's worded data note for How it was built (17 Oct, v1b sha12 5885ee683fec): they describe which data sets were used for training, held-out and evaluation and which are not published; none promises anything about what happens to a submission.",
    sentences: [
      "Real-text training material, our evaluation sets, and the items in NyayaSiddhi.",
      "Training and held-out sets for our judges",
      "The sealed evaluation sets stay private so a future test cannot be learned in advance.",
      "Judgments were assigned to training, held-out or evaluation by a fixed rule on identity, and checked for overlap by identity and by text.",
      "prabhasa-nyaya-7b-sft: a full fine-tune of Qwen2.5-7B, licence listed as \\",
      "the card names part of its training data as derived from CaseHOLD.",
      "The training sets: not on Hugging Face.",
      "The sealed and held-out evaluation sets: private so a future test cannot be learned in advance.",
      "You cannot rebuild our training sets or our labels from what we publish.",
      "Overlap between training and evaluation was checked by identity and by text.",
    ],
  },
  "src/lib/nyayasiddhiSubmit.ts": {
    reason: "R1's final submission-page strings (17 Oct, file sha12 004302f6a67a): they say that training on public items is declared by the submitter and not checked by the organisers, and name the template field; they promise nothing about what happens to a submission.",
    sentences: [
      "Training on public items is declared by you and not checked by us.",
      "Trained on public items?",
    ],
  },
  "src/data/nyayasiddhi/rows.json": {
    reason: "R1's About-this-run lines of the reference arms (15 Oct), copied by the data build from the signed manifests: they say that the organisers did not train or tune the model they ran, and what its vendor trained it on is not known to us; none is a statement about what happens to a submission",
    sentences: [
      "trained_on_public_items is false because we did not train or tune this model;",
      "what its vendor trained it on is not known to us.",
      "public court texts may be in its pretraining;",
      "not checked: public open-weight model used as released, no training by us;",
    ],
  },
  "public/demo.json": {
    reason: "recorded Studio demo data: research-ledger names, recipe titles and model-training settings; none is a statement about what happens to a submission",
    sentences: [
      "pretrained=/models/hub/models--Qwen--Qwen3-0.6B/snapshots/c1899de289a04d12100db370d81485cdf75e47ca/,dtype=bfloat16,trust_remote_code=False",
      "pretrained=/models/hub/models--Qwen--Qwen3-0.6B/snapshots/c1899de289a04d12100db370d81485cdf75e47ca/,dtype=bfloat16,trust_remote_code=False,peft=/adapter",
      "pretrained=/models/hub/models--Qwen--Qwen3-1.7B/snapshots/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e/,dtype=bfloat16,trust_remote_code=False",
      "evaluation",
      "Scored by lm-evaluation-harness outside the kernel, on the held-out test split, and admitted to the ledger by file hash.",
      "rl-post-training",
      "if it does not, no framework's ergonomics will help, and this engine will have learned that for the price of a few nights rather than a rewrite.\\nThe likeliest outcome, stated in advance so its arrival is informative rather than disappointing: coordination costs tokens and adds failure modes, and on problems a single agent already solves it will lose.",
      "evaluate",
      "baseline-evaluation",
      "evaluation_sample_count",
      "Check the harness obeys the intent's constraints and validate outputs with independent task checks.",
      "candidate-evaluation",
      "Review source provenance, domain coverage, deduplication and separation from held-out evaluation.",
      "finetune",
      "finetune_candidate",
      "training_steps",
      "Audit the reward against the intent and compare held-out results independently of the training reward.",
      "Curate, filter and deduplicate a raw corpus into training shards.",
      "Author and modify AutoModel training and evaluation recipes, including LoRA adapters.",
      "Supervised fine-tuning and LoRA",
      "distributed-training",
      "nemo-automodel-distributed-training",
      "Scale a fine-tune across devices and nodes.",
      "Distributed training",
      "Bring an unsupported architecture into the training stack.",
      "pretrain",
      "megatron-pretrain",
      "nemo-mbridge-mlm-bridge-training",
      "Large-scale pretraining through the Megatron bridge.",
      "Megatron bridge pretraining",
      "memory-tuning",
      "nemo-mbridge-perf-memory-tuning",
      "Fit a training run into the memory a single card actually has.",
      "Memory tuning and activation recompute",
      "Reinforcement learning post-training",
      "nemo-evaluator-plugin",
      "NVIDIA NeMo Evaluator",
      "Benchmark evaluation",
      "Constrain what a sandboxed agent may do.",
    ],
  },
  "src/app/install/page.tsx": {
    reason: "a hardware requirement for users who train their own models",
    sentences: [
      "> <p>For training, use an NVIDIA GPU with at least 8 GB of GPU memory.",
    ],
  },
  "src/lib/howItWasBuilt.ts": {
    reason: "the explorer's signed #914 \"How it was built\" text (R1 sign, R2 confirmed, v5): how the models were built; no statement about what happens to a submission",
    sentences: [
      "We trained the Prabhāsa-Nyāya models behind Pravrudhi-Nyaya on real court text, alongside constructed cases.",
      "Rows went to training, to held-out checks, or to evaluation by a fixed rule, and the sealed and registered evaluation sets were checked against training data by identity and text;",
      "where a document-level overlap was found, we removed the affected evaluation rows and disclosed it.",
      "the real-text part of the training material is traceable to a public source;",
      "removed repeated copies of the same judgment, tolerated scanning noise and spacing differences when matching quotes, and checked rows against our evaluation and sealed lists for overlap.",
      "a result that looks good is not a result that merely re-reads its own training text.",
      "The quality gate, and what we learned about it",
      "Training, held-out and evaluation",
      "sealed and registered evaluation sets were checked against training data by identity and text;",
      "where a document-level overlap was found (in the earlier v5.x model line), we removed the affected evaluation rows and disclosed it;",
      "no evaluation judgment is also a training judgment (identity check);",
      "the next judge version was trained and evaluated under its registered rules;",
      "that more training would help;",
      "we paused further judge training for the current release.",
      "In a small continued-pre-training test, extra legal text did not improve held-out legal text prediction over a control, so we changed approach rather than scale it.",
    ],
  },
  "src/app/matters/page.tsx": {
    reason: "says which contracts have no model coverage yet (the models' own coverage), and the reason-code name for it",
    sentences: [
      "// A contract's judge is ABSTAIN with a reason containing this token when no judge has been trained on its // statute text yet (Lead-2, 2026-09-24: 12 of the 26 registry contracts are in this state today — bns316/ // 318/217/80/108, bnss187, ni138 among them).",
      "no_training_statute_text",
    ],
  },
  "src/app/objectives/page.tsx": {
    reason: "Studio page label about recipes for training and scoring models; not about submissions",
    sentences: [
      "> Published training and evaluation recipes.",
    ],
  },
  "src/app/progress/page.tsx": {
    reason: "Studio empty-state line about external benchmark scoring",
    sentences: [
      ">No external evaluations recorded yet.</p> ) : ( <div className=",
    ],
  },
  "src/components/run/CandidatePanel.tsx": {
    reason: "Studio run-panel empty state about candidate attempts",
    sentences: [
      ">No attempt has been evaluated yet.</p> )",
    ],
  },
  "src/components/run/Timeline.tsx": {
    reason: "Studio timeline status name",
    sentences: [
      "evaluated$",
    ],
  },
  "src/lib/api.ts": {
    reason: "type-field names and a comment about element status codes and a capability flag",
    sentences: [
      "can_train: boolean;",
      "not_evaluated_second_unavailable",
      "not_evaluated_gate1_unavailable",
      "Left as `string` because the engine is a separate release train and // may send a value this build predates -- lib/elementStatus.ts turns it into a presentation and fails closed // on anything it does not recognise, rather than reading an unknown status as a negative finding.",
    ],
  },
  "src/lib/demo/liveCheck.ts": {
    reason: "engine reason-code name",
    sentences: [
      "no_training_statute_text",
    ],
  },
  "src/lib/demo/screeningMatter.ts": {
    reason: "a comment about which dataset files hold a demo matter",
    sentences: [
      "no train/eval/dev/bank file holds it",
    ],
  },
  "src/lib/dataHandling.ts": {
    reason: "R1's Data handling sentence about Anthropic's published commercial terms (14 Oct): a statement about a provider's terms, not a promise about what the app does with a submission; it is the one sentence the promise scan exempts",
    sentences: ["Anthropic's commercial terms say it may not train models on customer content from its services."],
  },
  "src/lib/demo.ts": {
    reason: "capability flags of the recorded demo machine profile",
    sentences: [
      ", can_train: true, can_serve_open_models: true, usable_model_gb: 31.8,",
      ", can_train: false, can_serve_open_models: true, usable_model_gb: 17.8,",
    ],
  },
  "src/lib/elementStatus.ts": {
    reason: "status codes and explanations for elements the checker did not evaluate: they describe a verdict, not submission handling",
    sentences: [
      "// not_evaluated_second_unavailable the second judge did not answer at all, so nothing was concluded either // way.",
      "// not_evaluated_gate1_unavailable Gate 1 (the entailment check) could not run, so the element was never // taken to the judges at all.",
      "not_evaluated_second_unavailable",
      "not_evaluated_gate1_unavailable",
      "// `status` is typed `string` because that is what AnalyseFactsElement carries off the wire — the engine is a // separate release train and may send a status this build predates.",
      "not evaluated — second check unavailable",
      ", verdict: null, explanation: ELEMENT_STATUS_EXPLANATION.not_evaluated_second_unavailable, unknown: false,",
      ": // Operator decision, 2026-09-26: its own status and its own presentation, visibly different from BOTH // not_established and not_evaluated_second_unavailable.",
      "not evaluated",
      "Not evaluated: entailment check unavailable",
      "not evaluated — entailment check unavailable",
      ", verdict: null, explanation: ELEMENT_STATUS_EXPLANATION.not_evaluated_gate1_unavailable, unknown: false,",
    ],
  },
  "src/lib/fixtures/engineCodes.json": {
    reason: "engine status-code names",
    sentences: [
      "not_evaluated_second_unavailable",
      "not_evaluated_gate1_unavailable",
    ],
  },
  "src/lib/fixtures/engineContractReasons.json": {
    reason: "engine reason-code name",
    sentences: [
      "no_training_statute_text",
    ],
  },
  "src/lib/fixtures/reasonCodesTable.json": {
    reason: "engine reason-code name",
    sentences: [
      "no_training_statute_text",
    ],
  },
  "src/lib/fixtures/signedGapStrings.json": {
    reason: "signed explanation of a not-evaluated element status",
    sentences: [
      "not_evaluated_second_unavailable",
      "not_evaluated_gate1_unavailable",
      "This condition was not evaluated because the entailment check (a separate check of the cited fact against the claim) was unavailable.",
    ],
  },
  "src/lib/nyayaLean.ts": {
    reason: "says trained element judges are not served on this surface; about model availability",
    sentences: [
      "Trained element models exist but are not served on this surface yet.",
    ],
  },
  "src/lib/palette.ts": {
    reason: "a comment about which pages the firm surface lists",
    sentences: [
      "// The law-firm surface lists its own pages only: no actions (start a night, dispatch, stop) and no records of the // improvement loop (objectives, runs, models, recipes) -- they would be links to pages this surface does not offer.",
    ],
  },
  "src/lib/reasonText.ts": {
    reason: "reason-code name",
    sentences: [
      ", no_training_statute_text:",
    ],
  },
  "src/lib/referReason.ts": {
    reason: "a comment about engine reason strings",
    sentences: [
      "// `reason` is typed `string` because that is what AnalyseFactsContract carries off the wire -- the engine is // a separate release train and may send a reason this build predates.",
    ],
  },
  "src/lib/screening/model.ts": {
    reason: "a comment about not-evaluated statuses",
    sentences: [
      "// not_confirmed, both not_evaluated cases and any status this build does not know: a review item with the signed sentence, never an error.",
    ],
  },
  "src/lib/signedStrings.ts": {
    reason: "signed explanation of a not-evaluated element status and its code names",
    sentences: [
      ", not_evaluated_second_unavailable:",
      ", not_evaluated_gate1_unavailable:",
      "This condition was not evaluated because the entailment check (a separate check of the cited fact against the claim) was unavailable.",
    ],
  },
  "src/lib/surfaceCopy.ts": {
    reason: "a comment explaining why the engine's own retention notice is not displayed",
    sentences: [
      "It is written here, not copied from the engine: the engine's own retention_notice still carries a training promise // the app does not enforce, so the app never displays it (CaveatStrip).",
    ],
  },
  "public/films/client/manifest.json": {
    reason: "the client film's own scene text (names, scene descriptions) as frozen in the v6 film strings (FILMS_V6_STRINGS_FROZEN, SHA256SUMS 46e72f81b7a7e416) and read and confirmed by R1 by hash; describes how the product is built and evaluated, not what happens to a submission",
    sentences: [
      "Pravrudhi-Nyaya is the product, Prabhāsa-Nyāya our own trained models.",
      "Our trained models read each ingredient;",
      "Built from real judgments and orders: gathered, cleaned, read by two models and checked, then divided into training, held-out testing and evaluation sets.",
      "Evaluation items are checked against training data.",
    ],
  },
  "public/films/technical/manifest.json": {
    reason: "the technical film's own scene text as frozen in the v6 film strings (FILMS_V6_STRINGS_FROZEN, SHA256SUMS 46e72f81b7a7e416) and read and confirmed by R1 by hash; describes how the product is built and evaluated, not what happens to a submission",
    sentences: [
      "evaluation",
      "Prabhāsa-Nyāya is our own trained models;",
      "Real judgments and orders are gathered, cleaned, read by two model readers, checked and split into training, held-out testing and evaluation sets.",
      "Our trained models that read one ingredient at a time.",
      "Evaluation discipline",
      "Evaluation items are checked against training data, every look at the evaluation set is counted, and results that show no effect are reported.",
    ],
  },
  "public/films/client/captions.vtt": {
    reason: "the client film's captions: the narration's own \"text\" (NARRATION_CLIENT_FROZEN v3, narration.json sha256 2ebe69ec11ebf242, R1-confirmed by hash), cut into cues; describes how the product is built and evaluated, not what happens to a submission",
    sentences: [
      "4 00:00:24.340 --> 00:00:30.450 Prabhāsa-Nyāya is the set of models we trained ourselves, and they work quietly inside it.",
      "16 00:01:52.200 --> 00:02:02.300 Behind the checklist there are two of our trained models.",
      "18 00:02:10.100 --> 00:02:14.014 Where does a model like that learn?",
      "20 00:02:23.383 --> 00:02:31.725 Cases we construct ourselves are always labelled as such, and the material we test on is checked against the material we train on.",
    ],
  },
  "public/films/technical/captions.vtt": {
    reason: "the technical film's captions: the narration's own \"text\" (NARRATION_TECHNICAL_FROZEN v3, narration.json sha256 56f2a5d315aaef27, R1-confirmed by hash), cut into cues; describes how the product is built and evaluated, not what happens to a submission",
    sentences: [
      "Prabhāsa-Nyāya is our own set of trained models, which sit inside it.",
      "9 00:01:02.207 --> 00:01:11.996 Then the material is split three ways: training, held-out testing, and evaluation.",
      "10 00:01:11.996 --> 00:01:17.300 And evaluation items are checked against the training data, by identity and by text.",
      "11 00:01:18.800 --> 00:01:22.986 Now the judges, our trained models that read one ingredient at a time.",
      "36 00:04:31.730 --> 00:04:39.456 Development, training and tests run on our own GPU machines, and results from those are labelled dev stack, local.",
      "38 00:04:46.700 --> 00:04:55.234 Finally, evaluation discipline.",
      "39 00:04:55.234 --> 00:05:04.743 Every look at an evaluation set is counted, so nothing gets quietly re-run until it passes.",
      "41 00:05:08.218 --> 00:05:15.716 And where a document-level overlap turned up in an earlier model line, we removed the affected evaluation rows and said so.",
    ],
  },
};
