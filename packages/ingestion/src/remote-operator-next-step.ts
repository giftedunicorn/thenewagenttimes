export interface RemoteNewsOperatorNextStep {
  command: string | null;
  detail: string;
  label: string;
  step: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const getRemoteNewsOperatorNextStep = (
  body: unknown,
): RemoteNewsOperatorNextStep | undefined => {
  if (!isRecord(body) || !isRecord(body.operatorNextStep)) return undefined;

  const { command, detail, label, step } = body.operatorNextStep;

  if (
    (typeof command !== "string" && command !== null) ||
    typeof detail !== "string" ||
    typeof label !== "string" ||
    typeof step !== "string"
  ) {
    return undefined;
  }

  return {
    command,
    detail,
    label,
    step,
  };
};
