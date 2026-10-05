// Runs mammoth off the main thread, so a hostile or pathological .docx can only ever stall this worker: the page
// terminates it after a deadline and the tab stays responsive.
type Reply = { ok: true; text: string } | { ok: false };
const scope = self as unknown as {
  onmessage: ((e: { data: ArrayBuffer }) => void) | null;
  postMessage: (m: Reply) => void;
};

scope.onmessage = async (e) => {
  try {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: e.data });
    scope.postMessage({ ok: true, text: value });
  } catch {
    scope.postMessage({ ok: false });
  }
};
