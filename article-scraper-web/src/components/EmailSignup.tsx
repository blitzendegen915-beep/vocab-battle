'use client';

import { useState } from 'react';

export function EmailSignup() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // MVP: UIのみ。将来的にResend・Mailchimp等へ接続する
    setSubmitted(true);
  };

  return (
    <section className="mt-16 pt-10 border-t border-slate-200 dark:border-slate-700 text-center">
      <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">Coming Soon</p>
      <h2 className="text-lg font-bold mb-2">📱 iPhone版を準備中です</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Safariから直接共有できるiPhoneアプリを開発中です。
        <br />
        公開時にお知らせします。
      </p>

      {submitted ? (
        <p className="text-sm text-sky-600 dark:text-sky-400 font-medium">
          ✓ 登録しました。公開時にご連絡します！
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap"
          >
            通知を受け取る
          </button>
        </form>
      )}
    </section>
  );
}
