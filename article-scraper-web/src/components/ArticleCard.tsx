'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Article } from '@/lib/types';

export function ArticleCard({ article }: { article: Article }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const date = new Date(article.created_at).toLocaleDateString('ja-JP');
  const summaryLines = (article.summary ?? '').split('\n').filter(Boolean);

  const handleCopy = async () => {
    const text = `${article.title}\n\n${summaryLines.map((l) => `• ${l}`).join('\n')}\n\n${article.url}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirm('この記事を削除しますか？')) return;
    setDeleting(true);
    await supabase.from('articles').delete().eq('id', article.id);
    router.refresh();
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-opacity ${
        deleting ? 'opacity-30' : ''
      }`}
    >
      {/* Card body - links to detail */}
      <Link href={`/article/${article.id}`} className="block group mb-3">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-2 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
          {article.title || 'Untitled'}
        </h3>

        {summaryLines.length > 0 && (
          <ul className="space-y-1 mb-2">
            {summaryLines.map((line, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="text-sky-400 flex-shrink-0 mt-0.5">•</span>
                <span className="line-clamp-1">{line}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-1 mb-2">
          {article.tags.slice(0, 4).map((tag) => (
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

      {/* Action buttons */}
      <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-xs py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-sky-400 hover:text-sky-500 transition-colors"
        >
          🔗 元記事を開く
        </a>
        <button
          onClick={handleCopy}
          className="flex-1 text-center text-xs py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-sky-400 hover:text-sky-500 transition-colors"
        >
          {copied ? '✓ コピー済み' : '📋 要約をコピー'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-red-400 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
