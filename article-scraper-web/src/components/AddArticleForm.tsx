'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const SAMPLE_URL = 'https://ja.wikipedia.org/wiki/%E7%94%9F%E6%88%90AI';

const STEPS = [
  '記事を取得しています...',
  '本文を読み取っています...',
  '3行要約を作成しています...',
  'タグを整理しています...',
  '保存しています...',
];

export function AddArticleForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState('');

  const processUrl = async (targetUrl: string) => {
    setLoading(true);
    setError('');
    setStepIndex(0);

    const timer = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 2));
    }, 1500);

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = (await res.json()) as { title?: string; summary?: string; tags?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? '取得に失敗しました');

      clearInterval(timer);
      setStepIndex(STEPS.length - 1);

      const { error: dbErr } = await supabase.from('articles').insert({
        url: targetUrl,
        title: data.title,
        summary: data.summary,
        tags: data.tags,
      });
      if (dbErr) throw dbErr;

      setUrl('');
      router.refresh();
    } catch (e) {
      clearInterval(timer);
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setLoading(false);
      setStepIndex(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const target = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed : `https://${trimmed}`;
    await processUrl(target);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white px-5 py-3 text-sm font-semibold disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? '処理中…' : '保存'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => processUrl(SAMPLE_URL)}
          disabled={loading}
          className="w-full rounded-xl border border-dashed border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/20 px-4 py-2.5 text-sm text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors disabled:opacity-50"
        >
          ✨ サンプル記事で試す
        </button>
      </form>

      {loading && (
        <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 px-4 py-4 space-y-2">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-sm transition-all ${
                i === stepIndex
                  ? 'text-sky-600 dark:text-sky-400 font-medium'
                  : i < stepIndex
                  ? 'text-slate-400 line-through'
                  : 'text-slate-300 dark:text-slate-600'
              }`}
            >
              <span className="w-4 text-center">
                {i < stepIndex ? '✓' : i === stepIndex ? '↻' : '○'}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500 px-1">{error}</p>}
    </div>
  );
}
