import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Article } from '../types';

export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setArticles(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  return { articles, loading, error, fetchArticles };
}
