import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  account,
  NewsReaderInteraction,
  NewsReaderProfile,
  user,
} from "@acme/db/schema";

import { adminProcedure, createTRPCRouter } from "./trpc";

export const usersListInput = z.strictObject({
  page: z.number().int().nonnegative().default(0),
  pageSize: z.number().int().min(1).max(50).default(20),
  search: z.string().trim().min(1).max(160).optional(),
});

interface UserAggregateRow {
  createdAt: Date;
  email: string;
  emailVerified: boolean;
  firebaseLinked: boolean;
  id: string;
  image: string | null;
  interactionCount: number;
  latestInteractionAt: Date | null;
  name: string;
  readerProfile: boolean;
}

export const toUserViewModel = (row: UserAggregateRow) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  latestInteractionAt: row.latestInteractionAt?.toISOString() ?? null,
});

export const usersRouter = createTRPCRouter({
  list: adminProcedure.input(usersListInput).query(async ({ ctx, input }) => {
    const search = input.search ? `%${input.search}%` : null;
    const where = search
      ? or(ilike(user.email, search), ilike(user.name, search))
      : undefined;

    const [rows, countRows] = await Promise.all([
      ctx.db
        .select({
          createdAt: user.createdAt,
          email: user.email,
          emailVerified: user.emailVerified,
          firebaseLinked: sql<boolean>`count(distinct ${account.id}) > 0`,
          id: user.id,
          image: user.image,
          interactionCount: sql<number>`count(distinct ${NewsReaderInteraction.id})::int`,
          latestInteractionAt: sql<Date | null>`max(${NewsReaderInteraction.occurredAt})`,
          name: user.name,
          readerProfile: sql<boolean>`count(distinct ${NewsReaderProfile.id}) > 0`,
        })
        .from(user)
        .leftJoin(
          account,
          and(eq(account.userId, user.id), eq(account.providerId, "firebase")),
        )
        .leftJoin(NewsReaderProfile, eq(NewsReaderProfile.userId, user.id))
        .leftJoin(
          NewsReaderInteraction,
          eq(NewsReaderInteraction.readerProfileId, NewsReaderProfile.id),
        )
        .where(where)
        .groupBy(
          user.id,
          user.name,
          user.email,
          user.emailVerified,
          user.image,
          user.createdAt,
        )
        .orderBy(desc(user.createdAt))
        .limit(input.pageSize)
        .offset(input.page * input.pageSize),
      ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(user)
        .where(where),
    ]);

    return {
      items: rows.map(toUserViewModel),
      total: countRows[0]?.count ?? 0,
    };
  }),
});
