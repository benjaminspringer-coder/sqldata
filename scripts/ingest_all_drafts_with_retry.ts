import { pool } from '../src/db/index.ts';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://corestats.pro/',
  'Origin': 'https://corestats.pro',
};

async function fetchWithRetry(url: string, retries = 7): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        const waitMs = 2000 * Math.pow(1.5, attempt);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return null;
}

function cleanTag(t?: string): string {
  if (!t) return '';
  return t.replace(/^#/, '').trim().toUpperCase();
}

async function runFullIngestion() {
  console.log('🚀 Starting Comprehensive Ingestion across ALL 12 August 2026 Brackets & Regions...');

  const listData = await fetchWithRetry('https://corestats.pro/api/brackets/list');
  if (!listData || !listData.brackets) {
    console.error('Failed to fetch bracket list from Corestats');
    process.exit(1);
  }

  const augustBrackets = listData.brackets.filter((b: any) => b.month === 'August 2026');
  console.log(`Found ${augustBrackets.length} August brackets:`, augustBrackets.map((b: any) => `${b.region} ${b.stageLabel}`));

  let totalMatchesIngested = 0;
  let totalDraftGamesSaved = 0;

  for (const b of augustBrackets) {
    const region = b.region || 'EMEA';
    const stage = b.stageLabel || 'QD1';
    console.log(`\n--------------------------------------------------`);
    console.log(`📦 Processing ${region} ${stage} (${b.download_url})...`);

    const bData = await fetchWithRetry(`https://corestats.pro/api/brackets/data?url=${b.download_url}`);
    if (!bData || !bData.data || !Array.isArray(bData.data.match)) {
      console.error(`Failed to fetch bracket data for ${region} ${stage}`);
      continue;
    }

    const rawMatches = bData.data.match;
    console.log(`Bracket contains ${rawMatches.length} raw matches.`);

    // 0. Ensure bracket exists in brackets table
    await pool.query(
      `INSERT INTO brackets (uuid, month, region, stage, stage_label, segment_name, match_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       ON CONFLICT (uuid) DO UPDATE SET
         stage_label = EXCLUDED.stage_label,
         match_count = EXCLUDED.match_count;`,
      [b.download_url, 'August 2026', region, stage, b.stageLabel || stage, b.segment_name || '', rawMatches.length]
    );

    for (const m of rawMatches) {
      const matchUuid = m.id;
      const t1 = m.opponent1;
      const t2 = m.opponent2;
      const t1Name = t1?.name || null;
      const t2Name = t2?.name || null;
      const t1Players = t1?.players || null;
      const t2Players = t2?.players || null;
      const t1Score = t1?.score ?? 0;
      const t2Score = t2?.score ?? 0;
      const isBye = t1?.is_bye || t2?.is_bye || false;
      const isForfeit = t1?.forfeit || t2?.forfeit || false;
      const winnerName = t1?.result === 'win' ? t1Name : (t2?.result === 'win' ? t2Name : null);
      const format = m.format || 'best_of_1';
      const roundId = m.round_id || 1;
      const matchNumber = m.number || 1;

      // 1. Save match to PostgreSQL matches table
      await pool.query(
        `INSERT INTO matches (
          match_uuid, bracket_uuid, region, stage, month, round_id, match_number,
          format, team1_name, team2_name, team1_score, team2_score,
          team1_players, team2_players, winner_name, is_bye, is_forfeit
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (match_uuid) DO UPDATE SET
          team1_name = EXCLUDED.team1_name,
          team2_name = EXCLUDED.team2_name,
          team1_score = EXCLUDED.team1_score,
          team2_score = EXCLUDED.team2_score,
          team1_players = EXCLUDED.team1_players,
          team2_players = EXCLUDED.team2_players,
          winner_name = EXCLUDED.winner_name,
          is_bye = EXCLUDED.is_bye,
          is_forfeit = EXCLUDED.is_forfeit;`,
        [
          matchUuid, b.download_url, region, stage, 'August 2026', roundId, matchNumber,
          format, t1Name, t2Name, t1Score, t2Score,
          t1Players ? JSON.stringify(t1Players) : null,
          t2Players ? JSON.stringify(t2Players) : null,
          winnerName, isBye, isForfeit
        ]
      );
      totalMatchesIngested++;

      // Skip live draft fetch if match is bye or forfeit or missing players
      if (isBye || isForfeit || !t1Name || t1Name === 'TBD' || !t2Name || t2Name === 'TBD') {
        continue;
      }

      // Small throttle to avoid hitting Cloudflare 429 rate limit
      await new Promise(r => setTimeout(r, 120));

      // 2. Fetch live draft details for this match
      const dData = await fetchWithRetry(`https://corestats.pro/api/match/live/${matchUuid}`);
      if (!dData || !Array.isArray(dData.data) || dData.data.length === 0) {
        continue;
      }

      // Build tag -> player name lookup for both teams
      const t1TagMap = new Map<string, string>();
      const t2TagMap = new Map<string, string>();
      if (Array.isArray(t1Players)) {
        for (const p of t1Players) {
          if (p.tag) t1TagMap.set(cleanTag(p.tag), p.name);
        }
      }
      if (Array.isArray(t2Players)) {
        for (const p of t2Players) {
          if (p.tag) t2TagMap.set(cleanTag(p.tag), p.name);
        }
      }

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
            let t1PlayerPicks: Array<{ player: string; tag: string; brawler: string }> = [];
            let t2PlayerPicks: Array<{ player: string; tag: string; brawler: string }> = [];
            let t1Won = false;
            let t2Won = false;

            if (g.teams) {
              for (let gi = 0; gi < g.teams.length; gi++) {
                const gt = g.teams[gi];
                const isWinner = gt.isWinner || false;
                const playerPicksList: Array<{ player: string; tag: string; brawler: string }> = [];
                const picksList: string[] = [];

                if (Array.isArray(gt.players)) {
                  for (const p of gt.players) {
                    const brawlerName = p.brawler?.name || null;
                    if (brawlerName) {
                      picksList.push(brawlerName);
                      const tagClean = cleanTag(p.tag);
                      let playerName = p.name || null;
                      if (!playerName && gi === 0 && t1TagMap.has(tagClean)) {
                        playerName = t1TagMap.get(tagClean)!;
                      } else if (!playerName && gi === 1 && t2TagMap.has(tagClean)) {
                        playerName = t2TagMap.get(tagClean)!;
                      }
                      playerPicksList.push({
                        player: playerName || tagClean || 'Unknown Player',
                        tag: tagClean,
                        brawler: brawlerName,
                      });
                    }
                  }
                }

                if (gi === 0) {
                  t1Picks = picksList;
                  t1PlayerPicks = playerPicksList;
                  t1Won = isWinner;
                } else {
                  t2Picks = picksList;
                  t2PlayerPicks = playerPicksList;
                  t2Won = isWinner;
                }
              }
            }

            const draftKey = `set${setIndex}-game${gameIndex}-${region.toLowerCase()}-${stage.toLowerCase()}-${matchUuid}`;

            await pool.query(
              `INSERT INTO draft_games (
                draft_key, match_uuid, game_num, round_id, region, stage,
                map_name, game_mode, team1_name, team2_name,
                team1_bans, team2_bans, team1_picks, team2_picks,
                team1_players, team2_players, team1_player_picks, team2_player_picks,
                team1_won, team2_won
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
              ON CONFLICT (draft_key) DO UPDATE SET
                map_name = EXCLUDED.map_name,
                game_mode = EXCLUDED.game_mode,
                team1_bans = EXCLUDED.team1_bans,
                team2_bans = EXCLUDED.team2_bans,
                team1_picks = EXCLUDED.team1_picks,
                team2_picks = EXCLUDED.team2_picks,
                team1_players = EXCLUDED.team1_players,
                team2_players = EXCLUDED.team2_players,
                team1_player_picks = EXCLUDED.team1_player_picks,
                team2_player_picks = EXCLUDED.team2_player_picks,
                team1_won = EXCLUDED.team1_won,
                team2_won = EXCLUDED.team2_won;`,
              [
                draftKey, matchUuid, gameIndex, roundId, region, stage,
                loc.name || null, loc.gameMode || null, t1Name, t2Name,
                JSON.stringify(t1Bans), JSON.stringify(t2Bans),
                JSON.stringify(t1Picks), JSON.stringify(t2Picks),
                t1Players ? JSON.stringify(t1Players) : null,
                t2Players ? JSON.stringify(t2Players) : null,
                JSON.stringify(t1PlayerPicks), JSON.stringify(t2PlayerPicks),
                t1Won, t2Won
              ]
            );
            totalDraftGamesSaved++;
          }
        }
      }
    }
    console.log(`✅ Completed ${region} ${stage}. Current total saved draft games: ${totalDraftGamesSaved}`);
  }

  console.log(`\n🎉 COMPLETED ALL INGESTION! Saved ${totalMatchesIngested} match records and ${totalDraftGamesSaved} draft game sets with player brawler picks across all regions!`);
  process.exit(0);
}

runFullIngestion();
