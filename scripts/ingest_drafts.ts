import { db } from '../src/db/index.ts';
import { draftGames, matches } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://corestats.pro/',
  'Origin': 'https://corestats.pro',
};

async function runDraftIngestion() {
  console.log('🚀 Starting Draft Ingestion directly into Cloud SQL PostgreSQL...');

  const allMatches = await db.select().from(matches);
  console.log(`Found ${allMatches.length} total matches in PostgreSQL.`);

  const activeMatches = allMatches.filter(m => !m.isBye && !m.isForfeit);
  console.log(`Found ${activeMatches.length} active matches to check for live draft data.`);

  let totalDraftsInserted = 0;

  for (let i = 0; i < activeMatches.length; i += 10) {
    const batch = activeMatches.slice(i, i + 10);

    await Promise.all(batch.map(async (m) => {
      try {
        const dRes = await fetch(`https://corestats.pro/api/match/live/${m.matchUuid}`, { headers });
        if (!dRes.ok) return;
        const dData = await dRes.json();
        if (!dData || !Array.isArray(dData.data)) return;

        let setIndex = 0;
        for (const item of dData.data) {
          setIndex++;
          let t1Bans: string[] = [];
          let t2Bans: string[] = [];
          if (item.teams) {
            for (const t of item.teams) {
              const bans = (t.bans || []).map((x: any) => x.name).filter(Boolean);
              if (t.side === 0) t1Bans = bans;
              else if (t.side === 1) t2Bans = bans;
            }
          }

          if (item.games && item.games.length > 0) {
            let gameIndex = 0;
            for (const g of item.games) {
              gameIndex++;
              const loc = g.location || {};
              let t1Picks: string[] = [];
              let t2Picks: string[] = [];
              let t1Won = false;
              let t2Won = false;

              if (g.teams) {
                for (let gi = 0; gi < g.teams.length; gi++) {
                  const gt = g.teams[gi];
                  const picks = (gt.players || []).map((p: any) => p.brawler ? p.brawler.name : null).filter(Boolean);
                  if (gi === 0) { t1Picks = picks; t1Won = gt.isWinner || false; }
                  else { t2Picks = picks; t2Won = gt.isWinner || false; }
                }
              }

              const draftKey = `set${setIndex}-game${gameIndex}-${m.region.toLowerCase()}-${m.stage.toLowerCase()}-${m.matchUuid}`;
              await db.insert(draftGames)
                .values({
                  draftKey,
                  matchUuid: m.matchUuid,
                  gameNum: gameIndex,
                  region: m.region,
                  stage: m.stage,
                  roundId: m.roundId || 1,
                  mapName: loc.name || null,
                  gameMode: loc.gameMode || null,
                  team1Name: m.team1Name || null,
                  team2Name: m.team2Name || null,
                  team1Bans: t1Bans,
                  team2Bans: t2Bans,
                  team1Picks: t1Picks,
                  team2Picks: t2Picks,
                  team1Won: t1Won,
                  team2Won: t2Won,
                })
                .onConflictDoUpdate({
                  target: draftGames.draftKey,
                  set: {
                    mapName: loc.name || null,
                    gameMode: loc.gameMode || null,
                    team1Bans: t1Bans,
                    team2Bans: t2Bans,
                    team1Picks: t1Picks,
                    team2Picks: t2Picks,
                    team1Won: t1Won,
                    team2Won: t2Won,
                  },
                });
              totalDraftsInserted++;
            }
          }
        }
      } catch (e) {}
    }));

    if ((i + 10) % 100 === 0 || i + 10 >= activeMatches.length) {
      console.log(`Processed ${Math.min(i + 10, activeMatches.length)}/${activeMatches.length} matches... Drafts inserted: ${totalDraftsInserted}`);
    }
  }

  console.log(`\n🎉 Ingestion complete! Total draft games inserted: ${totalDraftsInserted}`);
  process.exit(0);
}

runDraftIngestion();
