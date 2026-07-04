export const getFirstNonBlankValue = (
  ...values: (string | null | undefined)[]
) => {
  for (const value of values) {
    const trimmed = value?.trim();

    if (trimmed) return trimmed;
  }

  return undefined;
};
