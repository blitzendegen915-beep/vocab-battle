import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractMetaContent(html: string, property: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      'i'
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

function extractTitle(html: string): string {
  const og = extractMetaContent(html, 'og:title');
  if (og) return og;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : 'Untitled';
}

function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string };
    const url = body.url;
    if (!url) {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 });
    }

    // Server-side fetch - no CORS restriction
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!fetchRes.ok) {
      throw new Error(`ページの取得に失敗しました (HTTP ${fetchRes.status})`);
    }

    const html = await fetchRes.text();
    const title = extractTitle(html);
    const content = extractText(html);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `以下の記事を3行で要約し、関連タグを3〜5個生成してください。

タイトル: ${title}
内容: ${content.slice(0, 3000)}

以下のJSON形式だけで返してください:
{"summary":"要約1行目\n要約2行目\n要約3行目","tags":["tag1","tag2","tag3"]}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const result = JSON.parse(
      completion.choices[0]?.message?.content ?? '{}'
    ) as { summary?: string; tags?: string[] };

    return NextResponse.json({
      title,
      summary: result.summary ?? '',
      tags: result.tags ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
