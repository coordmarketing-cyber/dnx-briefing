export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_KEY = process.env.NOTION_KEY;
  const DB_ID = 'bf3d8a4d-6e2c-4306-a2ef-e82322d89209';

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: { property: 'Status', status: { does_not_equal: 'Publicado' } },
        sorts: [{ property: 'Data de publicação', direction: 'ascending' }],
        page_size: 50
      })
    });
    const data = await response.json();
    const items = (data.results || []).map(p => ({
      name: p.properties?.Name?.title?.[0]?.plain_text || '',
      marca: (p.properties?.Marca?.multi_select || []).map(m => m.name).join(', '),
      canal: (p.properties?.Canal?.multi_select || []).map(c => c.name).join(', '),
      formato: (p.properties?.Formato?.multi_select || []).map(f => f.name).join(', '),
      status: p.properties?.Status?.status?.name || '',
      due: p.properties?.['Data de publicação']?.date?.start?.split('T')[0] || null,
      url: p.url || ''
    }));
    res.status(200).json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
