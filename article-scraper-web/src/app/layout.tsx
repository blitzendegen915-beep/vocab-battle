import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Article Scraper',
  description: 'AIが記事を3行で要約・タグ付きで保存',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
