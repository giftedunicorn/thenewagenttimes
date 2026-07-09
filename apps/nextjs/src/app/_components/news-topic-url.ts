const newsTopicRoutePrefix = "/topics/";

export const getNewsTopicPathSegment = (category: string) =>
  category.trim().toLowerCase().replace(/_+/g, "-");

export const getNewsTopicHref = (category: string) =>
  `${newsTopicRoutePrefix}${getNewsTopicPathSegment(category)}`;

export const getCanonicalNewsTopicPathname = (pathname: string) => {
  if (!pathname.startsWith(newsTopicRoutePrefix)) return null;

  const topicPathSegment = pathname.slice(newsTopicRoutePrefix.length);

  if (!topicPathSegment || topicPathSegment.includes("/")) return null;

  const canonicalPathname = getNewsTopicHref(topicPathSegment);

  return pathname === canonicalPathname ? null : canonicalPathname;
};
