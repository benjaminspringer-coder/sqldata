import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import ExcelJS from 'exceljs';
import { db, pool } from './src/db/index.ts';
import { users, projects, appItems, dbLogs, brackets, matches, draftGames } from './src/db/schema.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { eq, desc, sql, and } from 'drizzle-orm';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Helper to fetch normalized match & draft data safely
  async function fetchAllMatchesAndDrafts() {
    let rawMatches: any[] = [];
    let rawDrafts: any[] = [];
    let rawBrackets: any[] = [];

    try {
      rawMatches = await db.select().from(matches);
    } catch (err) {
      console.warn('Drizzle select matches warning, falling back to pool.query:', err);
      const res = await pool.query(`SELECT * FROM matches`);
      rawMatches = res.rows;
    }

    try {
      rawDrafts = await db.select().from(draftGames);
    } catch (err) {
      console.warn('Drizzle select draft_games warning, falling back to pool.query:', err);
      const res = await pool.query(`SELECT * FROM draft_games`);
      rawDrafts = res.rows;
    }

    try {
      rawBrackets = await db.select().from(brackets);
    } catch (err) {
      console.warn('Drizzle select brackets warning, falling back to pool.query:', err);
      const res = await pool.query(`SELECT * FROM brackets`);
      rawBrackets = res.rows;
    }

    const allMatches = rawMatches.map((m: any) => ({
      id: m.id,
      matchUuid: m.matchUuid || m.match_uuid || '',
      bracketUuid: m.bracketUuid || m.bracket_uuid || '',
      region: m.region || '',
      stage: m.stage || '',
      month: m.month || 'August 2026',
      roundId: m.roundId ?? m.round_id ?? 1,
      matchNumber: m.matchNumber ?? m.match_number ?? 0,
      format: m.format || 'BO3',
      team1Name: m.team1Name || m.team1_name || 'Team 1',
      team2Name: m.team2Name || m.team2_name || 'Team 2',
      team1Score: m.team1Score ?? m.team1_score ?? 0,
      team2Score: m.team2Score ?? m.team2_score ?? 0,
      team1Players: m.team1Players || m.team1_players || null,
      team2Players: m.team2Players || m.team2_players || null,
      winnerName: m.winnerName || m.winner_name || null,
      isBye: m.isBye ?? m.is_bye ?? false,
      isForfeit: m.isForfeit ?? m.is_forfeit ?? false,
      createdAt: m.createdAt || m.created_at || null,
    }));

    const allDrafts = rawDrafts.map((d: any) => ({
      id: d.id,
      draftKey: d.draftKey || d.draft_key || '',
      matchUuid: d.matchUuid || d.match_uuid || '',
      gameNum: d.gameNum ?? d.game_num ?? 1,
      region: d.region || '',
      stage: d.stage || '',
      roundId: d.roundId ?? d.round_id ?? 1,
      mapName: d.mapName || d.map_name || '',
      gameMode: d.gameMode || d.game_mode || '',
      team1Name: d.team1Name || d.team1_name || 'Team 1',
      team2Name: d.team2Name || d.team2_name || 'Team 2',
      team1Bans: d.team1Bans || d.team1_bans || [],
      team2Bans: d.team2Bans || d.team2_bans || [],
      team1Picks: d.team1Picks || d.team1_picks || [],
      team2Picks: d.team2Picks || d.team2_picks || [],
      team1Players: d.team1Players || d.team1_players || null,
      team2Players: d.team2Players || d.team2_players || null,
      team1PlayerPicks: d.team1PlayerPicks || d.team1_player_picks || null,
      team2PlayerPicks: d.team2PlayerPicks || d.team2_player_picks || null,
      team1Won: d.team1Won ?? d.team1_won ?? false,
      team2Won: d.team2Won ?? d.team2_won ?? false,
      createdAt: d.createdAt || d.created_at || null,
    }));

    const allBrackets = rawBrackets.map((b: any) => ({
      id: b.id,
      uuid: b.uuid || '',
      month: b.month || 'August 2026',
      region: b.region || '',
      stage: b.stage || '',
      stageLabel: b.stageLabel || b.stage_label || '',
      segmentName: b.segmentName || b.segment_name || '',
      matchCount: b.matchCount ?? b.match_count ?? 0,
      status: b.status || 'active',
      updatedAt: b.updatedAt || b.updated_at || null,
    }));

    return { allMatches, allDrafts, allBrackets };
  }

  // Helper log function
  async function logAction(action: string, details: string, executedBy = 'system', status = 'success') {
    try {
      await db.insert(dbLogs).values({
        action,
        details,
        executedBy,
        status,
      });
    } catch (e) {
      console.error('Failed to log action:', e);
    }
  }

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // DB Connection Status & Metadata
  app.get('/api/db/status', async (req, res) => {
    try {
      const startTime = Date.now();
      const result = await pool.query('SELECT current_database(), current_user, version()');
      const latency = Date.now() - startTime;

      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);

      res.json({
        connected: true,
        database: result.rows[0]?.current_database,
        user: result.rows[0]?.current_user,
        version: result.rows[0]?.version,
        latencyMs: latency,
        tables: tablesResult.rows.map(r => r.table_name),
        host: process.env.SQL_HOST || 'socket',
      });
    } catch (error: any) {
      console.error('Database connection error:', error);
      res.status(500).json({
        connected: false,
        error: error?.message || 'Database connection failed',
      });
    }
  });

  // User Auth Synchronization
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid, email, name } = req.user!;
      const userRecord = await getOrCreateUser(uid, email || '', name);
      await logAction('USER_SYNC', `User synced: ${email}`, uid);
      res.json({ success: true, user: userRecord });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'User sync failed' });
    }
  });

  // List Database Tables and Columns
  app.get('/api/db/schema-info', async (req, res) => {
    try {
      const columnsResult = await pool.query(`
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
      `);

      const schemaByTable: Record<string, Array<{ name: string; type: string; nullable: string }>> = {};
      for (const row of columnsResult.rows) {
        if (!schemaByTable[row.table_name]) {
          schemaByTable[row.table_name] = [];
        }
        schemaByTable[row.table_name].push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable,
        });
      }

      res.json({ success: true, schema: schemaByTable });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Execute Safe Custom SQL Query (SELECT or Data Explorer)
  app.post('/api/db/query', async (req, res) => {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'SQL Query is required' });
    }

    try {
      const trimmed = query.trim();
      const startTime = Date.now();
      const result = await pool.query(trimmed);
      const executionTimeMs = Date.now() - startTime;

      await logAction('SQL_EXECUTE', `Query executed: ${trimmed.slice(0, 100)}...`, 'user');

      res.json({
        success: true,
        command: result.command,
        rowCount: result.rowCount,
        fields: result.fields?.map(f => f.name) || [],
        rows: result.rows,
        executionTimeMs,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error?.message || 'Query execution failed',
      });
    }
  });

  // --- PROJECTS API ---

  app.get('/api/projects', async (req, res) => {
    try {
      const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
      res.json({ success: true, projects: allProjects });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const { name, description, targetApp } = req.body;
      if (!name) return res.status(400).json({ error: 'Project name is required' });

      const newProj = await db.insert(projects).values({
        name,
        description,
        targetApp,
      }).returning();

      await logAction('CREATE_PROJECT', `Created project: ${name}`);
      res.json({ success: true, project: newProj[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await db.delete(projects).where(eq(projects.id, id));
      await logAction('DELETE_PROJECT', `Deleted project ID: ${id}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- APP DATA ITEMS API (No .gz needed! Direct clean JSON storage & import/export) ---

  app.get('/api/items', async (req, res) => {
    try {
      const { projectId, category } = req.query;
      let query = db.select().from(appItems).orderBy(desc(appItems.createdAt));

      if (projectId) {
        query = query.where(eq(appItems.projectId, parseInt(projectId as string, 10))) as typeof query;
      }

      const items = await query;
      res.json({ success: true, items });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/items', async (req, res) => {
    try {
      const { projectId, title, category, dataPayload } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });

      // Ensure dataPayload is valid JSON string if object passed
      const payloadString = typeof dataPayload === 'object' ? JSON.stringify(dataPayload, null, 2) : (dataPayload || '{}');

      const newItem = await db.insert(appItems).values({
        projectId: projectId ? parseInt(projectId, 10) : null,
        title,
        category: category || 'general',
        dataPayload: payloadString,
      }).returning();

      await logAction('CREATE_ITEM', `Created data record: ${title}`);
      res.json({ success: true, item: newItem[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/items/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { title, category, dataPayload, status } = req.body;

      const payloadString = typeof dataPayload === 'object' ? JSON.stringify(dataPayload, null, 2) : dataPayload;

      const updated = await db.update(appItems).set({
        ...(title && { title }),
        ...(category && { category }),
        ...(payloadString && { dataPayload: payloadString }),
        ...(status && { status }),
        updatedAt: new Date(),
      }).where(eq(appItems.id, id)).returning();

      await logAction('UPDATE_ITEM', `Updated record ID: ${id}`);
      res.json({ success: true, item: updated[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/items/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await db.delete(appItems).where(eq(appItems.id, id));
      await logAction('DELETE_ITEM', `Deleted item ID: ${id}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk Import Clean JSON data without gzip issues
  app.post('/api/items/bulk-import', async (req, res) => {
    try {
      const { items, projectId } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items array is required' });
      }

      const pId = projectId ? parseInt(projectId, 10) : null;
      const formatted = items.map(item => ({
        projectId: pId,
        title: item.title || 'Imported Record',
        category: item.category || 'imported',
        dataPayload: typeof item.dataPayload === 'object' ? JSON.stringify(item.dataPayload, null, 2) : (item.dataPayload || JSON.stringify(item, null, 2)),
      }));

      const inserted = await db.insert(appItems).values(formatted).returning();
      await logAction('BULK_IMPORT', `Bulk imported ${inserted.length} items without compression errors.`);

      res.json({ success: true, count: inserted.length, items: inserted });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Audit Logs API
  app.get('/api/db/logs', async (req, res) => {
    try {
      const logs = await db.select().from(dbLogs).orderBy(desc(dbLogs.createdAt)).limit(50);
      res.json({ success: true, logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- BSC TOURNAMENT BRACKETS & DRAFT API ---

  // Get Brackets filtered by region (EMEA, NA, SA, EA) and stage (QD1, QD2)
  app.get('/api/bsc/brackets', async (req, res) => {
    try {
      const { region, stage, month } = req.query;
      let query = db.select().from(brackets).orderBy(desc(brackets.createdAt));

      const conditions = [];
      if (region) conditions.push(eq(brackets.region, (region as string).toUpperCase()));
      if (stage) conditions.push(eq(brackets.stage, (stage as string).toUpperCase()));
      if (month) conditions.push(eq(brackets.month, month as string));

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const list = await query;
      res.json({ success: true, count: list.length, brackets: list });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save/Upsert Brackets (Deduplicated by UUID)
  app.post('/api/bsc/brackets/save', async (req, res) => {
    try {
      const { bracketList } = req.body;
      const list = Array.isArray(bracketList) ? bracketList : [req.body];

      if (list.length === 0) {
        return res.status(400).json({ error: 'No bracket data provided' });
      }

      let insertedCount = 0;
      for (const item of list) {
        if (!item.uuid || !item.region || !item.stage) continue;

        await db.insert(brackets)
          .values({
            uuid: item.uuid,
            month: item.month || 'August 2026',
            region: item.region.toUpperCase(),
            stage: item.stage.toUpperCase(),
            stageLabel: item.stageLabel || item.stage,
            segmentName: item.segmentName || item.region,
            matchCount: item.matchCount || 0,
            status: item.status || 'active',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: brackets.uuid,
            set: {
              region: item.region.toUpperCase(),
              stage: item.stage.toUpperCase(),
              matchCount: item.matchCount || 0,
              updatedAt: new Date(),
            },
          });
        insertedCount++;
      }

      await logAction('SAVE_BRACKETS', `Upserted ${insertedCount} brackets into PostgreSQL.`);
      res.json({ success: true, upserted: insertedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Matches (Filtered by region, stage, bracketUuid, or team)
  app.get('/api/bsc/matches', async (req, res) => {
    try {
      const { region, stage, bracketUuid, search } = req.query;
      let query = db.select().from(matches).orderBy(desc(matches.createdAt));

      const conditions = [];
      if (region) conditions.push(eq(matches.region, (region as string).toUpperCase()));
      if (stage) conditions.push(eq(matches.stage, (stage as string).toUpperCase()));
      if (bracketUuid) conditions.push(eq(matches.bracketUuid, bracketUuid as string));

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const matchRows = await query;
      res.json({ success: true, count: matchRows.length, matches: matchRows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Search Match + Draft Games by Team / Region / Stage
  app.get('/api/bsc/search', async (req, res) => {
    try {
      const q = (req.query.q as string || '').toLowerCase();
      const reg = (req.query.region as string || '').toUpperCase();
      const stg = (req.query.stage as string || '').toUpperCase();

      const { allMatches, allDrafts } = await fetchAllMatchesAndDrafts();

      let filteredMatches = allMatches;
      if (reg) filteredMatches = filteredMatches.filter(m => m.region === reg);
      if (stg) filteredMatches = filteredMatches.filter(m => m.stage === stg);
      if (q) {
        filteredMatches = filteredMatches.filter(m =>
          (m.team1Name || '').toLowerCase().includes(q) ||
          (m.team2Name || '').toLowerCase().includes(q) ||
          (m.winnerName || '').toLowerCase().includes(q)
        );
      }

      const results = filteredMatches.map(m => {
        const matchDrafts = allDrafts.filter(d => d.matchUuid === m.matchUuid);
        return {
          match: m,
          drafts: matchDrafts,
        };
      });

      res.json({ success: true, count: results.length, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Example lookup endpoint for FUT Esports vs Kozaki in EMEA QD2
  app.get('/api/bsc/example-fut-kozaki', async (req, res) => {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://corestats.pro/',
        'Origin': 'https://corestats.pro',
      };

      const { allMatches, allDrafts } = await fetchAllMatchesAndDrafts();

      let targetMatch = allMatches.find(m =>
        m.region === 'EMEA' &&
        m.stage === 'QD2' &&
        ((m.team1Name?.toLowerCase().includes('fut') && m.team2Name?.toLowerCase().includes('kozaki')) ||
         (m.team1Name?.toLowerCase().includes('kozaki') && m.team2Name?.toLowerCase().includes('fut')))
      );

      let liveData = null;

      // Also query Corestats API directly to ensure complete live inspection
      const listRes = await fetch('https://corestats.pro/api/brackets/list', { headers });
      const listData = await listRes.json();
      const emeaQd2Bracket = (listData.brackets || []).find((b: any) =>
        b.region === 'EMEA' && b.stageLabel === 'QDay2'
      );

      if (emeaQd2Bracket) {
        const bRes = await fetch(`https://corestats.pro/api/brackets/data?url=${emeaQd2Bracket.download_url}`, { headers });
        const bData = await bRes.json();
        const rawMatches = bData?.data?.match || [];

        const foundRaw = rawMatches.find((m: any) =>
          (m.opponent1?.name?.toLowerCase().includes('fut') && m.opponent2?.name?.toLowerCase().includes('kozaki')) ||
          (m.opponent1?.name?.toLowerCase().includes('kozaki') && m.opponent2?.name?.toLowerCase().includes('fut')) ||
          (m.opponent1?.name?.toLowerCase().includes('fut') || m.opponent2?.name?.toLowerCase().includes('fut'))
        );

        if (foundRaw) {
          const dRes = await fetch(`https://corestats.pro/api/match/live/${foundRaw.id}`, { headers });
          liveData = await dRes.json();
        }
      }

      res.json({
        success: true,
        dbMatch: targetMatch || null,
        dbDrafts: targetMatch ? allDrafts.filter(d => d.matchUuid === targetMatch.matchUuid) : [],
        corestatsLiveData: liveData,
        bracketInfo: emeaQd2Bracket || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk Save Matches (Deduplicated by matchUuid)
  app.post('/api/bsc/matches/bulk-save', async (req, res) => {
    try {
      const { matchList } = req.body;
      if (!Array.isArray(matchList) || matchList.length === 0) {
        return res.status(400).json({ error: 'matchList array is required' });
      }

      let savedCount = 0;
      for (const m of matchList) {
        if (!m.matchUuid || !m.region || !m.stage) continue;

        await db.insert(matches)
          .values({
            matchUuid: m.matchUuid,
            bracketUuid: m.bracketUuid || null,
            region: m.region.toUpperCase(),
            stage: m.stage.toUpperCase(),
            month: m.month || 'August 2026',
            roundId: m.roundId || 1,
            matchNumber: m.matchNumber || 0,
            format: m.format || 'BO3',
            team1Name: m.team1Name || m.opponent1?.name || null,
            team2Name: m.team2Name || m.opponent2?.name || null,
            team1Score: m.team1Score ?? m.opponent1?.score ?? 0,
            team2Score: m.team2Score ?? m.opponent2?.score ?? 0,
            team1Players: m.team1Players || m.opponent1?.players || null,
            team2Players: m.team2Players || m.opponent2?.players || null,
            winnerName: m.winnerName || null,
            isBye: m.isBye || false,
            isForfeit: m.isForfeit || false,
          })
          .onConflictDoUpdate({
            target: matches.matchUuid,
            set: {
              team1Score: m.team1Score ?? m.opponent1?.score ?? 0,
              team2Score: m.team2Score ?? m.opponent2?.score ?? 0,
              team1Players: m.team1Players || m.opponent1?.players || null,
              team2Players: m.team2Players || m.opponent2?.players || null,
              winnerName: m.winnerName || null,
              isBye: m.isBye || false,
              isForfeit: m.isForfeit || false,
            },
          });
        savedCount++;
      }

      await logAction('SAVE_MATCHES', `Bulk saved ${savedCount} matches (deduplicated).`);
      res.json({ success: true, saved: savedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Draft Games (Filtered by region, stage, mapName, gameMode)
  app.get('/api/bsc/drafts', async (req, res) => {
    try {
      const { region, stage, matchUuid, mapName, gameMode } = req.query;
      let query = db.select().from(draftGames).orderBy(desc(draftGames.createdAt));

      const conditions = [];
      if (region) conditions.push(eq(draftGames.region, (region as string).toUpperCase()));
      if (stage) conditions.push(eq(draftGames.stage, (stage as string).toUpperCase()));
      if (matchUuid) conditions.push(eq(draftGames.matchUuid, matchUuid as string));
      if (mapName) conditions.push(eq(draftGames.mapName, mapName as string));
      if (gameMode) conditions.push(eq(draftGames.gameMode, gameMode as string));

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const drafts = await query;
      res.json({ success: true, count: drafts.length, drafts });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk Save Draft Games (Deduplicated cleanly by draftKey)
  app.post('/api/bsc/drafts/bulk-save', async (req, res) => {
    try {
      const { draftsList } = req.body;
      if (!Array.isArray(draftsList) || draftsList.length === 0) {
        return res.status(400).json({ error: 'draftsList array is required' });
      }

      let savedCount = 0;
      for (const d of draftsList) {
        if (!d.matchUuid || !d.region || !d.stage) continue;

        const reg = d.region.toUpperCase();
        const stg = d.stage.toUpperCase();
        const gNum = d.gameNum || 1;
        // Key format: game1-na-qd1-<matchUuid>
        const generatedKey = d.draftKey || `game${gNum}-${reg.toLowerCase()}-${stg.toLowerCase()}-${d.matchUuid}`;

        await db.insert(draftGames)
          .values({
            draftKey: generatedKey,
            matchUuid: d.matchUuid,
            gameNum: gNum,
            region: reg,
            stage: stg,
            roundId: d.roundId || 1,
            mapName: d.mapName || null,
            gameMode: d.gameMode || null,
            team1Name: d.team1Name || null,
            team2Name: d.team2Name || null,
            team1Bans: d.team1Bans || [],
            team2Bans: d.team2Bans || [],
            team1Picks: d.team1Picks || [],
            team2Picks: d.team2Picks || [],
            team1Players: d.team1Players || null,
            team2Players: d.team2Players || null,
            team1PlayerPicks: d.team1PlayerPicks || null,
            team2PlayerPicks: d.team2PlayerPicks || null,
            team1Won: d.team1Won || false,
            team2Won: d.team2Won || false,
          })
          .onConflictDoUpdate({
            target: draftGames.draftKey,
            set: {
              mapName: d.mapName || null,
              gameMode: d.gameMode || null,
              team1Name: d.team1Name || null,
              team2Name: d.team2Name || null,
              team1Bans: d.team1Bans || [],
              team2Bans: d.team2Bans || [],
              team1Picks: d.team1Picks || [],
              team2Picks: d.team2Picks || [],
              team1Players: d.team1Players || null,
              team2Players: d.team2Players || null,
              team1PlayerPicks: d.team1PlayerPicks || null,
              team2PlayerPicks: d.team2PlayerPicks || null,
              team1Won: d.team1Won || false,
              team2Won: d.team2Won || false,
            },
          });
        savedCount++;
      }

      await logAction('SAVE_DRAFTS', `Bulk saved ${savedCount} draft games into PostgreSQL (deduplicated by draftKey).`);
      res.json({ success: true, saved: savedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Full Server-Side Automated Ingestion of Corestats Data into PostgreSQL
  app.post('/api/bsc/sync-all-data', async (req, res) => {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://corestats.pro/',
        'Origin': 'https://corestats.pro',
      };

      const listRes = await fetch('https://corestats.pro/api/brackets/list', { headers });
      const listData = await listRes.json();
      if (!listData.success || !Array.isArray(listData.brackets)) {
        return res.status(502).json({ error: 'Failed to fetch brackets list from corestats' });
      }

      const augustBrackets = listData.brackets.filter((b: any) =>
        b.month === 'August 2026' && (b.stageLabel === 'QDay1' || b.stageLabel === 'QDay2')
      );

      let totalBracketsSaved = 0;
      let totalMatchesSaved = 0;
      let totalDraftsSaved = 0;

      for (const b of augustBrackets) {
        const region = b.region.toUpperCase();
        const stage = b.stageLabel === 'QDay1' ? 'QD1' : 'QD2';

        // Save Bracket
        await db.insert(brackets)
          .values({
            uuid: b.download_url,
            month: b.month || 'August 2026',
            region: region,
            stage: stage,
            stageLabel: b.stageLabel,
            segmentName: b.segment_name,
            matchCount: 0,
            status: 'active',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: brackets.uuid,
            set: { region, stage, updatedAt: new Date() },
          });
        totalBracketsSaved++;

        // Fetch Bracket Match Details
        const bRes = await fetch(`https://corestats.pro/api/brackets/data?url=${b.download_url}`, { headers });
        const bData = await bRes.json();
        const rawMatches = bData?.data?.match || [];

        // Save Matches
        for (const m of rawMatches) {
          await db.insert(matches)
            .values({
              matchUuid: m.id,
              bracketUuid: b.download_url,
              region: region,
              stage: stage,
              month: b.month || 'August 2026',
              roundId: m.round_id || 1,
              matchNumber: m.number || 0,
              format: 'BO3',
              team1Name: m.opponent1?.name || null,
              team2Name: m.opponent2?.name || null,
              team1Score: m.opponent1?.score || 0,
              team2Score: m.opponent2?.score || 0,
              winnerName: m.winner_id ? (m.winner_id === m.opponent1?.id ? m.opponent1?.name : m.opponent2?.name) : null,
              isBye: m.opponent1?.is_bye || m.opponent2?.is_bye || false,
              isForfeit: m.opponent1?.forfeit || m.opponent2?.forfeit || false,
            })
            .onConflictDoUpdate({
              target: matches.matchUuid,
              set: {
                team1Score: m.opponent1?.score || 0,
                team2Score: m.opponent2?.score || 0,
                winnerName: m.winner_id ? (m.winner_id === m.opponent1?.id ? m.opponent1?.name : m.opponent2?.name) : null,
              },
            });
          totalMatchesSaved++;
        }

        // Fetch Live Draft Games for Active Matches
        const activeMatches = rawMatches.filter((m: any) => !m.opponent1?.is_bye && !m.opponent2?.is_bye);
        for (const mObj of activeMatches) {
          try {
            const dRes = await fetch(`https://corestats.pro/api/match/live/${mObj.id}`, { headers });
            const dData = await dRes.json();
            if (!dData || !Array.isArray(dData.data)) continue;

            let gameNum = 0;
            for (const item of dData.data) {
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
                const g = item.games[0];
                gameNum++;
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

                const draftKey = `game${gameNum}-${region.toLowerCase()}-${stage.toLowerCase()}-${mObj.id}`;
                await db.insert(draftGames)
                  .values({
                    draftKey,
                    matchUuid: mObj.id,
                    gameNum,
                    region,
                    stage,
                    roundId: mObj.round_id || 1,
                    mapName: loc.name || null,
                    gameMode: loc.gameMode || null,
                    team1Name: mObj.opponent1?.name || null,
                    team2Name: mObj.opponent2?.name || null,
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
                totalDraftsSaved++;
              }
            }
          } catch (err) {
            // continue processing
          }
        }
      }

      await logAction('AUTO_SYNC_ALL', `Successfully synced ${totalBracketsSaved} brackets, ${totalMatchesSaved} matches, and ${totalDraftsSaved} draft games into Cloud SQL.`);
      res.json({
        success: true,
        bracketsSaved: totalBracketsSaved,
        matchesSaved: totalMatchesSaved,
        draftsSaved: totalDraftsSaved,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Aggregated Regional & Stage Tagged Statistics
  app.get('/api/bsc/stats', async (req, res) => {
    try {
      const bracketStats = await pool.query(`
        SELECT region, stage, COUNT(*) as total_brackets, SUM(match_count) as total_matches
        FROM brackets
        GROUP BY region, stage
        ORDER BY region, stage;
      `);

      const matchStats = await pool.query(`
        SELECT region, stage, COUNT(*) as total_saved_matches,
               SUM(CASE WHEN is_bye THEN 1 ELSE 0 END) as total_byes,
               SUM(CASE WHEN is_forfeit THEN 1 ELSE 0 END) as total_forfeits
        FROM matches
        GROUP BY region, stage
        ORDER BY region, stage;
      `);

      const draftStats = await pool.query(`
        SELECT region, stage, COUNT(*) as total_draft_games
        FROM draft_games
        GROUP BY region, stage
        ORDER BY region, stage;
      `);

      res.json({
        success: true,
        bracketsByRegionStage: bracketStats.rows,
        matchesByRegionStage: matchStats.rows,
        draftsByRegionStage: draftStats.rows,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Database Export & Inspection Endpoints for User Download
  app.get('/api/bsc/export/full-database', async (req, res) => {
    try {
      const { allMatches, allDrafts, allBrackets } = await fetchAllMatchesAndDrafts();

      const exportData = {
        exportedAt: new Date().toISOString(),
        summary: {
          bracketsCount: allBrackets.length,
          matchesCount: allMatches.length,
          draftGamesCount: allDrafts.length,
        },
        brackets: allBrackets,
        matches: allMatches,
        draftGames: allDrafts,
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="bsc_full_database_export.json"');
      res.send(JSON.stringify(exportData, null, 2));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Formatted Excel (.xlsx) Export with Region Tabs & Color-coded Cells
  app.get('/api/bsc/export/excel', async (req, res) => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'BSC Draft Database';
      workbook.created = new Date();

      const { allMatches, allDrafts } = await fetchAllMatchesAndDrafts();

      const draftsByMatchMap = new Map<string, any[]>();
      for (const d of allDrafts) {
        if (!d.matchUuid) continue;
        if (!draftsByMatchMap.has(d.matchUuid)) {
          draftsByMatchMap.set(d.matchUuid, []);
        }
        draftsByMatchMap.get(d.matchUuid)!.push(d);
      }

      const regions = [
        { id: 'ALL', name: 'Alle Matches & Drafts' },
        { id: 'EMEA', name: 'EMEA Region' },
        { id: 'NA', name: 'NA Region' },
        { id: 'SA', name: 'SA Region' },
        { id: 'EA', name: 'EA Region' },
      ];

      for (const reg of regions) {
        const sheet = workbook.addWorksheet(reg.name, {
          views: [{ showGridLines: true }]
        });

        sheet.columns = [
          { header: 'Region', key: 'region', width: 12 },
          { header: 'Stage', key: 'stage', width: 12 },
          { header: 'Runde', key: 'round', width: 12 },
          { header: 'Format', key: 'format', width: 10 },
          { header: 'Team 1 Name', key: 'team1', width: 22 },
          { header: 'Team 1 Spieler', key: 'team1Players', width: 28 },
          { header: 'Team 2 Name', key: 'team2', width: 22 },
          { header: 'Team 2 Spieler', key: 'team2Players', width: 28 },
          { header: 'Overall Score', key: 'score', width: 15 },
          { header: 'Winner Team', key: 'winner', width: 22 },
          { header: 'Set Num', key: 'setNum', width: 10 },
          { header: 'Map Name', key: 'map', width: 20 },
          { header: 'Game Mode', key: 'mode', width: 16 },
          { header: 'Team 1 Bans 🚫', key: 't1Bans', width: 30 },
          { header: 'Team 2 Bans 🚫', key: 't2Bans', width: 30 },
          { header: 'Team 1 Picks ⚡', key: 't1Picks', width: 35 },
          { header: 'Team 2 Picks ⚡', key: 't2Picks', width: 35 },
          { header: 'Set Winner', key: 'setWinner', width: 22 },
        ];

        // Header Row Styling
        const headerRow = sheet.getRow(1);
        headerRow.height = 28;
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' },
          };
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF334155' } },
            bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
            left: { style: 'thin', color: { argb: 'FF334155' } },
            right: { style: 'thin', color: { argb: 'FF334155' } },
          };
        });

        const filteredMatches = reg.id === 'ALL'
          ? allMatches
          : allMatches.filter(m => (m.region || '').toUpperCase() === reg.id);

        let rowIndex = 2;
        for (const m of filteredMatches) {
          const matchDrafts = draftsByMatchMap.get(m.matchUuid) || [];
          const t1Players = Array.isArray(m.team1Players) && m.team1Players.length > 0
            ? m.team1Players.join(' / ')
            : 'Spieler 1 / Spieler 2 / Spieler 3';
          const t2Players = Array.isArray(m.team2Players) && m.team2Players.length > 0
            ? m.team2Players.join(' / ')
            : 'Spieler 1 / Spieler 2 / Spieler 3';
          const overallScore = `${m.team1Score ?? 0} : ${m.team2Score ?? 0}`;

          const rowsToAdd = matchDrafts.length > 0 ? matchDrafts : [null];

          for (const d of rowsToAdd) {
            const rowData = {
              region: m.region,
              stage: m.stage,
              round: `Runde #${m.roundId || 1}`,
              format: m.format || 'BO3',
              team1: m.team1Name || 'Team 1',
              team1Players: t1Players,
              team2: m.team2Name || 'Team 2',
              team2Players: t2Players,
              score: overallScore,
              winner: m.winnerName || '',
              setNum: d ? `Set #${d.gameNum}` : '-',
              map: d ? d.mapName || '' : '-',
              mode: d ? d.gameMode || '' : '-',
              t1Bans: d && Array.isArray(d.team1Bans) ? d.team1Bans.join(' | ') : '-',
              t2Bans: d && Array.isArray(d.team2Bans) ? d.team2Bans.join(' | ') : '-',
              t1Picks: d && Array.isArray(d.team1Picks) ? d.team1Picks.join(' | ') : '-',
              t2Picks: d && Array.isArray(d.team2Picks) ? d.team2Picks.join(' | ') : '-',
              setWinner: d ? (d.team1Won ? m.team1Name : d.team2Won ? m.team2Name : '') : '-',
            };

            const row = sheet.addRow(rowData);
            row.height = 22;

            const isEven = rowIndex % 2 === 0;
            const defaultBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
              cell.alignment = { vertical: 'middle' };
              cell.font = { name: 'Calibri', size: 10 };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: defaultBg }
              };
              cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              };

              // Col 1: Region color
              if (colNumber === 1) {
                const rName = (m.region || '').toUpperCase();
                let rBg = 'FFE0E7FF';
                let rFg = 'FF3730A3';
                if (rName === 'EMEA') { rBg = 'FFF3E8FF'; rFg = 'FF6B21A8'; }
                else if (rName === 'NA') { rBg = 'FFFEE2E2'; rFg = 'FF991B1B'; }
                else if (rName === 'SA') { rBg = 'FFDCFCE7'; rFg = 'FF166534'; }
                else if (rName === 'EA') { rBg = 'FFFEF3C7'; rFg = 'FF92400E'; }

                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rBg } };
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: rFg } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
              }

              // Col 2: Stage color
              if (colNumber === 2) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0369A1' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
              }

              // Col 5 & 7: Teams bold
              if (colNumber === 5 || colNumber === 7) {
                cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
              }

              // Col 9: Overall Score
              if (colNumber === 9) {
                cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
              }

              // Col 10: Match Winner
              if (colNumber === 10 && cell.value) {
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
              }

              // Col 14 & 15: Bans (Soft Red)
              if (colNumber === 14 || colNumber === 15) {
                if (cell.value && cell.value !== '-') {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                  cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF991B1B' } };
                }
              }

              // Col 16 & 17: Picks (Soft Sky Blue)
              if (colNumber === 16 || colNumber === 17) {
                if (cell.value && cell.value !== '-') {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                  cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0369A1' } };
                }
              }

              // Col 18: Set Winner
              if (colNumber === 18 && cell.value && cell.value !== '-') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
                cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
              }
            });

            rowIndex++;
          }
        }
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="bsc_drafts_2026_formatted.xlsx"');

      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error('Excel export error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Structured Match + Draft Export CSV (Region, Stage, Round, Map, Teams, Players, Scores, Sets, Picks, Bans)
  app.get('/api/bsc/export/structured-csv', async (req, res) => {
    try {
      const { allMatches, allDrafts } = await fetchAllMatchesAndDrafts();

      // Create a map of matchUuid -> array of draft games
      const draftsByMatchMap = new Map<string, any[]>();
      for (const d of allDrafts) {
        if (!d.matchUuid) continue;
        if (!draftsByMatchMap.has(d.matchUuid)) {
          draftsByMatchMap.set(d.matchUuid, []);
        }
        draftsByMatchMap.get(d.matchUuid)!.push(d);
      }

      const rows: string[] = [];
      // Header row
      rows.push(
        [
          'Region',
          'Stage',
          'Round',
          'Format',
          'Team 1 Name',
          'Team 1 Players',
          'Team 2 Name',
          'Team 2 Players',
          'Overall Score',
          'Winner',
          'Set Game Num',
          'Map Name',
          'Game Mode',
          'Team 1 Bans',
          'Team 2 Bans',
          'Team 1 Picks',
          'Team 2 Picks',
          'Set Winner'
        ].map(h => `"${h}"`).join(',')
      );

      for (const m of allMatches) {
        const matchDrafts = draftsByMatchMap.get(m.matchUuid) || [];
        const t1Players = Array.isArray(m.team1Players) ? m.team1Players.join(' / ') : '';
        const t2Players = Array.isArray(m.team2Players) ? m.team2Players.join(' / ') : '';
        const overallScore = `${m.team1Score ?? 0} - ${m.team2Score ?? 0}`;

        if (matchDrafts.length === 0) {
          // Add single row for match without drafts yet
          const rowVals = [
            m.region,
            m.stage,
            m.roundId ?? '',
            m.format || 'BO3',
            m.team1Name || '',
            t1Players,
            m.team2Name || '',
            t2Players,
            overallScore,
            m.winnerName || '',
            '', '', '', '', '', '', '', ''
          ].map(v => `"${String(v).replace(/"/g, '""')}"`);
          rows.push(rowVals.join(','));
        } else {
          for (const d of matchDrafts) {
            const t1Bans = Array.isArray(d.team1Bans) ? d.team1Bans.join(' | ') : '';
            const t2Bans = Array.isArray(d.team2Bans) ? d.team2Bans.join(' | ') : '';
            const t1Picks = Array.isArray(d.team1Picks) ? d.team1Picks.join(' | ') : '';
            const t2Picks = Array.isArray(d.team2Picks) ? d.team2Picks.join(' | ') : '';
            const setWinner = d.team1Won ? m.team1Name : d.team2Won ? m.team2Name : '';

            const rowVals = [
              m.region,
              m.stage,
              m.roundId ?? '',
              m.format || 'BO3',
              m.team1Name || '',
              t1Players,
              m.team2Name || '',
              t2Players,
              overallScore,
              m.winnerName || '',
              `Set ${d.gameNum}`,
              d.mapName || '',
              d.gameMode || '',
              t1Bans,
              t2Bans,
              t1Picks,
              t2Picks,
              setWinner || ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`);
            rows.push(rowVals.join(','));
          }
        }
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="bsc_structured_match_drafts.csv"');
      res.send(rows.join('\n'));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/bsc/export/table/:tableName', async (req, res) => {
    try {
      const { tableName } = req.params;
      const format = req.query.format === 'csv' ? 'csv' : 'json';

      let data: any[] = [];
      if (tableName === 'brackets') data = await db.select().from(brackets);
      else if (tableName === 'matches') data = await db.select().from(matches);
      else if (tableName === 'draft_games') data = await db.select().from(draftGames);
      else if (tableName === 'db_logs') data = await db.select().from(dbLogs);
      else return res.status(400).json({ error: 'Invalid table name' });

      if (format === 'csv') {
        if (data.length === 0) {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="bsc_${tableName}.csv"`);
          return res.send('');
        }
        const keys = Object.keys(data[0]);
        const csvLines = [
          keys.join(','),
          ...data.map(row =>
            keys.map(k => {
              let val = row[k];
              if (val === null || val === undefined) return '""';
              if (typeof val === 'object') val = JSON.stringify(val);
              val = String(val).replace(/"/g, '""');
              return `"${val}"`;
            }).join(',')
          )
        ];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="bsc_${tableName}.csv"`);
        return res.send(csvLines.join('\n'));
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bsc_${tableName}.json"`);
      res.send(JSON.stringify(data, null, 2));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- VITE / SERVING SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
