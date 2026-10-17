// The words of the NyayaSiddhi submission page (/benchmarks/submit, app#429), R1's final file NYAYASIDDHI_SUBMIT_STRINGS_R1_FINAL.txt (sha12 004302f6a67a), pinned sentence by sentence in nyayasiddhiSubmit.spec.ts.
// oracle_note is the one sentence R2 gave (17 Oct): the earlier second sentence ("We publish that file ourselves ...") claimed a file that is not on the dataset and was removed.
// Every link goes to a public file of the Hugging Face dataset AxisMeru/nyayasiddhi (checked 200 on 17 Oct). The page states only what submission680/SUBMISSION_PATH_680.md and check_submission.py say.

/** The ONE hidden-split sentence (R1, 17 Oct; sha256[:16] 1502d9c1b8e3fdf1): used by the submit page, the /benchmarks block and the card. */
export const NS_HIDDEN_SPLIT = "There is no hidden set yet. The mechanism for one is being built. The organisers would hold it; there is no independent custodian yet.";

export const NS_SUBMIT = {
  heading: "Submit a system to NyayaSiddhi",
  intro: "You run your system on the released items and send us its predictions. We check the files and add a result row.",
  status_line: "This is a development benchmark. Version 0.2 has no hidden set.",
  not_a_ranking: "A result shows how a system did on these items. The board does not rank systems, and a result says nothing about real cases.",
  hidden_split: NS_HIDDEN_SPLIT,
  no_outside_yet: "No outside party has submitted yet. The rows on this site are the organisers' own.",
  step1: "1. Download the two item files, obj1_dev.jsonl and obj1b_minus_cruelty.jsonl, and check them against SHA256SUMS.",
  step2: "2. For one split, write predictions.jsonl. Write one line for each item, and each item once: its item_id and a verdict of PROOF or NOT_PROOF (these are the file's own values, not claims). A REFER or ABSTAIN outcome counts as NOT_PROOF and is declared in your manifest. A missing item is an error, never a silent NOT_PROOF.",
  step3: "3. Write manifest.json. Pin every model id with a revision, set publish_consent to true, and give the sha256 of your predictions file.",
  step4: "4. Put those two files, and nothing else, in submissions/<system_name>/<system_version>/. Names use letters, digits and . _ + - only, and at most 64 characters.",
  step5: "5. Run the checker on your folder. Give it both item files, even if your predictions are for one split. It must print PASS.",
  step6: "6. Open a pull request or a discussion on the Hugging Face dataset AxisMeru/nyayasiddhi with the template below.",
  after_submit: "We run the same check on your files, score them with the released scorer and add a result row. The row is marked self-reported. We plan to mark a row differently once it has been re-scored or run again; no row has been yet. Rows are only added; a correction is a new row.",
  oracle_note: "A file whose verdicts equal the released labels on every scored item is not accepted.",
  template_heading: "What to include with your submission",
  checker_heading: "The checker",
  checker_text: "The checker needs jsonschema. It checks the schema, that every item appears once, the item file hashes, the manifest fields, your predictions hash, the error count, your consent and that labels were not copied.",
  limits_heading: "What the checker cannot tell",
  limit1: "The checker cannot tell whether a system saw the items. Training on public items is declared by you and not checked by us.",
  limit2: "No hidden set exists in version 0.2, so every released item is public. A score on it is a development figure.",
  limit3: "Element-level fields are kept but not scored in this version.",
  limit4: "The labels were extracted by models and filtered by agreement between extractors. They have not been checked by a person.",
  no_upload: "You cannot upload on this page yet. Use the Hugging Face dataset.",
  link_dataset: "The NyayaSiddhi dataset",
  link_checker: "The checker (check_submission.py)",
  link_back: "Back to the benchmark results",
  templateFields: [
    "System name and version",
    "Split scored (obj1_dev or obj1b_minus_cruelty)",
    "Unit (whole item or element by element)",
    "Models (id and revision)",
    "Trained on public items? (yes, no or unknown)",
    "Run by and date",
    "The checker's PASS line",
    "I consent to publication of the rows and the manifest",
    "Anything else the reader should know",
  ],
} as const;

const HF = "https://huggingface.co/datasets/AxisMeru/nyayasiddhi";

/** The public files the page links to, nothing else. */
export const NS_SUBMIT_LINKS = {
  dataset: HF,
  checker: `${HF}/blob/main/submission680/check_submission.py`,
  checkerDownload: `${HF}/resolve/main/submission680/check_submission.py`,
  checksums: `${HF}/blob/main/SHA256SUMS`,
  submitPath: `${HF}/blob/main/submission680/SUBMISSION_PATH_680.md`,
} as const;

/** The one link line on /benchmarks to the page (PAGE_STRINGS_R1_FINAL submit_link, sha256[:16] d2b7ad05a8091b01). */
export const NS_SUBMIT_LINK_TEXT = "How to submit a system";
