import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Article } from '@/lib/types';
import { DeleteButton } from '@/components/DeleteButton';

export default async function ArticlePage({
  params,
}: {
  params: { id: string };
}) {
  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('id', params.id)
    .single<Article>();

  if (!article) notFound();

  const summaryLines = (article.summary ?? '').split('\n').filter(Boolean);
  const date = new Date(article.created_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <Link
        href="/"
        className="text-sky-500 text-sm hover:underline mb-6 inline-block"
      >
        ← 一覧へ戺る
      </Link>

      <article className="space-y-5">
        <h1 className="text-2xl font-bold leading-snug">
          {article.title || 'Untitled'}
        </h1>

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-500 text-sm hover:underline break-all block"
        >
          {article.url}
        </a>

        <p className="text-slate-400 text-sm">{date}</p>

        <hr className="border-slate-200 dark:border-slate-700" />

        <section>
          <h2 className="font-semibold mb-3">要約</h2>
          {summaryLines.length > 0 ? (
            <ul className="space-y-2">
              {summaryLines.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-sky-500 font-bold flex-shrink-0 mt-0.5">•</span>
                  <span className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-sm">要約がありません</p>
          )}
        </section>

        {article.tags.length > 0 && (
          <>
            <hr className="border-slate-200 dark:border-slate-700" />
            <section>
              <h2 className="font-semibold mb-3">タグ</h2>
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-full px-3 py-1 font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </section>
          </>
        )}

        <hr className="border-slate-200 dark:border-slate-700" />
        <DeleteButton id={article.id} />
      </article>
    </main>
  );
}
