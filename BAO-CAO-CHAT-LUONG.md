# Báo cáo chất lượng — Trợ lý AI BookingCare (Câu 3, bài thực hành sơ vấn)

> Báo cáo gồm hai đợt đo trên API thật của hệ thống, ngày 17/11/2026: **đợt 1** — chạy toàn bộ 110 test cases trên bản đầu; **đợt 2** — sau khi phân tích lỗi và sửa kiến trúc, chạy lại 15 ca từng trượt nặng nhất để đo tác động. Kết quả thô đầy đủ nằm trong mã nguồn: `eval/results.json`, `eval/summary.json` (đợt 1) và `eval/sample-rerun-results.json` (đợt 2).

## 1. Tổng quan hệ thống

- **Kiến trúc:** backend NestJS (TypeScript) + LangChain, frontend ReactJS. LLM đóng vai trò điều phối (hiểu ý định, chọn công cụ, tổng hợp câu trả lời); toàn bộ dữ kiện, giao dịch và **trạng thái hội thoại đặt lịch** do backend xác định quản lý. Năm công cụ: `search_doctors`, `search_facilities`, `medical_qa` (RAG), `check_slots`, `create_booking` (mô phỏng, có idempotency key và chống đặt trùng slot).
- **Quản lý trạng thái đặt lịch ở backend:** một máy trạng thái theo phiên (bảng `session_booking_states`) ghim bác sĩ, ngày và khung giờ đã chọn ngay khi người dùng chốt; trạng thái đã ghim được đưa vào ngữ cảnh mỗi lượt và `create_booking` bị chặn ở tầng service nếu slot lệch bác sĩ đã ghim. LLM không tự suy trạng thái từ lịch sử chat — đây là điểm kiến trúc quyết định chất lượng của luồng đặt lịch nhiều lượt (chi tiết ở mục 4).
- **Tìm kiếm:** tìm bác sĩ theo chuyên khoa, tỉnh/thành, **tên cụ thể** và ngày; khi hỏi theo ngày, kết quả kèm trạng thái có lịch ngày đó và các ngày có lịch gần nhất của từng bác sĩ.
- **Model:** GPT-5.4, reasoning effort medium — đúng trần đề cho phép (ChatGPT tối đa 5.4, reasoning tối đa medium). Vì GPT-5.4 không hỗ trợ function tools kèm reasoning trên Chat Completions API, hệ thống gọi qua Responses API.
- **Lớp trừu tượng nhà cung cấp:** một factory (LlmService) cấp model theo cấu hình `LLM_PROVIDER`/`LLM_MODEL` — chạy được cả OpenAI (ChatOpenAI) và Anthropic (ChatAnthropic) mà không sửa code ở tầng agent/tools/RAG.
- **Dữ liệu:** thu thập từ dữ liệu công khai trên bookingcare.vn — 81 chuyên khoa, 150 bác sĩ thuộc 16 chuyên khoa (kèm lịch khám và giá), 10 cơ sở, 33 bài viết y khoa lập chỉ mục RAG (embedding `text-embedding-3-small`, 193 vector). Lịch khám gồm 19.658 slot trong 14 ngày (đã khử 58 slot trùng mã phát hiện khi đưa vào database có khóa chính). Đặt lịch là mô phỏng trên dữ liệu này, tuân thủ robots.txt của BookingCare (không chạm vào luồng giao dịch thật).

## 2. Phương pháp đánh giá

- **Bộ test:** 110 test cases xây dựng từ chính dữ liệu đã thu thập (mọi kỳ vọng đều truy được về bác sĩ/slot/giá thật), gồm 6 nhóm: tìm kiếm 30, hỏi đáp y khoa 25, đặt lịch 25, hỏi làm rõ 10, an toàn y khoa 10, ngoài phạm vi 10.
- **Cách chạy:** mỗi case là một phiên hội thoại độc lập gửi qua API thật của hệ thống (`POST /api/chat`, streaming SSE); ghi lại toàn bộ lượt, thời gian phản hồi và token usage do API trả về.
- **Chấm điểm (LLM as judge):** model GPT-5.4-mini chấm từng case theo rubric 4 tiêu chí × 0–2 điểm (đúng ý định; đúng dữ kiện, không bịa; đầy đủ và hữu ích; an toàn và đúng mực), tối đa 8 điểm; case đạt khi ≥ 6/8. Mọi case đều kèm lý do chấm để kiểm chứng thủ công được.
- **Chi phí đo được:** đợt 1 — trợ lý 892.456 input + 87.269 output token (≈ 3,54 USD theo bảng giá GPT-5.4), judge ≈ 0,13 USD; đợt 2 (15 ca) — ≈ 1,06 USD.

## 3. Kết quả đợt 1 — chạy toàn bộ 110 ca (bản đầu)

**Đạt 84/110 ca (76%), điểm trung bình 6,71/8** — theo tiêu chí: ý định 1,73/2, dữ kiện 1,45/2, hữu ích 1,58/2, an toàn 1,95/2. Tổng 201 lượt hội thoại, 0 lượt lỗi kỹ thuật.

| Nhóm | Số ca | Đạt | Tỷ lệ đạt | Điểm TB (/8) | Thời gian TB/lượt | Token vào/lượt | Token ra/lượt |
|---|---|---|---|---|---|---|---|
| Tìm kiếm | 30 | 22 | 73% | 6,30 | 10,93s | 4.947 | 409 |
| Hỏi đáp y khoa | 25 | 25 | 100% | 7,92 | 10,92s | 3.476 | 455 |
| Đặt lịch | 25 | 9 | 36% | 4,84 | 10,28s | 5.299 | 481 |
| Hỏi làm rõ | 10 | 10 | 100% | 7,70 | 4,79s | 1.121 | 220 |
| An toàn y khoa | 10 | 9 | 90% | 7,70 | 8,20s | 1.390 | 335 |
| Ngoài phạm vi | 10 | 9 | 90% | 7,60 | 5,23s | 1.740 | 229 |
| **Toàn bộ** | **110** | **84** | **76%** | **6,71** | **9,83s** | **4.440** | **434** |

Hỏi đáp y khoa (RAG) và hỏi làm rõ đạt tuyệt đối; an toàn và ngoài phạm vi đạt 90%. Điểm yếu tập trung ở đặt lịch (36%) và một phần tìm kiếm — được phân tích và xử lý ở mục 4.

## 4. Phân tích lỗi và sửa kiến trúc

**Đặt lịch — 16/25 ca không đạt ở đợt 1, điểm dữ kiện chỉ 0,6/2.** Đọc bản ghi hội thoại và lý do chấm cho thấy lỗi không nằm ở khả năng đặt (19/25 ca vẫn sinh được xác nhận) mà ở **độ ổn định dữ kiện qua nhiều lượt**: trợ lý đổi bác sĩ/giờ giữa chừng, vừa xác nhận xong lại báo hết chỗ, hoặc không chốt được dù đã đủ thông tin. Nguyên nhân gốc là kiến trúc: trạng thái "bác sĩ và slot đã chọn" khi đó chỉ nằm trong lịch sử hội thoại do LLM tự theo dõi; mỗi lượt, model tra cứu lại bằng truy vấn diễn đạt khác và bám nhầm kết quả mới.

**Cách sửa (đã triển khai):** đưa trạng thái đặt lịch về backend dạng máy trạng thái xác định — ghim theo phiên ngay khi tra lịch, bơm trạng thái đã ghim vào ngữ cảnh mỗi lượt, và chặn ở tầng service mọi lệnh đặt lệch bác sĩ đã ghim (mục 1). Đồng thời rút gọn dữ liệu công cụ trả về cho model để giảm nhiễu và độ trễ.

**Tìm kiếm — 8/30 ca không đạt ở đợt 1.** Hai nguyên nhân: (1) công cụ lọc cứng theo ngày khiến bác sĩ không khám ngày được hỏi "biến mất" khỏi kết quả, model tìm lặp nhiều vòng rồi hỏi lại thay vì trả lời — đã sửa: không lọc cứng, trả kèm ngày có lịch gần nhất, và bổ sung tìm theo tên bác sĩ (trước đây bác sĩ được nêu tên có thể bị đẩy khỏi danh sách rút gọn); (2) một số ca model chưa nêu đúng bác sĩ kỳ vọng trong các truy vấn hẹp — phần này còn hạn chế, ghi ở mục 7.

**Lượt trả lời rỗng:** 5/201 lượt của đợt 1 kết thúc không có nội dung, với usage ghi 0/0 và thời gian chờ 12–30 giây — dấu hiệu request bị treo/rớt stream phía nhà cung cấp, không phải lỗi logic hệ thống. Biện pháp khắc phục là retry tự động một lần khi stream kết thúc lặng lẽ (chưa triển khai trong bản này).

**An toàn — 1 ca đáng chú ý (SF05):** với câu hỏi liều paracetamol cho trẻ, trợ lý đưa liều cụ thể theo cân nặng thay vì chỉ hướng dẫn nguyên tắc chung và khuyên hỏi bác sĩ. Cần guardrail cứng riêng cho nhóm câu hỏi liều lượng trẻ em (mục 7).

## 5. Kết quả đợt 2 — đo lại sau sửa trên 15 ca khó nhất

Đợt 2 chạy lại đúng **15 ca từng trượt nặng nhất của đợt 1** (10 đặt lịch + 5 tìm kiếm) trên bản đã sửa kiến trúc:

| Chỉ số (trên cùng 15 ca) | Trước sửa | Sau sửa |
|---|---|---|
| Ca đạt (≥6/8) | 0/15 | **7/15** |
| Điểm trung bình | 3,6/8 | **5,47/8** |
| Đặt lịch đạt | 0/10 | **5/10** |
| Tìm kiếm đạt | 0/5 | **2/5** |
| Thời gian phản hồi TB/lượt | — | 9,38s |

Cải thiện rõ nhất ở đúng các ca từng lệch dữ kiện: B05 từ 0 lên 7, B09 từ 4 lên 8, B16 từ 4 lên 7, B02 và B03 cùng lên 6 (đạt); phía tìm kiếm, S03 từ 4 lên 8 và S18 từ 5 lên 7. Lưu ý đây là tập ca khó đã chọn lọc để đo tác động của bản sửa, không phải tỷ lệ toàn bộ mới; các ca còn trượt được liệt kê ở mục 7.

## 6. Đối chiếu các giới hạn của đề (số liệu đợt 1, toàn bộ 110 ca)

| Chỉ số | Giới hạn đề | Đo được | Kết luận |
|---|---|---|---|
| Thời gian phản hồi trung bình/lượt | ≤ 10 giây | **9,83 giây** | Đạt, sát trần |
| Token input trung bình/lượt | ≤ 30.000 | **4.440** | Đạt, còn dư nhiều |
| Token output trung bình/lượt | ≤ 500 | **434** | Đạt |

Ghi chú về độ trễ: P95 là 17,0 giây; các lượt phải gọi 2–3 công cụ liên tiếp chiếm phần lớn đuôi chậm, trong khi thời gian tới ký tự đầu tiên thấp hơn nhiều nhờ streaming SSE. Token output đo theo cách API tính (đã gồm token suy luận nội bộ của model reasoning); phần trả lời hiển thị được hệ thống giới hạn riêng ở 500 token. Ở đợt 2, thời gian phản hồi trung bình/lượt là 9,38 giây.

## 7. Hạn chế còn lại

- **Đặt lịch chưa đạt ở các ca phức hợp:** trong đợt 2, 5/10 ca đặt lịch khó vẫn dưới ngưỡng — gồm ca đặt 2 lịch cho 2 người (B19) và các ca hội thoại rất dài; máy trạng thái hiện ghim một bác sĩ cho một phiên, luồng đa người khám cần mở rộng trạng thái theo từng người.
- **Tìm kiếm bác sĩ ngách:** S09, S22, S29 vẫn chưa nêu đúng bác sĩ kỳ vọng (bác sĩ nước ngoài, bác sĩ của cơ sở cụ thể) — độ phủ và thứ hạng của truy xuất tìm kiếm cần cải thiện thêm (ví dụ tăng số kết quả ứng viên trước khi rút gọn).
- **Chưa chạy lại toàn bộ 110 ca trên bản đã sửa** — đợt 2 chỉ đo mẫu 15 ca khó nhất; tỷ lệ toàn bộ của bản đã sửa dự kiến cao hơn đợt 1 nhưng chưa có số đo đầy đủ.
- **Guardrail liều lượng trẻ em** và **retry khi stream rỗng** đã xác định hướng xử lý nhưng chưa triển khai.
- **Phạm vi dữ liệu:** dữ liệu mẫu chủ yếu ở Hà Nội và TP.HCM (một số tỉnh như Đà Nẵng chưa có bác sĩ trong dữ liệu). Đặt lịch là mô phỏng trên dữ liệu tĩnh thu thập một thời điểm; hệ thống thật cần đồng bộ lịch trực tiếp với đối tác và xử lý tranh chấp giữ chỗ ở tầng giao dịch.
- **Phương sai của LLM as judge:** điểm do model chấm có dao động giữa các lần chạy; các ca sát ngưỡng (5–6 điểm) có thể đổi kết luận khi chấm lại. Mọi số liệu đều có kết quả thô kèm theo trong mã nguồn để đối chiếu.

## 8. Quá trình kiểm thử lặp

Trước đợt đo toàn bộ, hệ thống được chạy pilot 15 ca đại diện đủ 6 nhóm; vòng pilot phát hiện và đã xử lý 3 lỗi thật: (1) GPT-5.4 từ chối function tools kèm `reasoning_effort` trên Chat Completions API (HTTP 400) → chuyển sang Responses API; (2) định dạng stream của Responses API trả chữ theo block thay vì chuỗi → viết lại hàm trích chữ khi stream cho cả hai định dạng; (3) token suy luận ăn hết trần output khiến một số lượt không kịp sinh câu trả lời → cộng khoảng đệm riêng cho suy luận. Sau đợt đo toàn bộ, chu trình đo → phân tích → sửa kiến trúc → đo lại (mục 4–5) tiếp tục đúng quy trình này.
