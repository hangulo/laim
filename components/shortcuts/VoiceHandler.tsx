"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { useActions } from "./ActionContext";
import type { ActionId } from "./actions";

const PHRASES: [string[], ActionId][] = [
  [["archive", "done", "dismiss"], "archive"],
  [["reply all", "reply-all"], "replyAll"],
  [["reply"], "reply"],
  [["forward"], "forward"],
  [["next email", "next"], "next"],
  [["previous email", "previous", "older", "back"], "prev"],
  [["new email", "new message", "compose", "write"], "compose"],
  [["mark unread", "unread"], "markUnread"],
  [["star", "flag"], "star"],
  [["go to inbox", "inbox"], "goInbox"],
  [["go to dashboard", "dashboard"], "goDashboard"],
];

function matchPhrase(transcript: string): ActionId | null {
  const lower = transcript.toLowerCase().trim();
  for (const [phrases, id] of PHRASES) {
    for (const phrase of phrases) {
      if (lower.includes(phrase)) return id;
    }
  }
  return null;
}

// Minimal types for the Web Speech API (not in standard TypeScript lib)
interface ISpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface ISpeechRecognitionCtor {
  new(): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionCtor;
    webkitSpeechRecognition?: ISpeechRecognitionCtor;
  }
}

export function VoiceHandler() {
  const listening = useApp((s) => s.voiceListening);
  const { dispatch } = useActions();
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (e) => {
        const transcript = e.results[e.results.length - 1]?.[0]?.transcript ?? "";
        const id = matchPhrase(transcript);
        if (id) dispatch(id);
      };

      recognition.onerror = () => {
        useApp.getState().toggleVoice();
      };

      recognition.onend = () => {
        // Browser stops on silence — restart if still supposed to be listening
        if (useApp.getState().voiceListening) {
          try { recognition.start(); } catch { /* already started */ }
        }
      };

      recognitionRef.current = recognition;
      try { recognition.start(); } catch { /* already started */ }
    } else {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    }

    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, [listening, dispatch]);

  if (!listening) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-lg">
      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
      Listening…
      <button
        onClick={() => useApp.getState().toggleVoice()}
        className="ml-0.5 rounded-full p-0.5 hover:bg-red-400 transition-colors"
        aria-label="Stop voice input"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
