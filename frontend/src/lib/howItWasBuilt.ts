// "How it was built": the customer layer of the explorer's #914 set, signed text (R1 sign, R2 confirmed). Source: research-explorer/efrontier/HOW_IT_WAS_BUILT_DRAFT_v5_2026-10-14.md,
// sha256 2ac5468a5d8c786a715031e29a47ff51c56550f915aeffe6ec31cf7132567bf1; sections A (story) and B (six stage cards) only. Sections C (one-liners for reuse), D and E are not rendered.
// No figures. "Prabhāsa-Nyāya" with diacritics in prose, "Pravrudhi-Nyaya" in ASCII. Do not edit a word without R1's read; howItWasBuilt.spec.ts pins every sentence.
export const HOW_BUILT_TITLE = "How it was built";
export const HOW_BUILT_STORY: string = "We trained the Prabhāsa-Nyāya models behind Pravrudhi-Nyaya on real court text, alongside constructed cases. We gathered public judgments from the High Courts and the Supreme Court, cleaned them, and had two model readers working separately (model-extracted, no human review) mark which ingredients of an offence the court actually decided, each quoting the court's own words. A strict checker kept only what both readers agreed on and what could be found in the judgment. Rows went to training, to held-out checks, or to evaluation by a fixed rule, and the sealed and registered evaluation sets were checked against training data by identity and text; where a document-level overlap was found, we removed the affected evaluation rows and disclosed it. When something did not work, we stopped and said so. The product refers to a lawyer rather than guess.";

export interface HowBuiltItem { label: string | null; text: string }
export interface HowBuiltCard { title: string; items: readonly HowBuiltItem[] }

export const HOW_BUILT_CARDS: readonly HowBuiltCard[] = [
  {
    "title": "Gathering real public judgments",
    "items": [
      {
        "label": "What we did",
        "text": "collected public High Court and Supreme Court judgments across many courts; kept each one's court, case type, number and date as printed."
      },
      {
        "label": "What it means for you",
        "text": "the examples shown to you are real court text; the real-text part of the training material is drawn from publicly available texts; for the Supreme Court judgments we have not confirmed the source or licence of our copy; the rest is constructed and labelled as constructed."
      },
      {
        "label": "What we found",
        "text": "the supply of judgments where a court decided a specific ingredient is thin for most offences; we widened it by registered, smoke-tested slices rather than by relaxing the rules."
      },
      {
        "label": "What we do not claim",
        "text": "that the collection is complete or balanced across courts or offences."
      }
    ]
  },
  {
    "title": "Cleaning",
    "items": [
      {
        "label": "What we did",
        "text": "removed repeated copies of the same judgment, tolerated scanning noise and spacing differences when matching quotes, and checked rows against our evaluation and sealed lists for overlap."
      },
      {
        "label": "What it means for you",
        "text": "a result that looks good is not a result that merely re-reads its own training text."
      },
      {
        "label": "What we found",
        "text": "duplicates and near-duplicates exist and had to be removed before counting anything."
      },
      {
        "label": "What we do not claim",
        "text": "that no overlap is possible; the checks we ran are the ones named in the records."
      }
    ]
  },
  {
    "title": "Two readers and a strict checker",
    "items": [
      {
        "label": "What we did",
        "text": "two model readers, working separately, read each judgment, marked the ingredients the court decided and quoted the court's words; a mechanical checker kept a row only if both readers agreed and the quotes were found in the judgment, in the right part of it."
      },
      {
        "label": "What it means for you",
        "text": "every kept example points to the court's own words, which you can read."
      },
      {
        "label": "What we found",
        "text": "agreement and a found quote are checks, not proof of correct reading."
      },
      {
        "label": "What we do not claim",
        "text": "that the extraction is accurate, validated or human-reviewed. It is model-extracted, with no human review."
      }
    ]
  },
  {
    "title": "The quality gate, and what we learned about it",
    "items": [
      {
        "label": "What we did",
        "text": "tried to recover examples the checker had dropped by letting a model agent re-read the judgment, under rules fixed in advance, with deliberate \"should find nothing\" items as controls."
      },
      {
        "label": "What we found",
        "text": "the checks proved a quote was in the judgment, not that it spoke to the ingredient. The run stopped by its own rule when one control was wrongly recovered, and a second, model-based relevance check also failed a control. What remains is a strict word-level filter that refuses rather than rescues."
      },
      {
        "label": "What it means for you",
        "text": "we chose to lose good examples rather than let generic ones in."
      },
      {
        "label": "What we do not claim",
        "text": "that recovering dropped examples works. It is parked."
      }
    ]
  },
  {
    "title": "Training, held-out and evaluation",
    "items": [
      {
        "label": "What we did",
        "text": "assigned each judgment to one side by a fixed rule on its identity, so a judgment never sits on both; sealed and registered evaluation sets were checked against training data by identity and text; where a document-level overlap was found (in the earlier v5.x model line), we removed the affected evaluation rows and disclosed it; none of those models was promoted."
      },
      {
        "label": "What it means for you",
        "text": "no evaluation judgment is also a training judgment (identity check); some pairs share text, such as a judgment that reproduces the one under appeal; we counted and disclosed those."
      },
      {
        "label": "What we found",
        "text": "the next judge version was trained and evaluated under its registered rules; it was not promoted, so the production judges stay as they are."
      },
      {
        "label": "What we do not claim",
        "text": "that more training would help. The analysis models in production are the versions described on this page; a retrained model replaces them only after it passes the same tests."
      }
    ]
  },
  {
    "title": "The honest nulls",
    "items": [
      {
        "label": null,
        "text": "In a small continued-pre-training test, extra legal text did not improve held-out legal text prediction over a control, so we changed approach rather than scale it."
      },
      {
        "label": null,
        "text": "Early benchmark defects and two withdrawn findings were found and corrected, and kept in our records."
      },
      {
        "label": null,
        "text": "A model's yes/no on \"is this passage relevant\" did not reliably refuse a generic sentence; we do not use it as a gate."
      },
      {
        "label": "What it means for you",
        "text": "the product's stance (it points, it refers, it does not decide) comes from these results."
      }
    ]
  }
];
