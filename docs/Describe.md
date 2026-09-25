# English Knowledge Management System

---

# 1. Dự án này là gì?

## Tổng quan

English Knowledge Management System là một hệ thống full-stack quản lý và đánh giá quá trình học từ vựng tiếng Anh.

Dự án có hai mục tiêu song song:

- Giúp người học biến từ gặp trong thực tế thành từ có thể hiểu, gọi lại và sử dụng.
- Là sản phẩm portfolio chuyên sâu về backend/full-stack: domain model, authentication, transaction, background job, cache, AI integration, testing và deployment.

Khác với các ứng dụng như Duolingo, Quizlet hay Anki tập trung vào việc dạy từ vựng, hệ thống này tập trung vào việc:

- Theo dõi mức độ thành thạo theo từng nghĩa mà người dùng đã chọn học
- Đánh giá riêng khả năng hiểu, gọi lại và sử dụng từ
- Lưu lịch sử câu viết và vòng lặp sửa lỗi
- Đề xuất các từ cần ôn tập, kèm lý do ưu tiên

Mục tiêu cuối cùng:

> Không chỉ biết nghĩa của từ, mà phải sử dụng được từ đó trong câu.

---

## Triết lý sản phẩm

Một từ được xem là thành thạo khi:

- Người dùng nhớ được nghĩa
- Người dùng sử dụng được trong câu
- Người dùng duy trì được khả năng đó qua các lần đánh giá
Ghi chú:
- Học theo ngữ cảnh: ưu tiên lưu câu gốc và nguồn mà người dùng đã gặp từ trước khi thêm nhãn.
- Mỗi nghĩa có thể gắn nhiều nhãn ngữ cảnh; nhãn là công cụ lọc, không phải bước bắt buộc khi thêm từ.
- Lưu lịch sử câu viết và bài sửa để tạo chiều sâu ghi nhớ.
- OpenAI không chỉ đánh giá mà còn hướng dẫn, sửa lỗi và giải thích; mọi phiên bản sửa được lưu lại.
- Hệ thống không phạt người dùng chỉ vì quá hạn; quá hạn là tín hiệu tăng ưu tiên ôn.
---

## Đơn vị học tập

Hệ thống không chấm điểm một `Word` chung chung.

Đơn vị học là một `Vocabulary Item`: một `Word Sense` cụ thể mà người dùng đã lưu để học.

Ví dụ:

issue

- issue (problem)
- issue (publish)
- issue (edition)

Mỗi nghĩa được quản lý, lên lịch ôn và đánh giá độc lập theo từng người dùng.

---

# 2. Dự án này dưới góc nhìn người dùng

## Bước 1

Người dùng gặp một từ mới.

Ví dụ:

persistent

---

## Bước 2

Người dùng thêm từ vào hệ thống.

Hệ thống tự động lấy:

- Meaning
- Pronunciation
- Part of Speech
- Examples

thông qua Dictionary API.

---

## Bước 3

Người dùng xác nhận nghĩa muốn học, lưu câu gốc đã gặp từ và có thể bổ sung ghi chú/nhãn ngữ cảnh.

---

## Bước 4

Người dùng tham gia Quiz.

Quiz không phải trắc nghiệm. Mỗi câu hỏi phải có đủ ngữ cảnh để xác định đúng nghĩa đang học.

Ví dụ:

Ngữ cảnh:

She remained persistent despite several failed attempts.

Người dùng nhập nghĩa:

kiên trì

---

Hệ thống cũng có chiều gọi lại chủ động:

Ngữ cảnh hoặc nghĩa tiếng Việt → người dùng nhập từ/cụm từ tiếng Anh phù hợp.

Nếu trả lời sai, hệ thống hiển thị giải thích ngắn, ghi nhận attempt và xếp từ vào lượt ôn ngắn hơn. Nếu trả lời đúng, hệ thống tăng mức độ tin cậy cho kỹ năng tương ứng.

---

## Bước 5

Writing Phase (luyện sử dụng từ)

Ví dụ:

Từ:

persistent

Người dùng viết:

I am persistent when learning programming.

---

AI đánh giá theo kết quả hành động:

- Dùng đúng nghĩa mục tiêu (`Đạt` / `Sai nghĩa`)
- Cần sửa hay không (`Đạt` / `Cần sửa`)
- Một hoặc vài lỗi quan trọng nhất
- Gợi ý sửa và giải thích ngắn gọn

Writing không phải là cánh cổng bắt buộc sau mọi quiz. Hệ thống đưa writing vào khi từ đủ điều kiện, từ quan trọng hoặc người dùng chủ động muốn luyện. Người dùng có thể nộp phiên bản sửa lại.

---

## Bước 6

Mastery được cập nhật theo ba năng lực:

- Recognition: hiểu từ trong ngữ cảnh
- Recall: gọi lại từ từ nghĩa/ngữ cảnh
- Production: dùng đúng trong câu

Nếu hiển thị `Knowledge Score` 0–100, đây chỉ là điểm tổng hợp để xem nhanh, không phải source of truth.

---

## Bước 7

Hệ thống đề xuất:

- Từ mới
- Từ yếu
- Từ hay sai
- Từ cần học lại

Mỗi gợi ý kèm lý do, ví dụ: “quá hạn 3 ngày”, “sai lượt recall gần nhất”, hoặc “từ ưu tiên cao”.

---

# 3. Công nghệ, framework và công cụ

## Frontend

### Next.js + React + TypeScript

Vai trò:

- Xây dựng responsive web application cho dashboard, thêm từ, phiên học, lịch sử và phản hồi AI.
- Giao tiếp với NestJS qua REST API có version.

Nguyên tắc:

- Frontend chỉ quản lý UI/client state; scoring, scheduling và authorization thuộc backend.
- Dùng server-state cache, form validation và loading/error/empty state nhất quán.
- Ưu tiên trải nghiệm mobile web, keyboard flow trong quiz và accessibility cơ bản.

### UI và kiểm thử frontend

- Tailwind CSS và accessible component primitives cho giao diện nhất quán.
- TanStack Query cho server state.
- React Hook Form + Zod cho form validation.
- Vitest/Testing Library cho component test; Playwright cho luồng end-to-end.

## Backend

### NodeJS

Ưu điểm

- JavaScript toàn hệ thống
- Event-driven
- Hiệu suất tốt
- Phổ biến

Nhược điểm

- CPU-intensive task không mạnh
- Dễ viết code spaghetti nếu thiếu cấu trúc

---

### NestJS

Vai trò

Framework Backend chính.

Ưu điểm

- Kiến trúc enterprise
- Dependency Injection
- Module rõ ràng
- Dễ mở rộng

So với Express

Express:

+ Dễ học
- Khó maintain dự án lớn

NestJS:

+ Có cấu trúc chuẩn
+ Dễ mở rộng
- Học ban đầu khó hơn

=> Chọn NestJS

---

## Database

### PostgreSQL

Ưu điểm

- Mạnh
- Chuẩn SQL
- Quan hệ phức tạp tốt
- Miễn phí

So với MongoDB

MongoDB:

+ Linh hoạt
- Dữ liệu dễ lộn xộn

PostgreSQL:

+ Quan hệ mạnh
+ Dễ thiết kế nghiệp vụ

=> Chọn PostgreSQL

---

## ORM

### Prisma

Ưu điểm

- Type-safe
- Migration dễ
- Hỗ trợ NestJS tốt

So với TypeORM

Prisma:

+ Hiện đại
+ DX tốt

TypeORM:

+ Lâu đời
- Khó debug hơn

=> Chọn Prisma

---

## Authentication

JWT

Ưu điểm

- Stateless
- Dễ triển khai

---

## AI

### OpenAI API

Sử dụng cho:

- Chấm nghĩa
- Chấm câu viết
- Semantic Evaluation

---

## Cache

Redis

Ưu điểm

- Tăng tốc
- Lưu Session
- Rate Limiting

---

## Testing

Jest

Ưu điểm

- Mặc định của NestJS
- Unit Test dễ

---

## API Testing

Postman

---

## Version Control

Git

Github

---

## Deploy

Docker

Render hoặc VPS

---

# 4. Roadmap 1 tháng 2 tuần

Tổng thời gian:

42 ngày

---

# PHASE 2 - PHÂN TÍCH (Ngày 1-5)

## Ngày 1

Hoàn thiện BRD

Deliverable:

- BRD.md

---

## Ngày 2

Viết Use Case

Deliverable:

- Use Case Diagram

---

## Ngày 3

Xác định Business Rules

Deliverable:

- business-rules.md

---

## Ngày 4

Xác định Domain Model

Deliverable:

- domain-model.md

---

## Ngày 5

Review toàn bộ nghiệp vụ

Deliverable:

- Requirement Freeze

---

# PHASE 3 - THIẾT KẾ (Ngày 6-12)

## Ngày 6

Thiết kế Database

Deliverable:

- ERD

---

## Ngày 7

Thiết kế API

Deliverable:

- api-design.md

---

## Ngày 8

Thiết kế Module Backend

Deliverable:

- module-design.md

---

## Ngày 9

Thiết kế State Machine

Deliverable:

- learning-state-diagram

---

## Ngày 10

Thiết kế Knowledge Engine

Deliverable:

- scoring-rules.md

---

## Ngày 11

Thiết kế Recommendation Engine

Deliverable:

- recommendation-rules.md

---

## Ngày 12

Review Design

Deliverable:

- Design Freeze

---

# PHASE 4 - CÀI ĐẶT (Ngày 13-35)

## Ngày 13-14

Setup Project

- pnpm monorepo
- Next.js Web App
- NestJS
- Prisma
- PostgreSQL
- Redis và Docker Compose cho môi trường local

---

## Ngày 15-16

Authentication Module

- Login/register/refresh/logout API
- Màn hình authentication và protected route

---

## Ngày 17-18

Vocabulary Module

- Quick Add UI, danh sách và chi tiết từ

---

## Ngày 19-20

Dictionary API Integration

- Provider adapter, cache và manual fallback

---

## Ngày 21-23

Learning Session Module

- Session UI, attempt transaction và idempotency

---

## Ngày 24-26

Quiz Engine

- Recognition và recall theo ngữ cảnh

---

## Ngày 27-29

Writing Module

- Submission/revision UI và trạng thái bất đồng bộ

---

## Ngày 30-31

OpenAI Integration

- Background worker/queue, structured output, retry và failure recovery

---

## Ngày 32-33

Knowledge Engine

- Mastery dimensions, audit history và scheduling policy versioned

---

## Ngày 34-35

Recommendation Engine

- Priority reason và Dashboard read model

---

# PHASE 5 - TESTING (Ngày 36-40)

## Ngày 36

Unit Test

---

## Ngày 37

Integration Test

---

## Ngày 38

API Test

---

## Ngày 39

Bug Fix

---

## Ngày 40

Regression Test

---

# PHASE 6 - DEPLOY (Ngày 41-42)

## Ngày 41

Dockerize

Deploy Server

---

## Ngày 42

Production Release

---

# Kết quả sau 42 ngày

Có một MVP hoàn chỉnh gồm:

- User Authentication
- Vocabulary Management
- Learning Session
- Quiz Engine
- Writing Evaluation
- AI Integration
- Mastery Engine (recognition/recall/production)
- Recommendation Engine
- PostgreSQL Database
- NestJS Backend
- Docker Deployment

---

# 5. Đặc tả MVP đã chốt

## 5.1 Phạm vi phát hành đầu tiên

MVP phục vụ **một người học tự quản lý từ vựng tiếng Anh**, đồng thời có authentication và data isolation để kiến trúc sẵn sàng cho nhiều người dùng. Mục tiêu là chứng minh vòng lặp: thêm một nghĩa cùng ngữ cảnh → hiểu và gọi lại từ → viết câu khi phù hợp → nhận phản hồi/sửa lại → được nhắc ôn đúng lúc.

### Có trong MVP

- Đăng ký, đăng nhập và quản lý hồ sơ cơ bản.
- Thêm từ bằng tra cứu Dictionary API hoặc nhập tay, ưu tiên lưu câu gốc/nguồn.
- Quản lý từng `Vocabulary Item` theo Word Sense: nghĩa tiếng Việt, từ loại, phát âm, ví dụ, nhãn ngữ cảnh và ghi chú cá nhân.
- Quiz recognition (Anh → Việt theo ngữ cảnh) và recall (nghĩa/ngữ cảnh → Anh).
- Writing phase theo lịch hoặc chủ động: viết câu tiếng Anh có dùng đúng nghĩa đang học.
- AI phản hồi có cấu trúc, đánh giá bất đồng bộ và hỗ trợ revision.
- Mastery theo recognition/recall/production, lịch ôn và danh sách từ cần ôn có lý do.
- Dashboard tiến độ, lịch sử attempt/câu sửa và responsive web UI.

### Không thuộc MVP

- Ứng dụng mobile native, học nhóm, mạng xã hội, gamification, thanh toán.
- Đồng bộ nhiều nguồn từ điển hoặc nhập dữ liệu hàng loạt.
- Tự sinh bài đọc dài, luyện phát âm bằng giọng nói, chat tutor mở.
- Recommendation Engine dự đoán bằng machine learning. MVP dùng rule-based recommendation.

## 5.2 Luồng người dùng và màn hình

| Màn hình | Mục đích | Hành động chính |
| --- | --- | --- |
| Đăng nhập/đăng ký | Xác thực người dùng | Tạo tài khoản, đăng nhập, quên mật khẩu (giai đoạn sau có thể bổ sung) |
| Dashboard | Biết hôm nay cần làm gì | Bắt đầu phiên ôn, xem số từ đến hạn, từ yếu và chuỗi học |
| Thêm từ | Ghi nhận kiến thức mới | Tra cứu, chọn nghĩa, sửa thông tin, gắn nhãn ngữ cảnh |
| Danh sách từ | Quản lý kho từ | Lọc theo trạng thái, nhãn, từ loại; mở chi tiết một Word Sense |
| Phiên học | Hoàn thành một lượt luyện tập | Hiểu theo ngữ cảnh, gọi lại từ, xem kết quả và luyện viết khi phù hợp |
| Phản hồi câu viết | Học từ lỗi sai | Xem kết quả đạt/cần sửa, lỗi trọng tâm, câu gợi ý; gửi phiên bản sửa lại |
| Lịch sử/chi tiết từ | Theo dõi tiến bộ | Xem mastery, lịch ôn, lý do ưu tiên, các lần trả lời và các bản câu viết |

Các trạng thái UX bắt buộc: loading khi gọi từ điển/AI, empty state khi chưa có từ, thông báo lỗi có thể thử lại, và cảnh báo rõ khi phản hồi AI chỉ mang tính hỗ trợ học tập.

## 5.3 Quy tắc nghiệp vụ

### Đơn vị dữ liệu

- `Word`/`Lexeme` là mặt chữ gốc, ví dụ `issue`.
- `Word Sense` là một nghĩa cụ thể của Word/Lexeme.
- `Vocabulary Item` là một Word Sense mà một người dùng đã lưu; đây là đơn vị được lên lịch ôn, gợi ý và đánh giá mastery.
- Một Word có nhiều Word Sense; mỗi Vocabulary Item có thể có nhiều nhãn ngữ cảnh, nhiều ví dụ và một câu nguồn riêng.
- Dữ liệu từ điển là dữ liệu gợi ý, không tự động biến thành dữ liệu học. Người dùng có thể sửa hoặc nhập nghĩa riêng.

### Quiz nghĩa

- Mỗi lượt đánh giá một Vocabulary Item với ngữ cảnh đủ để xác định Word Sense.
- MVP có hai chiều: recognition Anh → Việt và recall nghĩa/ngữ cảnh → Anh.
- Người dùng tự nhập đáp án thay vì chọn đáp án.
- Hệ thống chuẩn hóa chữ hoa/thường, khoảng trắng, dấu câu và dấu tiếng Việt trước khi đối chiếu.
- Một đáp án được chấp nhận nếu khớp nghĩa chính, một synonym do người dùng đã lưu, hoặc được AI semantic check xác nhận tương đương.
- Nếu semantic check không chắc chắn, kết quả mặc định là **cần xem lại**, không tự chấm đúng.
- Đúng nghĩa ở quiz không đồng nghĩa đã thành thạo; nó chỉ cập nhật mastery của recognition hoặc recall.

### Writing phase

- Người dùng viết một câu tiếng Anh có chứa đúng lemma hoặc một biến thể hợp lệ của từ. Các lexeme khác nhau như `persist`/`persistent` không được xem là cùng Word Sense nếu không cấu hình liên hệ.
- AI trả về JSON theo schema: `usesTargetSense` (boolean), `grammarStatus`, `naturalness`, `confidence`, `grammarIssues`, `wordChoiceIssues`, `suggestedSentence`, `explanation`.
- Backend policy quyết định outcome `pass`, `revise`, `wrong_sense` hoặc `needs_review`; không dùng trực tiếp một điểm AI duy nhất.
- Nếu AI không trả về schema hợp lệ, lưu trạng thái `evaluation_failed`, không cập nhật điểm và cho phép người dùng thử lại.
- Câu gốc, kết quả AI, prompt version, model và câu người dùng sửa được lưu thành lịch sử bất biến.

### Mastery và trạng thái học

Mỗi Vocabulary Item có ba mastery dimensions, đều trong khoảng 0–100:

| Dimension | Được cập nhật bởi |
| --- | --- |
| `recognitionScore` | Quiz hiểu nghĩa trong ngữ cảnh |
| `recallScore` | Quiz gọi lại từ theo nghĩa/ngữ cảnh |
| `productionScore` | Writing evaluation đạt target sense và policy |

Lịch sử attempt/evaluation là source of truth; snapshot mastery chỉ để đọc nhanh. Một `Knowledge Score` tổng hợp có thể hiển thị trên UI nhưng phải suy ra từ ba dimension, kèm `scoringRuleVersion`.

Sau mỗi attempt, hệ thống gán trạng thái:

- `new`: chưa đủ dữ liệu.
- `learning`: recognition hoặc recall còn yếu.
- `practicing`: hiểu/gọi lại khá ổn nhưng production chưa đủ.
- `mastered`: recognition và recall đạt ngưỡng, có ít nhất 2 writing pass ở hai ngày khác nhau và một lần recall thành công sau interval dài.

`due`/`needs_review` là trạng thái lịch ôn được suy ra từ `nextReviewAt`, không phải hình phạt làm giảm mastery.

### Lịch ôn và gợi ý

MVP dùng spaced repetition theo mốc có điều chỉnh: `again` đưa item vào lượt ngắn hơn, `hard` giữ interval ngắn, `good` đi qua 1 → 3 → 7 → 14 → 30 ngày, `easy` có thể đi nhanh hơn một mốc. Writing chưa đạt không xóa tiến độ recognition/recall. Từ đến hạn được xếp hạng theo: quá hạn → lỗi gần nhất → recall/production yếu → mức ưu tiên do người dùng đặt. Dashboard chọn số Vocabulary Item dựa trên thời lượng phiên người dùng chọn, tối đa 20.

## 5.4 Mô hình dữ liệu tối thiểu

| Thực thể | Trường/chức năng chính |
| --- | --- |
| `User` | email, password hash, timezone, createdAt |
| `Word`/`Lexeme` | normalizedText, language, partOfSpeech |
| `WordSense` | wordId, definition, dictionarySource, providerSenseId, raw response metadata |
| `VocabularyItem` | userId, wordSenseId nullable, definitionVi, sourceContext, source, importance, archivedAt |
| `ContextTag` | userId, name, màu hiển thị |
| `VocabularyItemTag` | liên kết nhiều-nhiều giữa Vocabulary Item và nhãn |
| `LearningSession`/`SessionItem` | phiên học, activity, thứ tự và lý do được chọn |
| `LearningAttempt` | vocabularyItemId, loại activity, câu trả lời, kết quả, hint, idempotency key, thời điểm |
| `MasterySnapshot`/`MasteryChange` | ba dimension, next review, version và audit thay đổi |
| `WritingSubmission` | vocabularyItemId, text, revisionOfId, trạng thái đánh giá bất đồng bộ |
| `AIEvaluation` | writingSubmissionId, outcome, target sense, lỗi, câu gợi ý, model, prompt/schema version |
| `DictionaryCache` | query, raw response, expiresAt; không chứa dữ liệu riêng tư |

Ràng buộc quan trọng: mọi Vocabulary Item, attempt và submission phải thuộc đúng người dùng qua ownership query. `LearningAttempt` và `WritingSubmission` dùng idempotency key để request retry không tạo dữ liệu/điểm lặp. Không xóa cứng lịch sử học; dùng `archivedAt` khi người dùng bỏ một từ.

## 5.5 API cấp cao

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `GET /dictionary?query=`: tra cứu và cache kết quả từ điển.
- `POST /vocabulary-items`, `GET /vocabulary-items`, `GET/PATCH /vocabulary-items/:id`, `POST /vocabulary-items/:id/archive`
- `POST /learning-sessions`, `GET /learning-sessions/:id`, `POST /learning-sessions/:id/attempts`, `POST /learning-sessions/:id/complete`
- `POST /writing-submissions`: nộp câu, trả `202 Accepted`; worker đánh giá bất đồng bộ với timeout/retry rõ ràng.
- `GET /writing-submissions/:id`, `POST /writing-submissions/:id/revisions`
- `GET /vocabulary-items/:id/history`, `GET /dashboard`

Mọi endpoint dữ liệu học yêu cầu access token. JWT access token sống ngắn; refresh token được xoay vòng, lưu hash/session record trong database và có thể cache/revoke qua Redis. Redis dùng cho rate limit, cache và BullMQ queue — không dùng mơ hồ như nơi lưu toàn bộ session hoặc dữ liệu học.

## 5.6 Chính sách AI, chi phí và độ tin cậy

- Chỉ gọi AI khi kiểm tra semantic answer chưa xác định hoặc người dùng nộp câu viết; không dùng AI cho mọi quiz.
- Dùng Structured Outputs/JSON schema và validate ở backend trước khi lưu/cập nhật mastery.
- AI evaluation chạy qua queue/worker; thiết lập timeout, retry giới hạn với lỗi tạm thời, rate limit theo user và reconciliation cho submission bị treo.
- Lưu model, prompt version, thời gian xử lý và token/cost ước lượng cho mỗi lần gọi để có thể audit và điều chỉnh.
- Không gửi email, password hay dữ liệu hồ sơ không cần thiết vào prompt. Người dùng được thông báo câu viết được gửi tới dịch vụ AI để đánh giá.
- Có fallback: AI lỗi thì lưu bài, hiển thị “chưa thể đánh giá”, không mất dữ liệu và không làm đổi mastery.

## 5.7 Tiêu chí nghiệm thu MVP

MVP được xem là hoàn thành khi một người dùng mới có thể:

1. Tạo tài khoản, tra `persistent`, chọn/lưu nghĩa “kiên trì” cùng câu ngữ cảnh; có thể gắn nhãn nếu cần.
2. Vào dashboard, nhận phiên học có từ này, nhập nghĩa và nhận kết quả rõ ràng.
3. Làm recognition/recall quiz theo ngữ cảnh; viết một câu khi được đề xuất hoặc chủ động chọn; nhận kết quả đạt/cần sửa, xác nhận có dùng đúng nghĩa, lỗi và câu gợi ý từ AI.
4. Xem được câu gốc, phản hồi và phiên bản chỉnh sửa trong lịch sử của Vocabulary Item.
5. Thấy mastery recognition/recall/production, trạng thái học và ngày ôn tiếp theo thay đổi đúng theo business rules; request retry không làm thay đổi lặp.
6. Sau khi đến hạn, thấy Vocabulary Item xuất hiện trong danh sách cần ôn kèm lý do; dữ liệu của người dùng khác không thể truy cập.

## 5.8 Điều chỉnh roadmap thực tế

42 ngày chỉ khả thi nếu đây là dự án một người phát triển với scope MVP ở trên, dùng một Dictionary API duy nhất và giao diện tối giản. Nên thay các mốc “Requirement/Design Freeze” bằng review có quyết định ghi lại, vì quy tắc chấm AI và scoring sẽ cần hiệu chỉnh sau khi có dữ liệu dùng thử.

Ưu tiên triển khai theo vertical slice: nền tảng/Auth + Web shell → Vocabulary Item + Dictionary + giao diện thêm từ → Learning Session + quiz + scheduling → Writing/AI worker → Dashboard/history/hardening. `Recommendation Engine` của MVP là luật xếp hạng lịch ôn tại mục 5.3, không cần tách thành một dịch vụ riêng. Chi tiết kiến trúc, API, queue, testing và deployment được mô tả trong `TECHNICAL_DESIGN.md`.
