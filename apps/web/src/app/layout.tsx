import type { Metadata } from 'next';
import './styles.css';
import { AuthProvider } from '../auth/auth-context';

export const metadata: Metadata = {
  title: 'EKMS',
  description: 'English Knowledge Management System',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
