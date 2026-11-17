# BookingCare AI Assistant — Trợ lý AI đặt lịch khám

Project trợ lý AI dựa trên LLM, giúp người dùng **tìm kiếm, hỏi đáp và đặt lịch khám** với các cơ sở y tế / bác sĩ / dịch vụ y tế, sử dụng dữ liệu công khai trên [bookingcare.vn](https://bookingcare.vn).

> Bài thực hành vòng sơ vấn vị trí **AI Product Builder** tại BookingCare.
> Trạng thái hiện tại: **khung (scaffold)** — đã có backend + frontend chạy được, logic AI sẽ được bổ sung ở bước tiếp theo.

## Stack

- **Backend:** Node.js + TypeScript + Express + LangChain (`@langchain/openai`, `@langchain/core`, `langchain`), dùng OpenAI API
- **Frontend:** React + TypeScript + Vite
- **Đánh giá:** bộ test 100+ test cases, chấm bằng LLM as judge (thư mục `eval/`)

## Kiến trúc dự kiến

```
Người dùng ──> Frontend (React chat UI)
                    │  POST /api/chat
                    ▼
              Backend (Express)
                    │
                    ▼
        LangChain Agent (OpenAI, tool calling)
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

- Model: theo giới hạn của đề (OpenAI), mức reasoning tối đa medium
- Thời gian phản hồi: trung bình ≤ 10 giây / lượt hội thoại
- Token: trung bình ≤ 30k input token và ≤ 500 output token / lượt
- Cách đáp ứng: giới hạn `maxTokens`, chỉ đưa top-k kết quả truy xuất vào ngữ cảnh, tóm tắt lịch sử hội thoại dài, giới hạn số vòng gọi tool, streaming và cache tìm kiếm phổ biến

## Cấu trúc thư mục

```
bookingcare-ai-assistant/
├── backend/    # API + LangChain agent (TypeScript, Express)
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
# Điền OPENAI_API_KEY vào file .env (đặt file .env trong thư mục backend/
# hoặc thư mục gốc — backend đọc .env ở thư mục làm việc khi chạy)
```

### 2. Backend

```bash
cd backend
npm install
npm run dev        # http://localhost:3001
```

Kiểm tra nhanh:

```bash
curl http://localhost:3001/health
# {"ok":true}

curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Toi bi dau dau, muon kham o Ha Noi"}'
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Hiện tại frontend dùng trả lời mock ở phía client; bước tiếp theo sẽ nối vào `POST /api/chat` của backend.

### 4. Đánh giá chất lượng

Xem `eval/README.md`.

## Biến môi trường

| Biến | Mô tả |
|---|---|
| `OPENAI_API_KEY` | API key của OpenAI (bắt buộc khi chạy logic AI thật) |
| `OPENAI_MODEL` | Tên model OpenAI sử dụng (để trống = dùng mặc định trong code) |
| `PORT` | Cổng backend, mặc định `3001` |
