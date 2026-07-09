export const newsStructuredDataSiteName = "The New AI Times";
export const newsStructuredDataDefaultBaseUrl = "https://thenewagenttimes.com";

export const getNewsStructuredDataUrl = ({
  baseUrl = newsStructuredDataDefaultBaseUrl,
  path,
}: {
  baseUrl?: string;
  path: string;
}) => {
  const trimmedBaseUrl = baseUrl.trim();
  const normalizedBaseUrl = (
    trimmedBaseUrl.length > 0
      ? trimmedBaseUrl
      : newsStructuredDataDefaultBaseUrl
  ).replace(/\/+$/, "");

  return new URL(path, `${normalizedBaseUrl}/`).toString();
};

export const stringifyNewsStructuredData = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c");
