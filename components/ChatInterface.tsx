"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/types";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
}

const QUICK_SUGGESTIONS = [
  "9:00〜19:00 働きました",
  "9:00〜22:30 働きました",
  "昨日9:00〜18:00でした",
  "今月の給与を教えて",
];

export default function ChatInterface({
  messages,
  isLoading,
  onSendMessage,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const isComposingRef = useRef(false); // IME変換中フラグ
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // IME変換中（漢字選択中）はEnterを送信に使わない
      // nativeEvent.isComposing が true の間はスキップ
      if (isComposingRef.current || e.nativeEvent.isComposing) return;
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full min-h-[500px]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          AI
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">AIアシスタント</p>
          <p className="text-xs text-green-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            オンライン
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-end gap-2 ${
              message.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {message.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1">
                AI
              </div>
            )}
            {message.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1">
                あ
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              }`}
            >
              {message.content ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : isLoading ? (
                <div className="flex items-center gap-1 py-1 px-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400 typing-dot" />
                  <div className="w-2 h-2 rounded-full bg-gray-400 typing-dot" />
                  <div className="w-2 h-2 rounded-full bg-gray-400 typing-dot" />
                </div>
              ) : null}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      <div className="px-4 pt-2 flex gap-1.5 flex-wrap">
        {QUICK_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => handleSuggestion(s)}
            disabled={isLoading}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-full px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            placeholder="例: 9:00〜19:00 働きました"
            disabled={isLoading}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
          >
            {isLoading ? (
              <span className="flex items-center gap-1">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                送信中
              </span>
            ) : (
              <>
                送信
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </>
            )}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Enterで送信 / 日本語変換中はEnterで確定→もう一度Enterで送信
        </p>
      </div>
    </div>
  );
}
