import { PageHeader } from "@/components/PageHeader";
import { WorkflowRows } from "@/components/WorkflowRows";
import { WORKFLOWS_TITLE } from "@/lib/workflowsCopy";

// A static, honest list: no start button, no progress, no figures. Words in lib/workflowsCopy.ts (R1's exact text). The rows are drawn by a client component only so that the
// assistant workflow can be greyed while the assistant tier is not available (lib/assistantTier.ts).
export default function WorkflowsPage() {
  return (
    <div>
      <PageHeader title={WORKFLOWS_TITLE} />
      <div className="mx-auto max-w-3xl space-y-4 p-8" data-testid="workflows">
        <WorkflowRows />
      </div>
    </div>
  );
}
