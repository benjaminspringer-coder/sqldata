import { pool } from '../src/db/index.ts';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://corestats.pro/',
  'Origin': 'https://corestats.pro',
};

async function populateAllPlayers() {
  console.log('🚀 Fetching brackets from Corestats to populate player rosters...');
  
  try {
    console.log('Starting player roster population across all August brackets...');
    const listRes = await fetch('https://corestats.pro/api/brackets/list', { headers });
    const listData = await listRes.json();
    const augustBrackets = (listData.brackets || []).filter((b: any) =>
      b.month === 'August 2026' && (b.stageLabel === 'QDay1' || b.stageLabel === 'QDay2')
    );

    console.log(`Found ${augustBrackets.length} August brackets.`);

    let updatedMatches = 0;
    let updatedDrafts = 0;

    for (const b of augustBrackets) {
      console.log(`Processing ${b.region} ${b.stageLabel} (${b.download_url})...`);
      const bRes = await fetch(`https://corestats.pro/api/brackets/data?url=${b.download_url}`, { headers });
      const bData = await bRes.json();
      const rawMatches = bData?.data?.match || [];

      for (const m of rawMatches) {
        const mUuid = m.id;
        const p1 = m.opponent1?.players || null;
        const p2 = m.opponent2?.players || null;

        if (p1 || p2) {
          // Update matches table
          const mRes = await pool.query(
            `UPDATE matches SET team1_players = $1, team2_players = $2 WHERE match_uuid = $3`,
            [p1 ? JSON.stringify(p1) : null, p2 ? JSON.stringify(p2) : null, mUuid]
          );
          updatedMatches += mRes.rowCount || 0;

          // Update draft_games table
          const dRes = await pool.query(
            `UPDATE draft_games SET team1_players = $1, team2_players = $2 WHERE match_uuid = $3`,
            [p1 ? JSON.stringify(p1) : null, p2 ? JSON.stringify(p2) : null, mUuid]
          );
          updatedDrafts += dRes.rowCount || 0;
        }
      }
    }

    console.log(`✅ Successfully updated ${updatedMatches} matches and ${updatedDrafts} draft games with player rosters!`);
  } catch (err) {
    console.error('Error populating players:', err);
  } finally {
    process.exit(0);
  }
}

populateAllPlayers();
