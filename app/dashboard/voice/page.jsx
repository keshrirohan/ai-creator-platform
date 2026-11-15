"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  Mic,
  RotateCcw,
  Save,
  Sparkles,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { generateBlogFromTranscript } from "@/app/actions/voice-to-blog";
import {
  MAX_RECORDING_SECONDS,
  MAX_TRANSCRIPT_CHARS,
  VOICE_LANGUAGES,
  sanitizeBlogHtml,
  validateAudio,
  validateTranscript,
} from "@/lib/voice-to-blog";

// Preferred recording formats, in order (Chrome/Edge, Firefox, Safari)
const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const micErrorMessage = (error) => {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access was blocked. Allow it from the icon in your browser's address bar, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Connect one and try again.";
    case "NotReadableError":
      return "Your microphone is in use by another app. Close it and try again.";
    default:
      return "Couldn't start recording. Please try again.";
  }
};

export default function VoiceToBlogPage() {
  const router = useRouter();

  const [language, setLanguage] = useState("auto");
  const [blogLanguage, setBlogLanguage] = useState("same");
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [blog, setBlog] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const { data: existingDraft } = useConvexQuery(api.posts.getUserDraft);
  const { mutate: createPost } = useConvexMutation(api.posts.create);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setIsRecording(false);
  }, []);

  // Release the microphone and timers if the user leaves the page mid-recording
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopStream();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Stop automatically at the recording limit
  useEffect(() => {
    if (isRecording && seconds >= MAX_RECORDING_SECONDS) {
      stopRecording();
      toast.info("Reached the 5-minute limit. Recording stopped.");
    }
  }, [isRecording, seconds, stopRecording]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return toast.error("Your browser doesn't support recording. Try the latest Chrome, Edge, Firefox or Safari.");
    }
    if (!window.isSecureContext) {
      return toast.error("The microphone only works on a secure (https) connection.");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mimeType = RECORDING_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
      // 32 kbps keeps 5 minutes of speech around 1.2 MB
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32000,
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };
      recorder.onerror = () => {
        toast.error("Recording stopped because of an error. Please try again.");
        stopRecording();
      };

      recorderRef.current = recorder;
      recorder.start(1000);

      setAudioBlob(null);
      setAudioUrl(null);
      setSeconds(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (error) {
      stopStream();
      toast.error(micErrorMessage(error));
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setSeconds(0);
  };

  const transcribe = async () => {
    const invalid = validateAudio({ type: audioBlob?.type, size: audioBlob?.size });
    if (invalid) return toast.error(invalid);

    setIsTranscribing(true);
    try {
      const ext = audioBlob.type.includes("ogg") ? "ogg" : audioBlob.type.includes("mp4") ? "m4a" : "webm";
      const formData = new FormData();
      formData.append("audio", audioBlob, `recording.${ext}`);
      formData.append("language", language);

      const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || (res.status === 413 ? "Recording is too large" : "Transcription failed"));
      }
      setTranscript(data.transcript);
      setDetectedLanguage(data.language || "");
      setBlog(null);
      toast.success("Transcription ready. You can edit it before generating the blog.");
    } catch (error) {
      toast.error(error.message || "Transcription failed. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const generateBlog = async () => {
    const invalid = validateTranscript(transcript);
    if (invalid) return toast.error(invalid);

    setIsGenerating(true);
    try {
      const result = await generateBlogFromTranscript(transcript, blogLanguage);
      if (!result.success) throw new Error(result.error);
      setBlog({ title: result.title, content: result.content });
      toast.success("Blog generated!");
    } catch (error) {
      toast.error(error.message || "Couldn't generate the blog. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = async () => {
    if (!blog?.title.trim()) return toast.error("Please add a title");
    if (
      existingDraft &&
      !window.confirm("You already have a draft. Saving will replace it with this blog. Continue?")
    ) {
      return;
    }

    setIsSaving(true);
    try {
      // The existing posts system keeps one draft per user; the editor opens it
      await createPost({
        title: blog.title.trim().slice(0, 200),
        content: blog.content,
        status: "draft",
        tags: [],
      });
      toast.success("Draft saved. Opening the editor…");
      router.push("/dashboard/create");
    } catch {
      // useConvexMutation already shows the error toast
      setIsSaving(false);
    }
  };

  const busy = isRecording || isTranscribing || isGenerating || isSaving;

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text-primary flex items-center gap-3">
          <Mic className="h-8 w-8 text-purple-400" />
          Voice to Blog
        </h1>
        <p className="text-slate-400 mt-2">
          Speak your ideas, check the transcript, and turn it into a structured blog draft
        </p>
      </div>

      {/* Step 1: Record */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-white">1. Record</CardTitle>
          <CardDescription>Up to 5 minutes. Speak clearly, close to the microphone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-xs space-y-2">
            <Label className="text-white">Spoken language</Label>
            <Select value={language} onValueChange={setLanguage} disabled={busy}>
              <SelectTrigger className="w-full bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {isRecording ? (
              <Button onClick={stopRecording} variant="destructive" size="lg">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={startRecording}
                variant="primary"
                size="lg"
                disabled={isTranscribing || isGenerating || isSaving}
              >
                <Mic className="h-4 w-4 mr-2" />
                {audioBlob ? "Record again" : "Start recording"}
              </Button>
            )}

            {(isRecording || audioBlob) && (
              <span className="flex items-center gap-2 text-sm text-slate-300" aria-live="polite">
                {isRecording && <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />}
                {formatTime(seconds)} / {formatTime(MAX_RECORDING_SECONDS)}
              </span>
            )}
          </div>

          {audioUrl && !isRecording && (
            <div className="flex flex-wrap items-center gap-3">
              <audio controls src={audioUrl} className="w-full max-w-md" />
              <Button variant="outline" onClick={resetRecording} disabled={busy}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <Button variant="primary" onClick={transcribe} disabled={busy}>
                {isTranscribing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {isTranscribing ? "Transcribing…" : "Transcribe"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Transcript */}
      {(transcript || isTranscribing) && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-white flex flex-wrap items-center gap-2">
              2. Transcript
              {detectedLanguage && (
                <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                  {detectedLanguage}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Fix any words the transcription got wrong</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={10}
              placeholder={isTranscribing ? "Transcribing…" : ""}
              disabled={isTranscribing}
              className="bg-slate-800 border-slate-600 text-white min-h-56"
              aria-label="Transcript"
            />
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2 w-full sm:w-64">
                <Label className="text-white">Write the blog in</Label>
                <Select value={blogLanguage} onValueChange={setBlogLanguage} disabled={busy}>
                  <SelectTrigger className="w-full bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same">Same as speech</SelectItem>
                    {VOICE_LANGUAGES.filter((l) => l.value !== "auto").map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {transcript.length.toLocaleString()} / {MAX_TRANSCRIPT_CHARS.toLocaleString()}
                </span>
                <Button onClick={generateBlog} variant="primary" disabled={busy || !transcript.trim()}>
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {isGenerating ? "Generating…" : blog ? "Regenerate blog" : "Generate blog"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Blog */}
      {blog && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-white">3. Your blog</CardTitle>
            <CardDescription>
              Save it as a draft to edit, add images and publish in the editor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="blog-title" className="text-white">
                Title
              </Label>
              <Input
                id="blog-title"
                value={blog.title}
                maxLength={200}
                onChange={(e) => setBlog((b) => ({ ...b, title: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white text-lg font-semibold"
              />
            </div>

            <div
              className="prose prose-lg max-w-none prose-invert prose-purple rounded-lg border border-slate-700 bg-slate-800/40 p-6 text-slate-200 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-4 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
              // Content is sanitized on the server and again here (safe tags, no attributes)
              dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(blog.content) }}
            />

            <div className="flex flex-wrap justify-end gap-3">
              {existingDraft && (
                <p className="text-xs text-amber-300 self-center">
                  This will replace your current draft “{existingDraft.title || "Untitled"}”
                </p>
              )}
              <Button onClick={saveDraft} variant="primary" disabled={busy}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isSaving ? "Saving…" : "Save draft & open editor"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
