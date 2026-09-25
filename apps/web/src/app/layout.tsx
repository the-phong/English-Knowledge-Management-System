import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = { title: 'EKMS', description: 'English Knowledge Management System' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return <html lang="vi"><body>{children}</body></html>;
}
