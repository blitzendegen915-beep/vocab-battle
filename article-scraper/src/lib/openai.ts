import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY!,
  dangerouslyAllowBrowser: true,
});

export interface SummaryResult {
  summary: string;
  tags: string[];
}

export async function summarizeArticle(
  title: string,
  content: string
): Promise<SummaryResult> {
  const prompt = `以下の記事を3行で要約し、関連タグを3〜5個生成してください。

タイトル: ${title}
内容: ${content.slice(0, 3000)}

以下のJSON形式だけで返してください:
{
  "summary": "1行目\n2行目\n3行目",
  "tags": ["タグ1", "タグ2", "タグ3"]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 500,
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  const result = JSON.parse(raw) as { summary?: string; tags?: string[] };

  return {
    summary: result.summary ?? '',
    tags: result.tags ?? [],
  };
}
