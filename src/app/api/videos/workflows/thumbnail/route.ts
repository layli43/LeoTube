import { db } from "@/db";
import { videos } from "@/db/schema";
import { serve } from "@upstash/workflow/nextjs";
import { eq, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { UTApi } from "uploadthing/server";

interface InputType {
  userId: string;
  videoId: string;
  prompt: string;
}

const THUMBNAIL_GENERATION_PROPMT =
  "Return pictures, no more further requirements";

export const { POST } = serve(async (context) => {
  const input = context.requestPayload as InputType;
  const { userId, videoId, prompt } = input;
  const utapi = new UTApi();

  //1. Get the original video
  const video = await context.run("get-video", async () => {
    const existingVideo = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)));

    if (!existingVideo) {
      throw new Error("Not found");
    }

    return existingVideo[0];
  });

  // 2. Ai generated thumbnail and upload it to uploadthing
  const { thumbnailKey, thumbnailUrl } = await context.run(
    "generate-upload-thumbnail",
    async () => {
      const ai = new GoogleGenAI({});

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ text: prompt }, { text: THUMBNAIL_GENERATION_PROPMT }],
      });

      if (response.candidates == undefined) {
        throw new Error("Image generation failed");
      }
      if (response.candidates[0]?.content?.parts == undefined) {
        throw new Error("Content or parts is undefined");
      }
      let buffer = null;
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          console.log(part.text);
        } else if (part.inlineData) {
          const imageData = part.inlineData.data;
          if (imageData) {
            buffer = Buffer.from(imageData, "base64");
          }
        }
      }

      //Create a new file object
      if (buffer == null) {
        throw new Error("Failed to upload", { cause: "Image generation" });
      }
      const file = new File([buffer], `thumbnail-${video.id}.png`, {
        type: "image/png",
      });
      const uploaded = await utapi.uploadFiles(file);

      if (!uploaded.data?.key || !uploaded.data?.url) {
        throw new Error("Failed to upload");
      }

      return {
        thumbnailKey: uploaded.data.key,
        thumbnailUrl: uploaded.data.url,
      };
    },
  );

  // 3. Clear previous thumbnail on uploadthing
  await context.run("cleanup-thumbnail", async () => {
    if (video.thumbnailKey) {
      await utapi.deleteFiles(video.thumbnailKey);
    }
  });

  //4. Update the database
  await context.run("update-video", async () => {
    await db
      .update(videos)
      .set({
        thumbnailKey: thumbnailKey || video.thumbnailKey,
        thumbnailUrl: thumbnailUrl || video.thumbnailUrl,
      })
      .where(and(eq(videos.userId, video.userId), eq(videos.id, video.id)));
  });

  await context.run("second-step", () => {
    console.log("second step ran");
  });
});
