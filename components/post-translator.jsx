"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Languages, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { translatePost } from "@/app/actions/translate";
import {
  TRANSLATION_LANGUAGES,
  defaultTargetLanguage,
  detectLanguage,
  languageLabel,
} from "@/lib/translation";

/**
 * Translate button + language picker for the post page.
 * The original post is never changed: the parent shows `translation` when set.
 */
export default function PostTranslator({ username, postId, originalContent, translation, onChange }) {
  const sourceLanguage = useMemo(() => detectLanguage(originalContent), [originalContent]);
  const [language, setLanguage] = useState(() => defaultTargetLanguage(sourceLanguage));
  const [isTranslating, setIsTranslating] = useState(false);
  const loaded = useRef(new Map()); // language -> translation fetched on this page

  // Use the reader's browser language as the default (only known on the client)
  useEffect(() => {
    setLanguage(defaultTargetLanguage(sourceLanguage, navigator.languages || [navigator.language]));
  }, [sourceLanguage]);

  const translate = async () => {
    if (loaded.current.has(language)) return onChange(loaded.current.get(language));

    setIsTranslating(true);
    try {
      const result = await translatePost({ username, postId, language });
      if (!result.success) throw new Error(result.error);
      const value = { title: result.title, content: result.content, language };
      loaded.current.set(language, value);
      onChange(value);
    } catch (error) {
      toast.error(error.message || "Couldn't translate this post. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/30 px-4 py-3">
      <Languages className="h-4 w-4 text-purple-400 shrink-0" aria-hidden="true" />
      <span className="text-sm text-slate-400">
        {translation
          ? `Translated to ${languageLabel(translation.language)} from ${languageLabel(sourceLanguage)}`
          : `Original language: ${languageLabel(sourceLanguage)}`}
      </span>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <Select value={language} onValueChange={setLanguage} disabled={isTranslating}>
          <SelectTrigger className="w-44 bg-slate-800 border-slate-600 text-white" aria-label="Translate to">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRANSLATION_LANGUAGES.filter((l) => l.value !== sourceLanguage).map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="primary"
          onClick={translate}
          disabled={isTranslating || translation?.language === language}
        >
          {isTranslating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Languages className="h-4 w-4 mr-2" />}
          {isTranslating ? "Translating…" : "Translate"}
        </Button>

        {translation && (
          <Button size="sm" variant="outline" onClick={() => onChange(null)} disabled={isTranslating}>
            <Undo2 className="h-4 w-4 mr-2" />
            Show original
          </Button>
        )}
      </div>
    </div>
  );
}
