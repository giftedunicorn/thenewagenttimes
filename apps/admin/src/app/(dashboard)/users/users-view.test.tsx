import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UsersView } from "./users-view";

const props = {
  isRefreshing: false,
  onPageChange: () => undefined,
  onRefresh: () => undefined,
  onRetry: () => undefined,
  onSearchChange: () => undefined,
  page: 0,
  search: "",
};

describe("UsersView", () => {
  it("renders loading, empty, error, and reader identity data", () => {
    expect(
      renderToStaticMarkup(
        <UsersView {...props} data={undefined} isError={false} isPending />,
      ),
    ).toContain("Loading");
    expect(
      renderToStaticMarkup(
        <UsersView {...props} data={undefined} isError isPending={false} />,
      ),
    ).toContain("Try again");
    expect(
      renderToStaticMarkup(
        <UsersView
          {...props}
          data={{ items: [], total: 0 }}
          isError={false}
          isPending={false}
        />,
      ),
    ).toContain("No users");

    const html = renderToStaticMarkup(
      <UsersView
        {...props}
        data={{
          items: [
            {
              createdAt: "2026-07-20T10:00:00.000Z",
              email: "reader@example.com",
              emailVerified: true,
              firebaseLinked: true,
              id: "user-1",
              image: null,
              interactionCount: 12,
              latestInteractionAt: "2026-07-20T11:00:00.000Z",
              name: "Reader",
              readerProfile: true,
            },
          ],
          total: 1,
        }}
        isError={false}
        isPending={false}
      />,
    );

    expect(html).toContain("reader@example.com");
    expect(html).toContain("12");
    expect(html).toContain("Firebase linked");
  });
});
