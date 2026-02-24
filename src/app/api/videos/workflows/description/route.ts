import { db } from "@/db";
import { videos } from "@/db/schema";
import { serve } from "@upstash/workflow/nextjs";
import { eq, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

interface InputType {
  userId: string;
  videoId: string;
}

const DESCRIPTION_SYSTEM_PROMPT = `Your task is to summarize the transcript of a video. Please follow these guidelines:
- Be brief. Condense the content into a summary that captures the key points and main ideas without losing important details.
- Avoid jargon or overly complex language unless necessary for the context.
- Focus on the most critical information, ignoring filler, repetitive statements, or irrelevant tangents.
- ONLY return the summary, no other text, annotations, or comments.
- Aim for a summary that is 3-5 sentences long and no more than 200 characters.`;

export const { POST } = serve(async (context) => {
  const input = context.requestPayload as InputType;
  const { userId, videoId } = input;

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

  const transcript = await context.run("get-transcript", async () => {
    const trackUrl = `https://stream.mux.com/${video.muxPlaybackId}/text/${video.muxTrackId}.txt`;
    const response = await fetch(trackUrl);
    const text = response.text();

    if (!text) {
      throw new Error("Bad request");
    }

    return text;
  });

  // Ai generated description
  const description = await context.run("generate-description", async () => {
    const ai = new GoogleGenAI({});

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: transcript,
        },
        {
          text: DESCRIPTION_SYSTEM_PROMPT,
        },
      ],
      config: {},
    });

    return response.text;
  });

  if (!description) {
    throw new Error("Ai title generation failed!", {
      cause: description,
    });
  }

  // Openai api mocking code
  // const { status, body } = await context.api.openai.call(
  //   "generated-thumbnail",
  //   {
  //     token: process.env.GEMINI_API_KEY!,
  //     operation: "chat.completions.create",
  //     body: {
  //       model: "gpt-4o",
  //       messages: [
  //         {
  //           role: "user",
  //           content: transcrpt,
  //         },
  //         {
  //           role: "user",
  //           content: TITLE_SYSTEM_PROMPT,
  //         },
  //       ],
  //     },
  //   },
  // );

  // // get text:
  // const title = body.choices[0]?.message.content;

  await context.run("update-video", async () => {
    await db
      .update(videos)
      .set({
        description: description || video.description,
      })
      .where(and(eq(videos.userId, video.userId), eq(videos.id, video.id)));
  });

  await context.run("second-step", () => {
    console.log("second step ran");
  });
});
