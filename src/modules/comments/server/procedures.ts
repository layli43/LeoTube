import { db } from "@/db";
import { comments, commentsReactions, users } from "@/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import {
  eq,
  getTableColumns,
  lt,
  or,
  and,
  count,
  desc,
  inArray,
} from "drizzle-orm";
import { z } from "zod";

export const commentsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        value: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { videoId } = input;
      const { value } = input;
      const { id: userId } = ctx.user;

      const createdComment = await db
        .insert(comments)
        .values({ userId, videoId, value })
        .returning();

      return createdComment;
    }),

  remove: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const { id: userId } = ctx.user;

      const deletedComment = await db
        .delete(comments)
        .where(and(eq(comments.id, id), eq(comments.userId, userId)))
        .returning();

      return deletedComment;
    }),

  getMany: baseProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { videoId } = input;
      const { cursor, limit } = input;
      const { clerkUserId } = ctx;

      const [user] = await db
        .select()
        .from(users)
        .where(inArray(users.clerkId, clerkUserId ? [clerkUserId] : []));

      let userId;
      if (user) {
        userId = user.id;
      }
      // TODO: Get viewer's reactions
      const commentsViewerReactions = db.$with("comments_viewer_reactions").as(
        db
          .select({
            commentId: commentsReactions.commentId,
            type: commentsReactions.type,
          })
          .from(commentsReactions)
          .where(inArray(commentsReactions.userId, userId ? [userId] : [])),
      );

      const [totalData, commentsList] = await Promise.all([
        // Get total comments counts
        await db
          .select({
            count: count(),
          })
          .from(comments)
          .where(eq(comments.videoId, videoId)),

        await db
          .with(commentsViewerReactions)
          .select({
            ...getTableColumns(comments),
            user: users,
            viewerReaction: commentsViewerReactions.type,
            likeCount: db.$count(
              commentsReactions,
              and(
                eq(commentsReactions.type, "like"),
                eq(commentsReactions.commentId, comments.id),
              ),
            ),
            dislikeCount: db.$count(
              commentsReactions,
              and(
                eq(commentsReactions.type, "dislike"),
                eq(commentsReactions.commentId, comments.id),
              ),
            ),
          })
          .from(comments)
          .where(
            and(
              eq(comments.videoId, videoId),
              cursor
                ? or(
                    lt(comments.updatedAt, cursor.updatedAt),
                    and(
                      eq(comments.updatedAt, cursor.updatedAt),
                      lt(comments.id, cursor.id),
                    ),
                  )
                : undefined,
            ),
          )
          .innerJoin(users, eq(comments.userId, users.id))
          .leftJoin(
            commentsViewerReactions,
            eq(comments.id, commentsViewerReactions.commentId),
          )
          // Keep ordering consistent with lt-based cursor pagination to avoid duplicates.
          .orderBy(desc(comments.updatedAt), desc(comments.id))
          .limit(limit + 1),
      ]);

      const hasMore = commentsList.length > limit;
      const items = hasMore ? commentsList.slice(0, -1) : commentsList;
      const lastItem = items[items.length - 1];

      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          }
        : null;

      return {
        totalCounts: totalData[0].count,
        items,
        nextCursor,
      };
    }),
});
