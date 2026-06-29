"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSpeechRecognitionCtor, type BrowserSpeechRecognition } from "./chat-shared";

export function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  rateLimited = false,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  rateLimited?: boolean;
  placeholder: string;
}) {
  const isDisabled = sending || rateLimited;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognitionCtor()));
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 72), 160)}px`;
  }, [value]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) {
        onChange(value ? `${value.trimEnd()} ${transcript.trim()}` : transcript.trim());
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <div className="p-4 border-t border-border/60 shrink-0">
      <div className="max-w-3xl mx-auto rounded-2xl border border-border/40 bg-muted/25 backdrop-blur-sm px-4 py-3 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/25 transition-all duration-200">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isDisabled) onSend();
              }
            }}
            placeholder={rateLimited ? "Rate limited — please wait…" : placeholder}
            rows={3}
            disabled={isDisabled}
            className="flex-1 min-h-[72px] max-h-40 text-sm text-foreground placeholder:text-muted-foreground/50 bg-transparent focus:outline-none resize-none py-1 disabled:opacity-50 leading-relaxed"
          />
          <div className="flex flex-col gap-1.5 shrink-0 pb-0.5">
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                disabled={isDisabled}
                title={listening ? "Stop listening" : "Voice input"}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150",
                  listening
                    ? "bg-red-100 text-red-600 ring-2 ring-red-200 animate-pulse"
                    : "bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {listening ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onSend}
              disabled={!value.trim() || isDisabled}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150",
                value.trim() && !sending
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
        {voiceSupported
          ? "Shift+Enter for a new line · Mic for voice input"
          : "Shift+Enter for a new line"}
      </p>
    </div>
  );
}
