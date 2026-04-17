// Endpoint: /api/trello
// Busca os 6 boards do Grupo DNX (em paralelo) e devolve no formato que o frontend espera.
// Credenciais ficam em process.env.TRELLO_KEY e process.env.TRELLO_TOKEN.

const BOARDS = [
  { name: 'Marca Pablo',                 id: '4ywtniSA' },
  { name: 'DNX HOTELARIA - Projeto Ohana', id: 'BUZyEHjw' },
  { name: 'GRUPO DNX | Ceará Autoral',   id: 'BcDgqTML' },
  { name: "JORNADA DE CAMPANHAS'26",     id: 'RRhzNGUS' },
  { name: 'DNX HOTELARIA - Farol',       id: 'iYQB3Zmn' },
  { name: 'HUB NB BY DESCO',             id: 'zwjOYT9q' }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cache de 60 segundos
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const KEY = process.env.TRELLO_KEY;
  const TOKEN = process.env.TRELLO_TOKEN;

  if (!KEY || !TOKEN) {
    return res.status(500).json({
      error: 'TRELLO_KEY ou TRELLO_TOKEN não configurados no Vercel. Vai em Settings → Environment Variables.'
    });
  }

  try {
    // Busca os 6 boards em paralelo (muito mais rápido)
    const boardsData = await Promise.all(BOARDS.map(async (board) => {
      // Listas do board
      const listsRes = await fetch(
        `https://api.trello.com/1/boards/${board.id}/lists?key=${KEY}&token=${TOKEN}`
      );
      if (!listsRes.ok) {
        return { name: board.name, cards: [], error: `Lists: ${listsRes.status}` };
      }
      const lists = await listsRes.json();
      const listMap = {};
      lists.forEach(l => { listMap[l.id] = l.name; });

      // Cards do board (todos, não só os abertos, pra refletir o que o HTML original tinha)
      const cardsRes = await fetch(
        `https://api.trello.com/1/boards/${board.id}/cards?key=${KEY}&token=${TOKEN}&fields=name,due,dueComplete,shortUrl,idList`
      );
      if (!cardsRes.ok) {
        return { name: board.name, cards: [], error: `Cards: ${cardsRes.status}` };
      }
      const cards = await cardsRes.json();

      return {
        name: board.name,
        cards: cards.map(c => ({
          name: c.name,
          list: listMap[c.idList] || '',
          due: c.due ? c.due.split('T')[0] : null,
          dueComplete: !!c.dueComplete,
          url: c.shortUrl || ''
        }))
      };
    }));

    res.status(200).json(boardsData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
