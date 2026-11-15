"use server";

import { auth } from "@clerk/nextjs/server";
import { generateWithFallback, geminiErrorMessage } from "@/lib/gemini";
import { buildStudioPrompt, cleanModelText, validateStudioInput } from "@/lib/creator-studio";

export async function runCreatorStudio(input) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Please sign in to use Creator Studio" };

  const params = {
    text: input?.text,
    action: input?.action,
    targetLanguage: input?.targetLanguage,
    tone: input?.tone,
  };
  const validationError = validateStudioInput(params);
  if (validationError) return { success: false, error: validationError };

  try {
    const output = cleanModelText(await generateWithFallback(buildStudioPrompt(params)));
    if (!output) return { success: false, error: "The AI returned an empty result. Please try again." };
    return { success: true, content: output };
  } catch (error) {
    console.error("Creator Studio error:", error.message);
    return { success: false, error: geminiErrorMessage(error) };
  }
}
