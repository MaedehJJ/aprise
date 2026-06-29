"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send } from "lucide-react";
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
      <div className="max-w-3xl mx-auto rounded-2xl border border-border/40 bg-muted/25 backdrop-blur-sm px-4 pt-3 pb-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/25 transition-all duration-200">
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
          className="w-full min-h-[72px] max-h-40 text-sm text-foreground placeholder:text-muted-foreground/50 bg-transparent focus:outline-none resize-none disabled:opacity-50 leading-relaxed"
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground/40">
            {rateLimited ? "Please wait before retrying" : "Shift+Enter for new line"}
          </p>

          <div className="flex items-center gap-1.5">
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                disabled={isDisabled}
                title={listening ? "Stop recording" : "Voice input"}
                className={cn(
                  "relative w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150",
                  listening
                    ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
                  isDisabled && !listening && "opacity-40 cursor-not-allowed pointer-events-none"
                )}
              >
                {listening && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                )}
                <Mic className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={onSend}
              disabled={!value.trim() || isDisabled}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150",
                value.trim() && !isDisabled
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
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
    </div>
  );
}
