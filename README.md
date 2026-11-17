# BookingCare AI Assistant — Trợ lý AI đặt lịch khám

Project trợ lý AI dựa trên LLM, giúp người dùng **tìm kiếm, hỏi đáp và đặt lịch khám** với các cơ sở y tế / bác sĩ / dịch vụ y tế, sử dụng dữ liệu công khai trên [bookingcare.vn](https://bookingcare.vn).

> Bài thực hành vòng sơ vấn vị trí **AI Product Builder** tại BookingCare.
> Trạng thái hiện tại: backend NestJS + frontend React đã nối API thật (chat streaming SSE, thẻ bác sĩ/slot, đặt lịch mô phỏng), bộ đánh giá 110 test cases đã sẵn sàng.

## Stack

- **Backend:** Node.js + TypeScript + **NestJS** + LangChain (`langchain`, `@langchain/core`, `@langchain/openai`, `@langchain/anthropic`) + **TypeORM** (SQLite mặc định, chuyển MySQL bằng `DB_TYPE=mysql`)
- **LLM:** lớp trừu tượng nhà cung cấp — chạy với OpenAI hoặc Anthropic (Claude), đổi bằng biến môi trường `LLM_PROVIDER` / `LLM_MODEL`, không sửa code
- **Frontend:** React + TypeScript + Vite
- **Đánh giá:** bộ test 100+ test cases, chấm bằng LLM as judge (thư mục `eval/`)

## Kiến trúc dự kiến

```
Người dùng ──> Frontend (React chat UI)
                    │  POST /api/chat
                    ▼
              Backend (NestJS)
                    │
                    ▼
        LangChain Agent (qua LlmModule: OpenAI / Anthropic, tool calling)
          ├── search_doctors        — tìm bác sĩ theo chuyên khoa / khu vực
          ├── search_facilities     — tìm cơ sở y tế, dịch vụ
          ├── medical_qa (RAG)      — hỏi đáp y tế trên dữ liệu đã truy xuất
          ├── check_slots           — kiểm tra lịch trống
          └── create_booking        — tạo lịch đặt khám (qua backend xác định)
                    │
          Dữ liệu: thư mục data/ (dữ liệu crawl từ bookingcare.vn,
          gồm lớp có cấu trúc cho tìm kiếm/đặt lịch và lớp văn bản cho RAG)
```

Nguyên tắc thiết kế: LLM chỉ quyết định gọi tool nào và diễn giải kết quả; các thao tác như kiểm tra lịch trống, tạo booking do backend xử lý bằng logic xác định (kiểm tra dữ liệu, chống đặt trùng).

### Giới hạn theo đề bài

- Model: theo giới hạn của đề (ChatGPT hoặc Claude), mức reasoning tối đa medium
- Thời gian phản hồi: trung bình ≤ 10 giây / lượt hội thoại
- Token: trung bình ≤ 30k input token và ≤ 500 output token / lượt
- Cách đáp ứng: giới hạn `maxTokens`, chỉ đưa top-k kết quả truy xuất vào ngữ cảnh, tóm tắt lịch sử hội thoại dài, giới hạn số vòng gọi tool, streaming và cache tìm kiếm phổ biến

## Cấu trúc thư mục

```
bookingcare-ai-assistant/
├── backend/    # API + LangChain agent (NestJS + TypeORM, TypeScript)
├── frontend/   # Giao diện chat (React + Vite)
├── eval/       # Bộ test cases + script chấm LLM as judge + báo cáo
├── data/       # Dữ liệu crawl từ bookingcare.vn (do pipeline dữ liệu phụ trách)
├── .env.example
└── README.md
```

## Cách chạy

### 1. Cấu hình môi trường

```bash
cp .env.example .env
# Điền API key theo nhà cung cấp đã chọn vào file .env (đặt file .env trong
# thư mục backend/ hoặc thư mục gốc — backend đọc .env ở thư mục làm việc khi chạy).
# Mặc định LLM_PROVIDER=openai -> điền OPENAI_API_KEY và LLM_MODEL.
```

### 2. Backend

```bash
cd backend
npm install
npm run db:seed    # nạp dữ liệu từ data/processed vào DB (SQLite backend/bookingcare.db;
                   # lần đầu chạy server cũng tự nạp nếu DB đang trống)
npm run dev        # http://localhost:3001
```

Kiểm tra nhanh:

```bash
curl http://localhost:3001/health
# {"ok":true,"llmConfigured":false,"llmProvider":"openai","llmModel":"",...}

curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"s1","message":"Toi bi dau dau, muon kham o Ha Noi"}'
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Frontend đã nối vào `POST /api/chat` của backend (streaming SSE, thẻ bác sĩ/slot, xác nhận đặt lịch).

### 4. Đánh giá chất lượng

Xem `eval/README.md`.

## Biến môi trường

| Biến | Mô tả |
|---|---|
| `LLM_PROVIDER` | Nhà cung cấp LLM: `openai` (mặc định) hoặc `anthropic` |
| `LLM_MODEL` | Tên model của nhà cung cấp đã chọn (tùy ý, ví dụ `gpt-5.4` hoặc `claude-haiku-4-5`) |
| `OPENAI_API_KEY` | API key OpenAI (bắt buộc khi `LLM_PROVIDER=openai`; cũng dùng cho embedding RAG) |
| `ANTHROPIC_API_KEY` | API key Anthropic (bắt buộc khi `LLM_PROVIDER=anthropic`) |
| `PORT` | Cổng backend, mặc định `3001` |
| `DB_TYPE` | `sqlite` (mặc định, file `backend/bookingcare.db`) hoặc `mysql` |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` | Cấu hình MySQL khi `DB_TYPE=mysql` |
