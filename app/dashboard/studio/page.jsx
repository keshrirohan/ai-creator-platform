"use client";

import React, { useState } from "react";
import { ArrowDownUp, Check, Copy, Languages, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runCreatorStudio } from "@/app/actions/creator-studio";
import {
  STUDIO_ACTIONS,
  STUDIO_LANGUAGES,
  STUDIO_MAX_CHARS,
  STUDIO_TONES,
  validateStudioInput,
} from "@/lib/creator-studio";

export default function CreatorStudioPage() {
  const [text, setText] = useState("");
  const [output, setOutput] = useState("");
  const [action, setAction] = useState("translate");
  const [targetLanguage, setTargetLanguage] = useState("hindi");
  const [tone, setTone] = useState("professional");
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentAction = STUDIO_ACTIONS.find((a) => a.value === action);
  const tooLong = text.length > STUDIO_MAX_CHARS;

  const handleRun = async () => {
    const params = { text, action, targetLanguage, tone };
    const error = validateStudioInput(params);
    if (error) return toast.error(error);

    setIsRunning(true);
    try {
      const result = await runCreatorStudio(params);
      if (result.success) {
        setOutput(result.content);
        toast.success("Done!");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Please select the text and copy it manually.");
    }
  };

  // Move the result into the input to chain another action
  const handleUseOutput = () => {
    setText(output);
    setOutput("");
  };

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text-primary flex items-center gap-3">
          <Languages className="h-8 w-8 text-purple-400" />
          Creator Studio
        </h1>
        <p className="text-slate-400 mt-2">
          Translate, convert scripts, change tone and polish your writing in
          Indian languages
        </p>
      </div>

      {/* Options */}
      <Card className="card-glass">
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-white">What do you want to do?</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-full bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STUDIO_ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">{currentAction?.description}</p>
          </div>

          {action === "translate" && (
            <div className="space-y-2">
              <Label className="text-white">Translate into</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="w-full bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDIO_LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">The source language is detected automatically</p>
            </div>
          )}

          {action === "tone" && (
            <div className="space-y-2">
              <Label className="text-white">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="w-full bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDIO_TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Input / Output */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-white">Your text</CardTitle>
            <CardDescription>
              {action === "transliterate"
                ? 'Example: "aaj ka din bahut accha hai"'
                : "Paste or type the content you want to work on"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start typing…"
              rows={14}
              className="bg-slate-800 border-slate-600 text-white min-h-72"
              aria-label="Input text"
            />
            <div className="flex items-center justify-between gap-3">
              <span className={`text-xs ${tooLong ? "text-red-400" : "text-slate-500"}`}>
                {text.length.toLocaleString()} / {STUDIO_MAX_CHARS.toLocaleString()}
              </span>
              <Button
                onClick={handleRun}
                disabled={isRunning || !text.trim() || tooLong}
                variant="primary"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Working…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    {currentAction?.label}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-white">Result</CardTitle>
            <CardDescription>You can edit the result before copying it</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              placeholder={isRunning ? "Generating…" : "The result will appear here"}
              rows={14}
              className="bg-slate-800 border-slate-600 text-white min-h-72"
              aria-label="Result text"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={handleUseOutput} disabled={!output}>
                <ArrowDownUp className="h-4 w-4 mr-2" />
                Use as input
              </Button>
              <Button variant="outline" onClick={handleCopy} disabled={!output}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
