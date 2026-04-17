// Endpoint: /api/trello
// Busca os 6 boards do Grupo DNX (em paralelo) e devolve no formato que o frontend espera.
// Credenciais ficam em process.env.TRELLO_KEY e process.env.TRELLO_TOKEN.

// IMPORTANTE: usamos os IDs LONGOS dos boards (24 caracteres), obtidos via /1/members/me/boards.
// IDs curtos (da URL) às vezes não funcionam nos endpoints de lists/cards.
const BOARDS = [
  { name: 'Marca Pablo',                   id: '69c5223867d694afd7d17e4d' },
  { name: 'DNX HOTELARIA - Projeto Ohana', id: '69c145907c0ee3cd89c50cad' },
  { name: 'GRUPO DNX | Ceará Autoral',     id: '69c2b29bd9183074fd575b9f' },
  { name: "JORNADA DE CAMPANHAS'26",       id: '697a1c4abd45ce76bea89fb3' },
  { name: 'DNX HOTELARIA - Farol',         id: '69c290d58c04dbc806ae7723' },
  { name: 'HUB NB BY DESCO',               id: '69c66fcbfbf6936927e1d5f0' }
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

      // Cards do board
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
