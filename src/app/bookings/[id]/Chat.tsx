"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui";

type Msg = {
  id: string;
  content: string;
  sentAt: string;
  sender: { id: string; name: string };
};

export function Chat({ bookingId, meId }: { bookingId: string; meId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch(`/api/bookings/${bookingId}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const res = await fetch(`/api/bookings/${bookingId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    setSending(false);
    if (res.ok) {
      setText("");
      load();
    }
  }

  return (
    <div>
      <div className="mb-3 max-h-72 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">No messages yet.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              "max-w-[80%] rounded-lg px-3 py-2 text-sm " +
              (m.sender.id === meId
                ? "ml-auto bg-brand-teal text-white"
                : "bg-white text-slate-800 ring-1 ring-slate-200")
            }
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" disabled={sending} className={buttonClass()}>
          Send
        </button>
      </form>
    </div>
  );
}
