import { AuthPanel } from '../auth/auth-panel';

export default function HomePage(): React.ReactNode {
  return (
    <main>
      <header>
        <p className="eyebrow">EKMS</p>
        <h1>Học từ vựng theo ngữ cảnh của bạn.</h1>
        <p>Đăng nhập để xây dựng kho kiến thức tiếng Anh và ôn tập theo tiến độ cá nhân.</p>
      </header>
      <AuthPanel />
    </main>
  );
}
