import Link from 'next/link';
import { Article } from '@/lib/types';

export function ArticleCard({ article }: { article: Article }) {
  const date = new Date(article.created_at).toLocaleDateString('ja-JP');
  const firstLine = article.summary?.split('\n')[0] ?? '';

  return (
    <Link
      href={`/article/${article.id}`}
      className="group block rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:border-sky-400 dark:hover:border-sky-500 transition-colors"
    >
      <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
        {article.title || 'Untitled'}
      </h3>

      {firstLine && (
        <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2 mb-2">
          {firstLine}
        </p>
      )}

      <div className="flex flex-wrap gap-1 mb-2">
        {article.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full px-2 py-0.5 font-medium"
          >
            #{tag}
          </span>
        ))}
      </div>

      <p className="text-slate-400 text-xs">{date}</p>
    </Link>
  );
}
