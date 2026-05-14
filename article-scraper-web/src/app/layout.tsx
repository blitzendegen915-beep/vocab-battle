import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LinkNote AI',
  description: 'あとで読むつもりの記事、もう忘れない。URLを貼るだけでAIが3行要約・タグ付け・保存します。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
