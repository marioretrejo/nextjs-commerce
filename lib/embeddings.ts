const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS  = 1536;
const MAX_INPUT_CHARS = 30_000; // ~8k tokens

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) return null;

  const input = text.slice(0, MAX_INPUT_CHARS).replace(/\n+/g, ' ').trim();
  if (!input) return null;

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    data: { embedding: number[] }[];
  };
  return data.data[0]?.embedding ?? null;
}

export function chunkText(
  text: string,
  chunkSize = 1200,
  overlap    = 150
): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = start + chunkSize;
    // Break at paragraph or sentence boundary if possible
    if (end < cleaned.length) {
      const paraBreak = cleaned.lastIndexOf('\n\n', end);
      const sentBreak = cleaned.lastIndexOf('. ', end);
      if (paraBreak > start + overlap) end = paraBreak + 2;
      else if (sentBreak > start + overlap) end = sentBreak + 2;
    }
    chunks.push(cleaned.slice(start, end).trim());
    start = end - overlap;
  }
  return chunks.filter(Boolean);
}

export { EMBEDDING_DIMS };
