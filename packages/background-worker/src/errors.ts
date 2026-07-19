const MAX_ERROR_DEPTH = 5;
const MAX_ERROR_LENGTH = 1_000;

const getMessage = (error: Error) => {
  const message = error.message.replace(/\s+/g, " ").trim();
  return message || error.name;
};

const formatErrorValue = (
  error: unknown,
  depth: number,
  seen: Set<Error>,
): string => {
  if (!(error instanceof Error)) return "Unknown error";
  if (seen.has(error)) return "Circular error";

  const message = getMessage(error);
  if (!(error instanceof AggregateError) || depth >= MAX_ERROR_DEPTH) {
    return message;
  }

  seen.add(error);
  const errors = error.errors as readonly unknown[];
  const details = errors.map((item) => formatErrorValue(item, depth + 1, seen));
  seen.delete(error);

  return details.length === 0 ? message : `${message}: [${details.join("; ")}]`;
};

export const formatError = (error: unknown) => {
  const formatted = formatErrorValue(error, 0, new Set());

  return formatted.length <= MAX_ERROR_LENGTH
    ? formatted
    : `${formatted.slice(0, MAX_ERROR_LENGTH - 3)}...`;
};
