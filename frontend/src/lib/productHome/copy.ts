// The product Home (app#539; Lead-2 22 Oct: layout approved, mockup ed4830b63911; builds for d62). DRAFT for R1: every string the Home shows is here, none inline. Built from sentences already on live pages
// (Studio's design read ee4188e82600); the status line uses the engine's own words. No figure, no "live"/"recorded", no run history, no case or fact text, no email, no model or GPU claim.
import { SIGNIN_COPY } from "@/lib/signinCopy";

export const HOME_COPY = {
  navLabel: "Home",
  // signed out
  heading: "Pravrudhi-Nyaya",
  lead: "Element-by-element screening under Indian law, starting with criminal matters. An ingredient is shown as supported only where a cited fact appears to carry it, as a suggestion for you to check; where none does, it is referred back to you.",
  signIn: "Sign in",
  noNewAccounts: SIGNIN_COPY.getAccess, // R1: only "To get an account, ask your administrator." here; "New accounts cannot be created on this page" belongs to /signin
  filmsHeading: "Three films",
  syntheticVoice: "The narration is a synthetic voice.",
  readMoreHeading: "Read more",
  standing: "This assists a lawyer; it is not a verdict.",
  // signed in
  workspaceHeading: "Home",
  startScreening: "Start a screening",
  modelsReady: "The analysis models are ready.",
  modelsStarting: "The analysis models are starting.",
  modelsOff: "The analysis models are switched off at the moment.",
  modelsUnavailable: "The status of the analysis models could not be read.",
  mattersHeading: "Your matters",
  openMatter: "Open",
  allMatters: "All matters",
  mattersUnavailable: "Your matters could not be listed.",
  workflowsHeading: "Workflows",
  allWorkflows: "All workflows",
  quickHeading: "Quick links",
  invitePeople: "Access", // R1: the same word as the sidebar item and the page's own heading
  loading: "Loading…",
} as const;

export interface HomeFilm { title: string; length: string; line: string; href: string }
/** Lengths as shown on the films' own pages; one line each. */
export const HOME_FILMS: readonly HomeFilm[] = [
  { title: "Pravrudhi-Nyaya for Firms", length: "6:40", line: "For a firm's lawyers.", href: "/guide#film" },
  { title: "Technical film", length: "6:51", line: "How a screening is built and checked.", href: "/technical-film" },
  { title: "NyayaSiddhi", length: "7:33", line: "For people who want to take part.", href: "/benchmarks" },
];

export interface HomeLink { label: string; href: string }
export const HOME_READ_MORE: readonly HomeLink[] = [
  { label: "User guide", href: "/guide" }, { label: "Benchmarks", href: "/benchmarks" }, { label: "Data handling", href: "/data-handling" }, { label: "Safety record", href: "/safety" },
];
export const HOME_QUICK: readonly HomeLink[] = [
  { label: "Citation check", href: "/citations" }, { label: "Data handling", href: "/data-handling" }, { label: "User guide", href: "/guide" }, { label: "Safety record", href: "/safety" }, { label: "Benchmarks", href: "/benchmarks" },
];
/** Three of the workflows (their registry titles and lines are used as they are). */
export const HOME_WORKFLOW_KEYS = ["wf_a3_chronology", "wf_a5_ingredient_agenda", "wf_a7_matter_hearing_pack"] as const;
