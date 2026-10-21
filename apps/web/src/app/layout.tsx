import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'EKMS',
  description: 'English Knowledge Management System',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
