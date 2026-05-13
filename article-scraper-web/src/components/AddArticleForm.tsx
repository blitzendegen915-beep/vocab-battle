'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function AddArticleForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    const targetUrl =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;

    setLoading(true);
    setError('');

    try {
      setStatus('記事を取得中...');
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = (await res.json()) as {
        title?: string;
        summary?: string;
        tags?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? '取得に失敗しました');

      setStatus('保存中...');
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
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
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

      {status && (
        <p className="text-sm text-sky-600 dark:text-sky-400 flex items-center gap-1">
          <span className="inline-block animate-spin">↻</span> {status}
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
