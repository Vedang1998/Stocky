import { Form } from "react-router";
import type {
  SetupAction,
  SetupGuide as SetupGuideData,
  SetupStep,
} from "../lib/setup-guide";

function StepAction({ action, syncing }: { action: SetupAction; syncing: boolean }) {
  if (action.kind === "link") {
    return <s-link href={action.href}>{action.label}</s-link>;
  }
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="syncCatalog" />
      <s-button type="submit" {...(syncing ? { loading: true } : {})}>
        {action.label}
      </s-button>
    </Form>
  );
}

function Step({ step, syncing }: { step: SetupStep; syncing: boolean }) {
  return (
    <s-stack direction="inline" gap="small" alignItems="start">
      {step.done ? (
        <s-icon type="check-circle-filled" tone="success" />
      ) : (
        <s-icon type="circle-dashed" tone="neutral" />
      )}
      <s-stack gap="small-300">
        <s-text type="strong">
          {step.title}
          <s-text accessibilityVisibility="exclusive">
            {step.done ? " (done)" : " (to do)"}
          </s-text>
        </s-text>
        <s-text color="subdued">{step.detail}</s-text>
        {step.action ? <StepAction action={step.action} syncing={syncing} /> : null}
      </s-stack>
    </s-stack>
  );
}

/** Home page checklist. Hidden by the caller once every step is done. */
export function SetupGuide({
  guide,
  syncing,
}: {
  guide: SetupGuideData;
  syncing: boolean;
}) {
  return (
    <s-section heading="Set up ProPo">
      <s-stack gap="base">
        <s-text color="subdued">
          {guide.doneCount} of {guide.steps.length} steps done
        </s-text>
        {guide.steps.map((step) => (
          <Step key={step.id} step={step} syncing={syncing} />
        ))}
      </s-stack>
    </s-section>
  );
}
