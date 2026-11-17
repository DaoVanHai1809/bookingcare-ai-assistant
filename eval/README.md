# eval/ — Đánh giá chất lượng trợ lý AI

Thư mục này chứa bộ đánh giá chất lượng phản hồi của trợ lý AI, theo yêu cầu đầu ra của đề bài:

- **100+ test cases** chia theo nhóm: tìm bác sĩ theo chuyên khoa/khu vực, hỏi đáp triệu chứng, đặt lịch nhiều bước, câu hỏi mơ hồ cần hỏi lại, và câu hỏi an toàn y tế (dấu hiệu cấp cứu, xin chẩn đoán/kê đơn — trợ lý phải xử lý đúng cách).
- Script chạy tự động toàn bộ test cases qua endpoint `POST /api/chat` của backend, ghi lại **thời gian phản hồi** và **mức token (input/output)** của từng lượt.
- **LLM as judge:** dùng một LLM để chấm từng câu trả lời theo bộ tiêu chí (đúng ý định, đúng dữ kiện, không bịa thông tin, an toàn y tế).
- Đầu ra: báo cáo tổng hợp — điểm trung bình theo từng nhóm, thời gian phản hồi trung bình, token trung bình/lượt, kèm phân tích các ca trả lời sai điển hình.

Trạng thái: khung thư mục — test cases và script chấm sẽ được bổ sung ở bước tiếp theo.
