// Clean up Tomorrow list - remove June 1st events, keep only June 2nd events
export default async function handler(req, res) {
  try {
    console.log('🧹 Cleaning up Tomorrow list...');
    
    const config = {
      TRELLO_API_KEY: process.env.TRELLO_API_KEY,
      TRELLO_TOKEN: process.env.TRELLO_TOKEN,
      TOMORROW_LIST_ID: process.env.TOMORROW_LIST_ID
    };
    
    // Get current Tomorrow cards
    const tomorrowCards = await getTrelloCards(config.TOMORROW_LIST_ID, config);
    console.log(`📋 Found ${tomorrowCards.length} cards in Tomorrow list`);
    
    let deleted = 0;
    let kept = 0;
    
    for (const card of tomorrowCards) {
      const eventId = card.desc?.match(/🔗 Event ID: ([a-zA-Z0-9_-]+)/)?.[1];
      
      // Check if this is a June 1st event (should be deleted)
      if (eventId && eventId.includes('_20250601')) {
        try {
          await deleteCard(card.id, config);
          deleted++;
          console.log(`❌ Deleted June 1st event: ${card.name}`);
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`❌ Failed to delete: ${card.name}`, error);
        }
      } else {
        kept++;
        console.log(`✅ Kept: ${card.name} (${eventId || 'no event ID'})`);
      }
    }
    
    console.log('🧹 Cleanup completed!');
    
    return res.status(200).json({
      success: true,
      message: 'Tomorrow list cleanup completed',
      result: {
        deleted: deleted,
        kept: kept,
        total: tomorrowCards.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function getTrelloCards(listId, config) {
  const url = `https://api.trello.com/1/lists/${listId}/cards`;
  const params = new URLSearchParams({
    key: config.TRELLO_API_KEY,
    token: config.TRELLO_TOKEN
  });

  const response = await fetch(`${url}?${params}`);
  if (!response.ok) throw new Error(`Trello API error: ${response.statusText}`);
  return await response.json();
}

async function deleteCard(cardId, config) {
  const url = `https://api.trello.com/1/cards/${cardId}`;
  const params = new URLSearchParams({
    key: config.TRELLO_API_KEY,
    token: config.TRELLO_TOKEN
  });

  const response = await fetch(`${url}?${params}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) throw new Error(`Trello API error: ${response.statusText}`);
  return true;
}