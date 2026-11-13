"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { recordGeminiCall } from "@/lib/dev-usage";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Models tried in order. If one is overloaded (503), rate-limited (429)
// or retired (404), the next one is used.
const MODEL_FALLBACKS = [
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.7-flash",
  "gemini-flash-latest",
];
const RETRY_PASSES = 2;
const RETRY_DELAY_MS = 2000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableModelError = (error) => {
  const msg = error?.message || "";
  return /\[(503|429|404)/.test(msg) || /high demand|overloaded|no longer available|not found/i.test(msg);
};

async function generateWithFallback(prompt) {
  let lastError;
  for (let pass = 0; pass < RETRY_PASSES; pass++) {
    if (pass > 0) await sleep(RETRY_DELAY_MS);
    for (const modelName of MODEL_FALLBACKS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        await recordGeminiCall({ model: modelName, ok: true });
        return text;
      } catch (error) {
        lastError = error;
        await recordGeminiCall({ model: modelName, ok: false, error });
        console.warn(`Gemini model ${modelName} failed: ${error.message}`);
        if (!isRetryableModelError(error)) throw error;
      }
    }
  }
  throw lastError;
}

export async function generateBlogContent(title, category = "", tags = []) {
  try {
    if (!title || title.trim().length === 0) {
      throw new Error("Title is required to generate content");
    }

    // Create a detailed prompt for blog content generation
    const prompt = `
Write a comprehensive blog post with the title: "${title}"

${category ? `Category: ${category}` : ""}
${tags.length > 0 ? `Tags: ${tags.join(", ")}` : ""}

Requirements:
- Write engaging, informative content that matches the title
- Use proper HTML formatting with headers (h2, h3), paragraphs, lists, and emphasis
- Include 3-5 main sections with clear subheadings
- Write in a conversational yet professional tone
- Make it approximately 800-1200 words
- Include practical insights, examples, or actionable advice where relevant
- Use <h2> for main sections and <h3> for subsections
- Use <p> tags for paragraphs
- Use <ul> and <li> for bullet points when appropriate
- Use <strong> and <em> for emphasis
- Ensure the content is original and valuable to readers

Do not include the title in the content as it will be added separately.
Start directly with the introduction paragraph.
`;

    const content = await generateWithFallback(prompt);

    // Basic validation
    if (!content || content.trim().length < 100) {
      throw new Error("Generated content is too short or empty");
    }

    return {
      success: true,
      content: content.trim(),
    };
  } catch (error) {
    console.error("Gemini AI Error:", error);

    // Handle specific error types
    if (error.message?.includes("API key")) {
      return {
        success: false,
        error: "AI service configuration error. Please try again later.",
      };
    }

    if (
      error.message?.includes("quota") ||
      error.message?.includes("limit") ||
      error.message?.includes("high demand") ||
      error.message?.includes("503")
    ) {
      return {
        success: false,
        error: "AI service is temporarily unavailable. Please try again later.",
      };
    }

    return {
      success: false,
      error: error.message || "Failed to generate content. Please try again.",
    };
  }
}

export async function improveContent(
  currentContent,
  improvementType = "enhance"
) {
  try {
    if (!currentContent || currentContent.trim().length === 0) {
      throw new Error("Content is required for improvement");
    }

    let prompt = "";

    switch (improvementType) {
      case "expand":
        prompt = `
Take this blog content and expand it with more details, examples, and insights:

${currentContent}

Requirements:
- Keep the existing structure and main points
- Add more depth and detail to each section
- Include practical examples and insights
- Maintain the original tone and style
- Return the improved content in the same HTML format
`;
        break;

      case "simplify":
        prompt = `
Take this blog content and make it more concise and easier to read:

${currentContent}

Requirements:
- Keep all main points but make them clearer
- Remove unnecessary complexity
- Use simpler language where possible
- Maintain the HTML formatting
- Keep the essential information
`;
        break;

      default: // enhance
        prompt = `
Improve this blog content by making it more engaging and well-structured:

${currentContent}

Requirements:
- Improve the flow and readability
- Add engaging transitions between sections
- Enhance with better examples or explanations
- Maintain the original HTML structure
- Keep the same length approximately
- Make it more compelling to read
`;
    }

    const improvedContent = await generateWithFallback(prompt);

    return {
      success: true,
      content: improvedContent.trim(),
    };
  } catch (error) {
    console.error("Content improvement error:", error);
    return {
      success: false,
      error: error.message || "Failed to improve content. Please try again.",
    };
  }
}
