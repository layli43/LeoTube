import { db } from "@/db";
import { comments, commentsReactions, users } from "@/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import {
  eq,
  getTableColumns,
  lt,
  or,
  and,
  count,
  desc,
  inArray,
  isNull,
  isNotNull,
} from "drizzle-orm";
import { z } from "zod";

export const commentsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        parentId: z.string().uuid().nullish(),
        value: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { videoId, parentId, value } = input;
      const { id: userId } = ctx.user;

      const [existingComment] = await db
        .select()
        .from(comments)
        .where(inArray(comments.id, parentId ? [parentId] : []));

      if (!existingComment && parentId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (existingComment?.parentId && parentId) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const createdComment = await db
        .insert(comments)
        .values({ userId, videoId, parentId, value })
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
        parentId: z.string().uuid().nullish(),
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
      const { videoId, parentId } = input;
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

      const commentsViewerReactions = db.$with("comments_viewer_reactions").as(
        db
          .select({
            commentId: commentsReactions.commentId,
            type: commentsReactions.type,
          })
          .from(commentsReactions)
          .where(inArray(commentsReactions.userId, userId ? [userId] : [])),
      );

      const replies = db.$with("replies").as(
        db
          .select({
            parentId: comments.parentId,
            count: count(comments.id).as("count"),
          })
          .from(comments)
          .where(isNotNull(comments.parentId))
          .groupBy(comments.parentId),
      );

      const [totalData, commentsList] = await Promise.all([
        // Get total comments counts
        await db
          .select({
            count: count(),
          })
          .from(comments)
          .where(and(eq(comments.videoId, videoId), isNull(comments.parentId))),

        await db
          .with(commentsViewerReactions, replies)
          .select({
            ...getTableColumns(comments),
            user: users,
            viewerReaction: commentsViewerReactions.type,
            replyCount: replies.count,
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
              parentId ? eq(comments.parentId, parentId)
              :isNull(comments.parentId),
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
          .leftJoin(replies, eq(comments.id, replies.parentId))
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
