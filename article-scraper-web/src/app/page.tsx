import { supabase } from '@/lib/supabase';
import { Article } from '@/lib/types';
import { AddArticleForm } from '@/components/AddArticleForm';
import { ArticleCard } from '@/components/ArticleCard';
import { EmailSignup } from '@/components/EmailSignup';

export const revalidate = 0;

export default async function Home() {
  const { data } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  const articles: Article[] = data ?? [];

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold mb-3">📎 LinkNote AI</h1>
        <p className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-2">
          あとで読むつもりの記事、もう忘れない。
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          URLを貼るだけで、AIが3行要約・タグ付け・保存します。
        </p>
      </div>

      <AddArticleForm />

      {/* Article list */}
      <section className="mt-10">
        <h2 className="text-base font-semibold mb-4 text-slate-700 dark:text-slate-300">
          保存済み記事
          {articles.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">{articles.length}件</span>
          )}
        </h2>
        {articles.length === 0 ? (
          <p className="text-center text-slate-400 py-16 text-sm">
            まだ記事がありません。上のフォームからURLを追加してください。
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>

      <EmailSignup />
    </main>
  );
}
