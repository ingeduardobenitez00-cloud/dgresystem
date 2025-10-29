"use server";

import { imageAutoTagging as imageAutoTaggingFlow, type ImageAutoTaggingInput } from "@/ai/flows/image-auto-tagging";

export async function imageAutoTagging(
  input: ImageAutoTaggingInput
): Promise<{ tags: string[] } | { error: string }> {
  try {
    const result = await imageAutoTaggingFlow(input);
    return result;
  } catch (e) {
    console.error(e);
    return { error: 'Failed to generate tags.' };
  }
}
