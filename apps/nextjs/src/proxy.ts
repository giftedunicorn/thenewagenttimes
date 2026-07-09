import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCanonicalNewsTopicPathname } from "./app/_components/news-topic-url";

export function proxy(request: NextRequest) {
  const canonicalPathname = getCanonicalNewsTopicPathname(
    request.nextUrl.pathname,
  );

  if (!canonicalPathname) return NextResponse.next();

  const canonicalUrl = request.nextUrl.clone();
  canonicalUrl.pathname = canonicalPathname;

  return NextResponse.redirect(canonicalUrl, 308);
}

export const config = {
  matcher: ["/topics/:category"],
};
