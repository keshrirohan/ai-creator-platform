// Prompts, validation and output limits for AI blog writing in the post editor.
// Prompts are kept short: same requirements as before with fewer input tokens.

export const MAX_TITLE_CHARS = 200;
export const MAX_IMPROVE_CHARS = 50_000;
export const IMPROVE_TYPES = ["enhance", "expand", "simplify"];

const HTML_RULES =
  "Output HTML only (no Markdown, no code fences): <h2> sections, <h3> subsections, <p>, <ul>/<li>, <strong>, <em>.";

export function buildGeneratePrompt({ title, category, tags = [] }) {
  const meta = [category && `Category: ${category}`, tags.length && `Tags: ${tags.join(", ")}`]
    .filter(Boolean)
    .join("\n");
  return `Write an original, engaging blog post titled "${title}".${meta ? `\n${meta}` : ""}
- 800-1200 words, conversational but professional, with practical examples or advice.
- An introduction, 3-5 sections with clear subheadings, and a conclusion.
- ${HTML_RULES}
- Do not repeat the title. Start with the introduction paragraph.`;
}

const IMPROVE_TASKS = {
  enhance: "Make it more engaging and better structured: improve flow, transitions and examples. Keep about the same length.",
  expand: "Expand it with more detail, examples and insights. Keep the structure, main points and tone.",
  simplify: "Make it clearer and more concise with simpler wording. Keep all main points.",
};

export function buildImprovePrompt({ content, improvementType }) {
  return `${IMPROVE_TASKS[improvementType]}
Keep the original language and HTML structure. ${HTML_RULES}
Return only the improved blog HTML.

<<<BLOG>>>
${content}
<<<END>>>`;
}

// Output caps: enough for the requested length, so nothing is cut off, while
// stopping runaway responses. (Billing counts tokens actually produced, not the cap.)
export function maxOutputTokensFor({ mode, content = "", improvementType }) {
  if (mode === "generate") return 4096;
  const inputTokens = Math.ceil(content.length / 3);
  const factor = improvementType === "expand" ? 2.5 : 1.5;
  return Math.min(8192, Math.max(1024, Math.ceil(inputTokens * factor)));
}

// Returns an error message, or null when the request is valid
export function validateBlogRequest(body) {
  if (!body || typeof body !== "object") return "Invalid request";
  if (body.mode === "generate") {
    if (typeof body.title !== "string" || !body.title.trim()) return "Title is required to generate content";
    if (body.title.length > MAX_TITLE_CHARS) return "Title is too long";
    if (body.category != null && (typeof body.category !== "string" || body.category.length > 50)) return "Invalid category";
    if (body.tags != null && (!Array.isArray(body.tags) || body.tags.length > 10 || body.tags.some((t) => typeof t !== "string" || t.length > 40))) {
      return "Invalid tags";
    }
    return null;
  }
  if (body.mode === "improve") {
    if (!IMPROVE_TYPES.includes(body.improvementType)) return "Invalid improvement type";
    if (typeof body.content !== "string" || !body.content.trim()) return "Content is required for improvement";
    if (body.content.length > MAX_IMPROVE_CHARS) return "Content is too long to improve";
    return null;
  }
  return "Invalid request";
}

// Strip code fences and a trailing half-written tag so partial output renders cleanly
export function cleanStreamedHtml(text = "") {
  return String(text)
    .replace(/^\s*```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .replace(/<[^>]*$/, "");
}

export const htmlTextLength = (html = "") => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().length;
