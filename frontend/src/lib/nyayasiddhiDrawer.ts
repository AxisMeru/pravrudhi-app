// The words of the row-details dialog and the version selector on /benchmarks (app#429 PR-C, #693): R1's final file NYAYASIDDHI_DRAWER_STRINGS_R1_FINAL.txt (sha12 90bc712c6d9b), pinned key by key in nyayasiddhiDrawer.spec.ts.
// Labels only: Status and Unit print the row's own stored value, never a computed word; the About text and the manifests are shown as published.
export const NS_DRAWER = {
  open_button: "Row details",
  dialog_title: "Details of this result row",
  close_button: "Close",
  version_label: "Benchmark version",
  version_note: "Only versions that have rows are listed.",
  field_system: "System",
  field_version: "System version",
  field_split: "Split",
  field_unit: "Unit",
  field_stack: "Run on",
  field_date: "Run date",
  field_status: "Status",
  field_errors: "Items with no scorable answer",
  field_about: "About this run",
  links_heading: "The published files for this row",
  link_manifest: "The manifest",
  link_predictions: "The predictions file",
  hash_manifest: "Manifest sha256",
  hash_predictions: "Predictions sha256",
  links_note: "These are the files as published on the Hugging Face dataset. The manifests are shown as published.",
} as const;
