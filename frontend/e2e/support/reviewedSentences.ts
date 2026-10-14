// The reviewed list for the fail-closed promise scan (R2/R1, 13 Oct). Every sentence in a shipped file (src/ non-spec, public/) that mentions training, tuning,
// scoring or improving a model must be listed here, EXACTLY as the scan splits it, with the reason it is not a statement about what happens to a submission.
// Every entry is a sentence the app already ships; adding one here is a copy decision for R1. A stale entry fails the scan.
export const REVIEWED: Readonly<Record<string, { reason: string; sentences: readonly string[] }>> = {
  "public/demo.json": {
    reason: "recorded Studio demo data: research-ledger names, recipe titles and model-training settings; none is a statement about what happens to a submission",
    sentences: [
      "pretrained=/models/hub/models--Qwen--Qwen3-0.6B/snapshots/c1899de289a04d12100db370d81485cdf75e47ca/,dtype=bfloat16,trust_remote_code=False",
      "pretrained=/models/hub/models--Qwen--Qwen3-0.6B/snapshots/c1899de289a04d12100db370d81485cdf75e47ca/,dtype=bfloat16,trust_remote_code=False,peft=/adapter",
      "pretrained=/models/hub/models--Qwen--Qwen3-1.7B/snapshots/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e/,dtype=bfloat16,trust_remote_code=False",
      "~/projects/pravrudhi/.pravrudhi/kernel/jobs/n4-train-c-0045-95769407/out/adapter",
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
  "src/app/matters/page.tsx": {
    reason: "says which contracts have no model coverage yet (the models' own coverage), and the reason-code name for it",
    sentences: [
      "// A contract's judge is ABSTAIN with a reason containing this token when no judge has been trained on its // statute text yet (Lead-2, 2026-09-24: 12 of the 26 registry contracts are in this state today — bns316/ // 318/217/80/108, bnss187, ni138 among them).",
      "no_training_statute_text",
      "> No judge has been trained on this contract&apos;s statute text yet, so this product gives no answer here and refers instead.",
      "Ask about a different matter, or check back once this contract is trained.",
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
      "not evaluated — second judge unavailable",
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
      "Trained element judges exist but are not served on this surface yet.",
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
};
