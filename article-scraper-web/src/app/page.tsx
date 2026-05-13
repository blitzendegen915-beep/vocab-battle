import { supabase } from '@/lib/supabase';
import { Article } from '@/lib/types';
import { AddArticleForm } from '@/components/AddArticleForm';
import { ArticleCard } from '@/components/ArticleCard';

export const revalidate = 0;

export default async function Home() {
  const { data } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  const articles: Article[] = data ?? [];

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">📰 Article Scraper</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
        URLを入力するだけでAIが3行要約＋タグ付きで保存
      </p>

      <AddArticleForm />

      <section className="mt-10">
        <h2 className="text-base font-semibold mb-4 text-slate-700 dark:text-slate-300">
          保存済み記事
          {articles.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">
              {articles.length}件
            </span>
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
    </main>
  );
}
