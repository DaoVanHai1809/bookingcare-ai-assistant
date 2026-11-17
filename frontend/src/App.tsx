import { useEffect, useRef, useState } from "react";
import "./App.css";

// ===== Kiểu dữ liệu theo contract backend =====

type DoctorItem = {
  id: string | number;
  name: string;
  specialties: string[] | string;
  facilityName: string;
  address: string;
  priceMin: number | null;
  priceMax: number | null;
  imageUrl: string | null;
};

type FacilityItem = {
  id?: string | number;
  name: string;
  address?: string;
  specialties?: string[] | string;
  imageUrl?: string | null;
};

type SlotItem = {
  slotId: string | number;
  doctorId: string | number;
  date: string; // YYYY-MM-DD
  time: string; // "09:00 - 09:30"
  available: boolean;
};

type BookingItem = {
  bookingId: string;
  doctorName: string;
  facilityName: string;
  date: string;
  time: string;
  status: string;
};

type CardsGroup =
  | { type: "doctors"; items: DoctorItem[] }
  | { type: "facilities"; items: FacilityItem[] }
  | { type: "slots"; items: SlotItem[] }
  | { type: "booking"; items: BookingItem[] };

type Usage = { inputTokens: number; outputTokens: number };

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  cards: CardsGroup[];
  usage?: Usage;
  latencyMs?: number;
  error?: boolean;
};

const API_URL = "http://localhost:3001/api/chat";

const SUGGESTIONS = [
  "Tôi bị đau đầu, nên khám ở đâu?",
  "Tìm bác sĩ tim mạch ở Hà Nội",
  "Đặt lịch khám da liễu cuối tuần này",
];

// ===== Hàm tiện ích =====

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** "2026-11-18" -> "18/11/2026" */
function formatDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function formatPrice(min: number | null, max: number | null): string | null {
  const fmt = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((min ?? max) as number);
}

function formatLatency(ms?: number): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} giây`;
}

function joinSpecialties(s: string[] | string | undefined): string {
  if (!s) return "";
  return Array.isArray(s) ? s.join(", ") : s;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const last = words[words.length - 1] ?? "";
  const first = words[0] ?? "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

// ===== Thẻ hiển thị =====

function DoctorCard({ doctor }: { doctor: DoctorItem }) {
  const price = formatPrice(doctor.priceMin, doctor.priceMax);
  return (
    <div className="card doctor-card">
      {doctor.imageUrl ? (
        <img className="doctor-avatar" src={doctor.imageUrl} alt={doctor.name} />
      ) : (
        <div className="doctor-avatar doctor-avatar-placeholder">{initials(doctor.name)}</div>
      )}
      <div className="doctor-info">
        <div className="doctor-name">{doctor.name}</div>
        {joinSpecialties(doctor.specialties) && (
          <div className="doctor-line">🩺 {joinSpecialties(doctor.specialties)}</div>
        )}
        {doctor.facilityName && <div className="doctor-line">🏥 {doctor.facilityName}</div>}
        {doctor.address && <div className="doctor-line">📍 {doctor.address}</div>}
        {price && <div className="doctor-price">Giá khám: {price}</div>}
      </div>
    </div>
  );
}

function FacilityCard({ facility }: { facility: FacilityItem }) {
  return (
    <div className="card facility-card">
      {facility.imageUrl ? (
        <img className="doctor-avatar" src={facility.imageUrl} alt={facility.name} />
      ) : (
        <div className="doctor-avatar doctor-avatar-placeholder">🏥</div>
      )}
      <div className="doctor-info">
        <div className="doctor-name">{facility.name}</div>
        {joinSpecialties(facility.specialties) && (
          <div className="doctor-line">🩺 {joinSpecialties(facility.specialties)}</div>
        )}
        {facility.address && <div className="doctor-line">📍 {facility.address}</div>}
      </div>
    </div>
  );
}

function SlotsGroup({
  slots,
  disabled,
  onPick,
}: {
  slots: SlotItem[];
  disabled: boolean;
  onPick: (slot: SlotItem) => void;
}) {
  const byDate = new Map<string, SlotItem[]>();
  for (const s of slots) {
    const arr = byDate.get(s.date) ?? [];
    arr.push(s);
    byDate.set(s.date, arr);
  }
  return (
    <div className="slots-group">
      {[...byDate.entries()].map(([date, daySlots]) => (
        <div key={date} className="slots-day">
          <div className="slots-date">📅 {formatDate(date)}</div>
          <div className="slots-row">
            {daySlots.map((slot) => (
              <button
                key={String(slot.slotId)}
                className="slot-btn"
                disabled={!slot.available || disabled}
                onClick={() => onPick(slot)}
                title={slot.available ? "Bấm để đặt lịch khung giờ này" : "Khung giờ đã hết chỗ"}
              >
                {slot.time}
                {!slot.available && <span className="slot-full">Hết chỗ</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingCard({ booking }: { booking: BookingItem }) {
  return (
    <div className="card booking-card">
      <div className="booking-title">✅ Đặt lịch thành công</div>
      <div className="booking-rows">
        <div>
          <span>Mã đặt lịch:</span> <strong>{booking.bookingId}</strong>
        </div>
        <div>
          <span>Bác sĩ:</span> <strong>{booking.doctorName}</strong>
        </div>
        <div>
          <span>Cơ sở:</span> <strong>{booking.facilityName}</strong>
        </div>
        <div>
          <span>Thời gian:</span>{" "}
          <strong>
            {formatDate(booking.date)} · {booking.time}
          </strong>
        </div>
        <div>
          <span>Trạng thái:</span> <span className="booking-status">{booking.status}</span>
        </div>
      </div>
    </div>
  );
}

function CardsView({
  group,
  sending,
  onPickSlot,
}: {
  group: CardsGroup;
  sending: boolean;
  onPickSlot: (slot: SlotItem) => void;
}) {
  switch (group.type) {
    case "doctors":
      return (
        <div className="cards-list">
          {group.items.map((d) => (
            <DoctorCard key={String(d.id)} doctor={d} />
          ))}
        </div>
      );
    case "facilities":
      return (
        <div className="cards-list">
          {group.items.map((f, i) => (
            <FacilityCard key={String(f.id ?? i)} facility={f} />
          ))}
        </div>
      );
    case "slots":
      return <SlotsGroup slots={group.items} disabled={sending} onPick={onPickSlot} />;
    case "booking":
      return (
        <div className="cards-list">
          {group.items.map((b) => (
            <BookingCard key={b.bookingId} booking={b} />
          ))}
        </div>
      );
    default:
      return null;
  }
}

// ===== SSE =====

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

// ===== App =====

export default function App() {
  const [sessionId] = useState<string>(createSessionId);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      content:
        "Xin chào! Tôi là trợ lý AI hỗ trợ tìm bác sĩ, cơ sở y tế và đặt lịch khám. Bạn đang gặp vấn đề sức khỏe gì, hoặc muốn tìm bác sĩ chuyên khoa nào?",
      cards: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const hasUserMessage = messages.some((m) => m.role === "user");

  function findDoctorName(doctorId: string | number): string | null {
    for (const m of messages) {
      for (const g of m.cards) {
        if (g.type === "doctors") {
          const found = g.items.find((d) => String(d.id) === String(doctorId));
          if (found) return found.name;
        }
      }
    }
    return null;
  }

  function handlePickSlot(slot: SlotItem) {
    const name = findDoctorName(slot.doctorId);
    const dateText = formatDate(slot.date);
    const text = name
      ? `Tôi muốn đặt lịch với bác sĩ ${name} vào ${dateText} lúc ${slot.time}`
      : `Tôi muốn đặt lịch vào ${dateText} lúc ${slot.time}`;
    void sendMessage(text);
  }

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || sending) return;

    const userMsg: Message = { id: nextId.current++, role: "user", content: text, cards: [] };
    const assistantId = nextId.current++;
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      cards: [],
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSending(true);

    const patchAssistant = (patch: (m: Message) => Message) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? patch(m) : m)));

    const handleBlock = (block: string) => {
      const parsed = parseSseBlock(block);
      if (!parsed) return;
      let data: unknown;
      try {
        data = JSON.parse(parsed.data);
      } catch {
        return;
      }
      if (parsed.event === "token") {
        const t = (data as { text?: string }).text ?? "";
        if (t) patchAssistant((m) => ({ ...m, content: m.content + t }));
      } else if (parsed.event === "cards") {
        const group = data as CardsGroup;
        patchAssistant((m) => ({ ...m, cards: [...m.cards, group] }));
      } else if (parsed.event === "done") {
        const d = data as { usage?: Usage; latencyMs?: number };
        patchAssistant((m) => ({ ...m, usage: d.usage, latencyMs: d.latencyMs }));
      }
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        for (const block of blocks) handleBlock(block);
      }
      if (buffer.trim()) handleBlock(buffer);
    } catch {
      patchAssistant((m) => ({
        ...m,
        error: true,
        content:
          m.content ||
          "⚠️ Không kết nối được với máy chủ trợ lý. Bạn vui lòng kiểm tra lại kết nối rồi thử lại sau ít phút nhé.",
      }));
    } finally {
      setSending(false);
    }
  }

  function handleSubmit() {
    void sendMessage(input);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Trợ lý AI đặt lịch khám</h1>
        <p>Tìm bác sĩ, cơ sở y tế và đặt lịch khám nhanh chóng</p>
      </header>

      <main className="chat-area">
        {messages.map((m) => (
          <div key={m.id} className={`msg-row ${m.role}`}>
            {m.role === "user" ? (
              <div className="bubble user-bubble">{m.content}</div>
            ) : (
              <div className="assistant-block">
                {(m.content || m.error) && (
                  <div className={`bubble assistant-bubble${m.error ? " error" : ""}`}>
                    {m.content}
                  </div>
                )}
                {!m.content && !m.error && sending && (
                  <div className="bubble assistant-bubble typing">
                    Đang trả lời<span className="typing-dots">…</span>
                  </div>
                )}
                {m.cards.map((group, i) => (
                  <CardsView
                    key={i}
                    group={group}
                    sending={sending}
                    onPickSlot={handlePickSlot}
                  />
                ))}
                {m.usage && (
                  <div className="msg-meta">
                    ⏱ Phản hồi trong {formatLatency(m.latencyMs)} · Token:{" "}
                    {m.usage.inputTokens.toLocaleString("vi-VN")} vào /{" "}
                    {m.usage.outputTokens.toLocaleString("vi-VN")} ra
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      {!hasUserMessage && (
        <div className="suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => void sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <footer className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Nhập tin nhắn… (ví dụ: Tôi bị đau đầu, muốn khám ở Hà Nội)"
          rows={1}
          disabled={sending}
        />
        <button className="send-btn" onClick={handleSubmit} disabled={sending || !input.trim()}>
          {sending ? "Đang gửi…" : "Gửi"}
        </button>
      </footer>
    </div>
  );
}
