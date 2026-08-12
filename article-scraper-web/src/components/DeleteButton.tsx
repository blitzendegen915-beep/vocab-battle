'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from('articles').delete().eq('id', id);
    router.push('/');
    router.refresh();
  };

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-500 border border-red-300 dark:border-red-700 rounded-xl px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
        >
          {deleting ? '削除中...' : '削除する'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-slate-500 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          キャンセル
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-red-400 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
    >
      🗑️ 削除
    </button>
  );
}
