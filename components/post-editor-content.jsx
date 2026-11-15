"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import VoiceInputButton from "./voice-input-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageIcon, Sparkles, Wand2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { cleanStreamedHtml, htmlTextLength } from "@/lib/blog-ai";
import { BarLoader } from "react-spinners";

// next/dynamic does not reliably forward refs, so pass the ref through an
// explicit prop. The parent needs the Quill instance to insert images.
const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import("react-quill-new");
    const QuillWithRef = ({ forwardedRef, ...props }) => (
      <RQ ref={forwardedRef} {...props} />
    );
    return QuillWithRef;
  },
  { ssr: false }
);

if (typeof window !== "undefined") {
  import("react-quill-new/dist/quill.snow.css");
}

const quillConfig = {
  modules: {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        [{ size: ["small", false, "large", "huge"] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        ["link", "blockquote", "code-block"],
        [
          { list: "ordered" },
          { list: "bullet" },
          { indent: "-1" },
          { indent: "+1" },
        ],
        ["image", "video"],
      ],
      handlers: { image: function () {} },
    },
  },
  formats: [
    "header",
    "size",
    "bold",
    "italic",
    "underline",
    "strike",
    "color",
    "background",
    "align",
    "link",
    "blockquote",
    "code-block",
    "list",
    "indent",
    "image",
    "video",
  ],
};

export default function PostEditorContent({
  form,
  setQuillRef,
  onImageUpload,
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const watchedValues = watch();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);

  // Keep the latest callback in a ref so the modules object never changes.
  // react-quill-new deep-compares `modules`; a new handler function on every
  // render made it destroy and rebuild the editor each time, losing the
  // cursor position (so inserted images landed in the wrong place).
  const onImageUploadRef = useRef(onImageUpload);
  useEffect(() => {
    onImageUploadRef.current = onImageUpload;
  }, [onImageUpload]);

  // Keep a local handle on the editor (for voice input) and still pass it up
  const localQuillRef = useRef(null);
  const handleQuillRef = useCallback(
    (instance) => {
      localQuillRef.current = instance;
      setQuillRef(instance);
    },
    [setQuillRef]
  );

  // Insert dictated text at the cursor (or at the end) as editable text
  const handleTranscript = (text) => {
    const clean = text.trim();
    if (!clean) return;
    const quill = localQuillRef.current?.getEditor?.();
    if (!quill) {
      const paragraphs = clean
        .split(/\n+/)
        .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
        .join("");
      const current = watchedValues.content && watchedValues.content !== "<p><br></p>" ? watchedValues.content : "";
      setValue("content", current + paragraphs);
      return;
    }
    const range = quill.getSelection(true);
    const index = range ? range.index : Math.max(0, quill.getLength() - 1);
    const before = index > 0 ? quill.getText(index - 1, 1) : "\n";
    const insert = (before === "\n" ? "" : " ") + clean;
    quill.insertText(index, insert, "user");
    quill.setSelection(index + insert.length);
    setValue("content", quill.root.innerHTML);
  };

  const quillModules = useMemo(
    () => ({
      ...quillConfig.modules,
      toolbar: {
        ...quillConfig.modules.toolbar,
        handlers: { image: () => onImageUploadRef.current("content") },
      },
    }),
    []
  );

  const handleAI = async (type, improvementType = null) => {
    const { title, content, category, tags } = watchedValues;

    if (type === "generate") {
      if (!title?.trim())
        return toast.error("Please add a title before generating content");
      if (
        content &&
        content !== "<p><br></p>" &&
        !window.confirm("This will replace your existing content. Continue?")
      )
        return;
      setIsGenerating(true);
    } else {
      if (!content || content === "<p><br></p>")
        return toast.error("Please add some content before improving it");
      setIsImproving(true);
    }

    const original = content || "";
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "generate"
            ? { mode: "generate", title, category: category || undefined, tags: tags || [] }
            : { mode: "improve", content, improvementType }
        ),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${type} content. Please try again.`);
      }

      // Show the text in the editor as it arrives (about every 120 ms)
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      let lastPaint = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        if (Date.now() - lastPaint > 120) {
          setValue("content", cleanStreamedHtml(text));
          lastPaint = Date.now();
        }
      }
      text += decoder.decode();

      const finalHtml = cleanStreamedHtml(text).trim();
      if (htmlTextLength(finalHtml) < 50) throw new Error("The AI returned too little content. Please try again.");
      setValue("content", finalHtml);
      toast.success(`Content ${type === "generate" ? "generated" : improvementType + "d"} successfully!`);
    } catch (error) {
      setValue("content", original); // keep the user's text if anything failed
      toast.error(error.message || `Failed to ${type} content. Please try again.`);
    } finally {
      type === "generate" ? setIsGenerating(false) : setIsImproving(false);
    }
  };

  const hasTitle = watchedValues.title?.trim();
  const hasContent =
    watchedValues.content && watchedValues.content !== "<p><br></p>";

  return (
    <>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-5">
          {/* Featured Image */}
          {watchedValues.featuredImage ? (
            <div className="relative group">
              <img
                src={watchedValues.featuredImage}
                alt="Featured"
                className="w-full h-80 object-cover rounded-xl"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center space-x-3">
                <Button
                  onClick={() => onImageUpload("featured")}
                  variant="secondary"
                  size="sm"
                >
                  Change Image
                </Button>
                <Button
                  onClick={() => setValue("featuredImage", "")}
                  variant="destructive"
                  size="sm"
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onImageUpload("featured")}
              className="w-full h-36 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center space-y-4 hover:border-slate-500 transition-colors group"
            >
              <ImageIcon className="h-12 w-12 text-slate-400 group-hover:text-slate-300" />
              <div className="text-center">
                <p className="text-slate-300 text-lg font-medium">
                  Add a featured image
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  Upload and transform with AI
                </p>
              </div>
            </button>
          )}

          {/* Title */}
          <div>
            <Input
              {...register("title")}
              placeholder="Post title..."
              className="border-0 text-4xl font-bold bg-transparent placeholder:text-slate-500 text-white p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ fontSize: "2.5rem", lineHeight: "1.2" }}
            />
            {errors.title && (
              <p className="text-red-400 mt-2">{errors.title.message}</p>
            )}
          </div>

          {/* AI Tools */}
          <div>
            {!hasContent ? (
              <Button
                onClick={() => handleAI("generate")}
                disabled={!hasTitle || isGenerating || isImproving}
                variant="outline"
                size="sm"
                className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white disabled:opacity-50 w-full"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Content with AI
              </Button>
            ) : (
              <div className="grid grid-cols-3 w-full gap-2">
                {[
                  { type: "enhance", icon: Sparkles, color: "green" },
                  { type: "expand", icon: Plus, color: "blue" },
                  { type: "simplify", icon: Minus, color: "orange" },
                ].map(({ type, icon: Icon, color }) => (
                  <Button
                    key={type}
                    onClick={() => handleAI("improve", type)}
                    disabled={isGenerating || isImproving}
                    variant="outline"
                    size="sm"
                    className={`border-${color}-500 text-${color}-400 hover:bg-${color}-500 hover:text-white disabled:opacity-50`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    AI {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            )}
            {!hasTitle && (
              <p className="text-xs text-slate-400 w-full pt-2">
                Add a title to enable AI content generation
              </p>
            )}

            {/* Voice input: dictate text, then edit or use the AI buttons above */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
              <p className="text-xs text-slate-400">
                Speak your ideas. The text is added at the cursor, then use AI Expand or Enhance to turn it into a blog.
              </p>
              <VoiceInputButton onTranscript={handleTranscript} disabled={isGenerating || isImproving} />
            </div>
          </div>

          {(isGenerating || isImproving) && (
            <BarLoader width={"95%"} color="#D8B4FE" />
          )}

          {/* Editor */}
          <div className="prose prose-lg max-w-none">
            <ReactQuill
              forwardedRef={handleQuillRef}
              readOnly={isGenerating || isImproving}
              theme="snow"
              value={watchedValues.content}
              onChange={(content) => setValue("content", content)}
              modules={quillModules}
              formats={quillConfig.formats}
              placeholder="Tell your story... or use AI to generate content!"
              style={{
                minHeight: "400px",
                fontSize: "1.125rem",
                lineHeight: "1.7",
              }}
            />
            {errors.content && (
              <p className="text-red-400 mt-2">{errors.content.message}</p>
            )}
          </div>
        </div>
      </main>

      <style jsx global>{`
        .ql-editor {
          color: white !important;
          font-size: 1.125rem !important;
          line-height: 1.7 !important;
          padding: 0 !important;
          min-height: 400px !important;
        }
        .ql-editor::before {
          color: rgb(100, 116, 139) !important;
        }
        .ql-toolbar {
          border: none !important;
          padding: 0 0 1rem 0 !important;
          position: sticky !important;
          top: calc(80px + var(--dev-bar-h, 0px)) !important;
          background: rgb(15, 23, 42) !important;
          z-index: 30 !important;
          border-radius: 8px !important;
          margin-bottom: 1rem !important;
        }
        .ql-container {
          border: none !important;
        }
        .ql-snow .ql-tooltip {
          background: rgb(30, 41, 59) !important;
          border: 1px solid rgb(71, 85, 105) !important;
          color: white !important;
        }
        .ql-snow .ql-picker {
          color: white !important;
        }
        .ql-snow .ql-picker-options {
          background: rgb(30, 41, 59) !important;
          border: 1px solid rgb(71, 85, 105) !important;
        }
        .ql-snow .ql-fill,
        .ql-snow .ql-stroke.ql-fill {
          fill: white !important;
        }
        .ql-snow .ql-stroke {
          stroke: white !important;
        }
        .ql-editor h2 {
          font-size: 2rem !important;
          font-weight: 600 !important;
          color: white !important;
        }
        .ql-editor h3 {
          font-size: 1.5rem !important;
          font-weight: 600 !important;
          color: white !important;
        }
        .ql-editor blockquote {
          border-left: 4px solid rgb(147, 51, 234) !important;
          color: rgb(203, 213, 225) !important;
          padding-left: 1rem !important;
          font-style: italic !important;
        }
        .ql-editor a {
          color: rgb(147, 51, 234) !important;
        }
        .ql-editor code {
          background: rgb(51, 65, 85) !important;
          color: rgb(248, 113, 113) !important;
          padding: 0.125rem 0.25rem !important;
          border-radius: 0.25rem !important;
        }
      `}</style>
    </>
  );
}
