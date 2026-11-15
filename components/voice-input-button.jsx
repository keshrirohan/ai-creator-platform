"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_RECORDING_SECONDS, VOICE_LANGUAGES, validateAudio } from "@/lib/voice-transcription";

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

/** Records speech, transcribes it on the server and passes the text to onTranscript. */
export default function VoiceInputButton({ onTranscript, disabled = false }) {
  const [language, setLanguage] = useState("auto");
  const [status, setStatus] = useState("idle"); // idle | recording | transcribing
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const languageRef = useRef(language);
  languageRef.current = language;

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stop = useCallback(() => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  // Release the microphone if the editor is closed mid-recording
  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopStream();
    },
    []
  );

  useEffect(() => {
    if (status === "recording" && seconds >= MAX_RECORDING_SECONDS) {
      toast.info("Reached the 5-minute limit. Transcribing now.");
      stop();
    }
  }, [status, seconds, stop]);

  const transcribe = async (blob) => {
    const invalid = validateAudio({ type: blob.type, size: blob.size });
    if (invalid) {
      setStatus("idle");
      return toast.error(invalid);
    }

    setStatus("transcribing");
    try {
      const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
      const formData = new FormData();
      formData.append("audio", blob, `recording.${ext}`);
      formData.append("language", languageRef.current);

      const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || (res.status === 413 ? "Recording is too large" : "Transcription failed"));
      }
      onTranscript(data.transcript);
      toast.success("Speech added to your post. You can edit it now.");
    } catch (error) {
      toast.error(error.message || "Transcription failed. Please try again.");
    } finally {
      setStatus("idle");
    }
  };

  const start = async () => {
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
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopStream();
        transcribe(new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" }));
      };
      recorder.onerror = () => {
        toast.error("Recording stopped because of an error. Please try again.");
        recorder.onstop = null;
        stop();
        stopStream();
        setStatus("idle");
      };

      recorderRef.current = recorder;
      recorder.start(1000);
      setSeconds(0);
      setStatus("recording");
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (error) {
      stopStream();
      toast.error(micErrorMessage(error));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={language} onValueChange={setLanguage} disabled={status !== "idle" || disabled}>
        <SelectTrigger size="sm" className="w-40 bg-slate-800 border-slate-600 text-white" aria-label="Spoken language">
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

      {status === "recording" ? (
        <Button type="button" size="sm" variant="destructive" onClick={stop}>
          <Square className="h-4 w-4 mr-2" />
          Stop · {formatTime(seconds)}
          <span className="ml-2 h-2 w-2 rounded-full bg-white animate-pulse" aria-hidden="true" />
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={start}
          disabled={disabled || status === "transcribing"}
          className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
        >
          {status === "transcribing" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Mic className="h-4 w-4 mr-2" />
          )}
          {status === "transcribing" ? "Transcribing…" : "Speak"}
        </Button>
      )}
    </div>
  );
}
