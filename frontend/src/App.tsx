import { useEffect, useRef, useState } from "react";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

// Khung chat ban dau: tra loi mock o phia client.
// Buoc tiep theo se noi vao POST http://localhost:3001/api/chat cua backend.
function mockReply(userText: string): string {
  return (
    "(Mock) Toi da nhan duoc tin nhan: \"" +
    userText +
    "\". Tro ly AI se duoc ket noi backend o buoc tiep theo."
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      content:
        "Xin chao! Toi la tro ly AI ho tro tim kiem bac si va dat lich kham. Ban dang can kham ve van de gi?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { id: nextId.current++, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    // Mock: gia lap do tre cua API
    setTimeout(() => {
      const reply: Message = {
        id: nextId.current++,
        role: "assistant",
        content: mockReply(text),
      };
      setMessages((prev) => [...prev, reply]);
      setSending(false);
    }, 500);
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "8px 0 16px" }}>
        Tro ly AI dat lich kham — BookingCare
      </h1>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "#2563eb" : "#f1f5f9",
              color: m.role === "user" ? "#fff" : "#111",
              borderRadius: 12,
              padding: "8px 12px",
              maxWidth: "80%",
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
          </div>
        ))}
        {sending && <div style={{ color: "#666" }}>Tro ly dang tra loi...</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Nhap tin nhan... (vi du: Toi bi dau dau, muon kham o Ha Noi)"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 14,
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Gui
        </button>
      </div>
    </div>
  );
}
