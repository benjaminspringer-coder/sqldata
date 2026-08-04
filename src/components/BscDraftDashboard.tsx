import React, { useState, useEffect } from 'react';
import { Trophy, Globe, Calendar, Swords, ShieldAlert, Copy, Check, RefreshCw, Upload, Terminal, Layers, Download, FileSpreadsheet, Database } from 'lucide-react';

interface Bracket {
  id: number;
  uuid: string;
  month: string;
  region: string;
  stage: string;
  stageLabel: string;
  matchCount: number;
  status: string;
}

interface PlayerInfo {
  name: string;
  tag?: string;
}

interface PlayerPickInfo {
  player: string;
  brawler: string;
}

interface Match {
  id: number;
  matchUuid: string;
  bracketUuid: string;
  region: string;
  stage: string;
  roundId: number;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  team1Players?: PlayerInfo[];
  team2Players?: PlayerInfo[];
  winnerName: string;
  isBye: boolean;
  isForfeit: boolean;
}

interface DraftGame {
  id: number;
  matchUuid: string;
  gameNum: number;
  region: string;
  stage: string;
  mapName: string;
  gameMode: string;
  team1Name?: string;
  team2Name?: string;
  team1Bans: string[];
  team2Bans: string[];
  team1Picks: string[];
  team2Picks: string[];
  team1Players?: PlayerInfo[];
  team2Players?: PlayerInfo[];
  team1PlayerPicks?: PlayerPickInfo[];
  team2PlayerPicks?: PlayerPickInfo[];
  team1Won: boolean;
  team2Won: boolean;
}

export const BscDraftDashboard: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');

  const [bracketsList, setBracketsList] = useState<Bracket[]>([]);
  const [matchesList, setMatchesList] = useState<Match[]>([]);
  const [draftsList, setDraftsList] = useState<DraftGame[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingExcel, setDownloadingExcel] = useState<boolean>(false);

  const triggerFileDownload = async (endpointUrl: string, filename: string) => {
    try {
      if (filename.endsWith('.xlsx')) setDownloadingExcel(true);
      const res = await fetch(endpointUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        if (filename.endsWith('.xlsx')) setDownloadingExcel(false);
      }, 150);
    } catch (err: any) {
      setDownloadingExcel(false);
      alert('Download Error: ' + err.message);
    }
  };

  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importType, setImportType] = useState<'matches' | 'drafts'>('matches');
  const [importJsonText, setImportJsonText] = useState<string>('');

  const fetchBrackets = async () => {
    try {
      let url = '/api/bsc/brackets';
      const params = new URLSearchParams();
      if (selectedRegion !== 'ALL') params.append('region', selectedRegion);
      if (selectedStage !== 'ALL') params.append('stage', selectedStage);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setBracketsList(data.brackets);
      }
    } catch (e) {
      console.error('Failed to fetch brackets', e);
    }
  };

  const fetchMatches = async () => {
    try {
      let url = '/api/bsc/matches';
      const params = new URLSearchParams();
      if (selectedRegion !== 'ALL') params.append('region', selectedRegion);
      if (selectedStage !== 'ALL') params.append('stage', selectedStage);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMatchesList(data.matches);
      }
    } catch (e) {
      console.error('Failed to fetch matches', e);
    }
  };

  const fetchDrafts = async () => {
    try {
      let url = '/api/bsc/drafts';
      const params = new URLSearchParams();
      if (selectedRegion !== 'ALL') params.append('region', selectedRegion);
      if (selectedStage !== 'ALL') params.append('stage', selectedStage);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setDraftsList(data.drafts);
      }
    } catch (e) {
      console.error('Failed to fetch drafts', e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/bsc/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchBrackets(), fetchMatches(), fetchDrafts(), fetchStats()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [selectedRegion, selectedStage]);

  const handleBulkImport = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const endpoint = importType === 'matches' ? '/api/bsc/matches/bulk-save' : '/api/bsc/drafts/bulk-save';
      const bodyKey = importType === 'matches' ? 'matchList' : 'draftsList';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: parsed }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully imported ${data.saved} ${importType}!`);
        setShowImportModal(false);
        loadAll();
      } else {
        alert(`Import error: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Invalid JSON format: ${e.message}`);
    }
  };

  const appOrigin = window.location.origin;

  const browserConsoleSnippet = `// === CORESTATS FULL SEQUENTIAL DRAFT EXTRACTOR FOR POSTGRESQL ===
// Run directly in Browser Console on https://corestats.pro
(async function extractAndSyncAllDraftsToPostgreSQL() {
  const TARGET_APP = "${appOrigin}";
  
  console.log("🚀 Step 1: Fetching All Brackets from corestats.pro...");
  const res = await fetch('/api/brackets/list');
  const list = await res.json();
  const augustBrackets = list.brackets.filter(b =>
    b.month === 'August 2026' && (b.stageLabel === 'QDay1' || b.stageLabel === 'QDay2')
  );

  console.log(\`Found \${augustBrackets.length} August Brackets (EMEA, NA, SA, EA x QD1, QD2).\`);

  // Sequential Order: NA QD1 -> NA QD2 -> EMEA QD1 -> EMEA QD2 -> SA QD1 -> SA QD2 -> EA QD1 -> EA QD2
  for (const b of augustBrackets) {
    const region = b.region.toUpperCase();
    const stage = b.stageLabel === 'QDay1' ? 'QD1' : 'QD2';
    console.log(\`\n📌 Processing Region: \${region} | Stage: \${stage} (Bracket UUID: \${b.download_url})...\`);

    const bRes = await fetch('/api/brackets/data?url=' + b.download_url);
    const bData = await bRes.json();
    const matches = bData.data.match || [];
    console.log(\`   Found \${matches.length} matches in \${region} \${stage}.\`);

    // Extract & Save Matches
    const matchSaveList = matches.map(m => ({
      matchUuid: m.id,
      bracketUuid: b.download_url,
      region: region,
      stage: stage,
      roundId: m.round_id,
      matchNumber: m.number,
      team1Name: m.opponent1?.name || null,
      team2Name: m.opponent2?.name || null,
      team1Score: m.opponent1?.score || 0,
      team2Score: m.opponent2?.score || 0,
      isBye: m.opponent1?.is_bye || m.opponent2?.is_bye || false,
      isForfeit: m.opponent1?.forfeit || m.opponent2?.forfeit || false
    }));

    await fetch(TARGET_APP + '/api/bsc/matches/bulk-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchList: matchSaveList })
    });

    // Fetch live draft games for active non-bye matches in batches
    const activeMatchIds = matches.filter(m => !m.opponent1?.is_bye && !m.opponent2?.is_bye).map(m => ({ id: m.id, roundId: m.round_id, t1: m.opponent1?.name, t2: m.opponent2?.name }));
    console.log(\`   Fetching draft data for \${activeMatchIds.length} active matches...\`);

    const draftGamesList = [];
    for (let i = 0; i < activeMatchIds.length; i += 20) {
      const batch = activeMatchIds.slice(i, i + 20);
      await Promise.all(batch.map(async (mObj) => {
        try {
          const dRes = await fetch('/api/match/live/' + mObj.id);
          const dData = await dRes.json();
          if (!dData || !dData.data) return;

          let gameNum = 0;
          for (let di = 0; di < dData.data.length; di++) {
            const item = dData.data[di];
            let t1Bans = [], t2Bans = [];
            if (item.teams) {
              for (const t of item.teams) {
                const bans = (t.bans || []).map(x => x.name);
                if (t.side === 0) t1Bans = bans;
                else if (t.side === 1) t2Bans = bans;
              }
            }

            if (item.games && item.games.length > 0) {
              const g = item.games[0]; // duplicates ignored
              gameNum++;
              const loc = g.location || {};
              let t1Picks = [], t2Picks = [], t1Won = false, t2Won = false;

              if (g.teams) {
                for (let gi = 0; gi < g.teams.length; gi++) {
                  const gt = g.teams[gi];
                  const picks = (gt.players || []).map(p => p.brawler ? p.brawler.name : null).filter(Boolean);
                  if (gi === 0) { t1Picks = picks; t1Won = gt.isWinner || false; }
                  else { t2Picks = picks; t2Won = gt.isWinner || false; }
                }
              }

              // Tag format e.g. game1-na-qd1-<matchUuid>
              const draftKey = \`game\${gameNum}-\${region.toLowerCase()}-\${stage.toLowerCase()}-\${mObj.id}\`;

              draftGamesList.push({
                draftKey: draftKey,
                matchUuid: mObj.id,
                gameNum: gameNum,
                region: region,
                stage: stage,
                roundId: mObj.roundId,
                mapName: loc.name || null,
                gameMode: loc.gameMode || null,
                team1Name: mObj.t1,
                team2Name: mObj.t2,
                team1Bans: t1Bans,
                team2Bans: t2Bans,
                team1Picks: t1Picks,
                team2Picks: t2Picks,
                team1Won: t1Won,
                team2Won: t2Won
              });
            }
          }
        } catch (e) {}
      }));

      // Send draft batch to PostgreSQL
      if (draftGamesList.length > 0) {
        await fetch(TARGET_APP + '/api/bsc/drafts/bulk-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftsList: draftGamesList })
        });
        draftGamesList.length = 0; // Clear batch
      }
    }

    console.log(\`✅ Finished saving \${region} \${stage} into PostgreSQL!\`);
  }

  console.log("🎉 ALL REGIONS (NA, EMEA, SA, EA) QD1 & QD2 DRAFTS SAVED SUCCESSFULLY!");
})();`;

  const copySnippet = () => {
    navigator.clipboard.writeText(browserConsoleSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner & Downloads */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-yellow-400 animate-pulse" />
            <h2 className="text-xl font-extrabold text-gray-100 tracking-tight">BSC 2026 Drafts & Brackets Database</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-600/10 text-blue-400 border border-blue-500/20">
              August 2026
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 max-w-2xl">
            PostgreSQL collection tagged by Region (<span className="text-purple-400 font-bold">EMEA</span>, <span className="text-rose-400 font-bold">NA</span>, <span className="text-emerald-400 font-bold">SA</span>, <span className="text-amber-400 font-bold">EA</span>) and Qualifier Stage (<span className="text-sky-400 font-bold">QD1, QD2</span>).
          </p>
        </div>

        {/* Download & Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => triggerFileDownload('/api/bsc/export/excel', 'bsc_drafts_2026_formatted.xlsx')}
            disabled={downloadingExcel}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            <FileSpreadsheet className={`w-4 h-4 ${downloadingExcel ? 'animate-bounce' : ''}`} />
            <span>{downloadingExcel ? 'Generiere Excel...' : 'Excel Download (.xlsx)'}</span>
          </button>

          <button
            onClick={() => triggerFileDownload('/api/bsc/export/structured-csv', 'bsc_structured_match_drafts.csv')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-[#0D1117] hover:bg-[#1C2128] text-teal-400 border border-teal-500/40 rounded-lg text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
            <span>CSV Export</span>
          </button>

          <button
            onClick={() => triggerFileDownload('/api/bsc/export/full-database', 'bsc_full_database_export.json')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-[#0D1117] hover:bg-[#1C2128] text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Full DB (JSON)</span>
          </button>

          <button
            onClick={() => { setImportType('matches'); setShowImportModal(true); }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-[#0D1117] hover:bg-[#1C2128] text-gray-300 border border-[#30363D] rounded-lg text-xs font-medium transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-gray-400" />
            <span>Import JSON</span>
          </button>

          <button
            onClick={loadAll}
            className="flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-all shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Region Tabs + Stage Filters */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* 4 Region Tabs (EMEA, NA, SA, EA) */}
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Region:</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: 'ALL REGIONS', activeClass: 'bg-blue-600 text-white shadow' },
              { id: 'EMEA', label: 'EMEA 🇪🇺', activeClass: 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' },
              { id: 'NA', label: 'NA 🇺🇸', activeClass: 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' },
              { id: 'SA', label: 'SA 🇧🇷', activeClass: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' },
              { id: 'EA', label: 'EA 🇯🇵', activeClass: 'bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/30' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRegion(r.id)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
                  selectedRegion === r.id
                    ? r.activeClass
                    : 'bg-[#0D1117] text-gray-400 hover:bg-[#1C2128] hover:text-gray-200 border border-[#30363D]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Qualifier Stage Tabs (QD1, QD2) */}
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Stage:</span>
          <div className="flex gap-1.5">
            {[
              { id: 'ALL', label: 'ALL STAGES' },
              { id: 'QD1', label: 'QD1 (Day 1)' },
              { id: 'QD2', label: 'QD2 (Day 2)' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStage(s.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-colors ${
                  selectedStage === s.id
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'bg-[#0D1117] text-gray-400 hover:bg-[#1C2128] hover:text-gray-200 border border-[#30363D]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Brackets Cards Summary */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-200 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>Active Qualifier Brackets ({bracketsList.length})</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {bracketsList.map((b) => {
            const regionColor = b.region === 'EMEA' ? 'text-purple-400 border-purple-500/30 bg-purple-500/10'
              : b.region === 'NA' ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
              : b.region === 'SA' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
              : 'text-amber-400 border-amber-500/30 bg-amber-500/10';

            return (
              <div
                key={b.uuid}
                className="bg-[#161B22] border border-[#30363D] rounded-lg p-3.5 space-y-2 hover:border-blue-500/50 transition-all shadow"
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${regionColor}`}>
                    {b.region}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    {b.stage}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-gray-100 text-xs">{b.region} — {b.stageLabel || b.stage}</h4>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{b.month}</p>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 pt-1 border-t border-[#30363D]">
                  <span>Matches: <strong className="text-gray-200">{b.matchCount}</strong></span>
                  <span className="text-emerald-400 font-semibold">{b.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Hierarchical Matches & Drafts View */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Swords className="w-5 h-5 text-yellow-400" />
            <h3 className="text-base font-bold text-gray-100">
              Matches & Sub-category Draft Sets ({matchesList.length} Matches)
            </h3>
          </div>
          <span className="text-xs text-gray-400 font-mono bg-[#0D1117] px-2.5 py-1 rounded border border-[#30363D]">
            Region: {selectedRegion} | Stage: {selectedStage}
          </span>
        </div>

        {matchesList.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500 border border-dashed border-[#30363D] rounded-lg space-y-2">
            <p className="text-sm font-semibold text-gray-400">No stored matches found for this filter.</p>
            <p className="text-xs text-gray-500">Run the console extractor script below or import JSON data to display matches & draft games.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[750px] overflow-y-auto pr-1">
            {matchesList.map((m) => {
              // Get drafts for this match
              const matchDrafts = draftsList.filter(d => d.matchUuid === m.matchUuid);

              // Region color pill
              const regionBadgeColor = m.region === 'EMEA' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                : m.region === 'NA' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : m.region === 'SA' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

              const t1IsWinner = m.winnerName && m.team1Name && m.winnerName === m.team1Name;
              const t2IsWinner = m.winnerName && m.team2Name && m.winnerName === m.team2Name;

              return (
                <div key={m.matchUuid} className="bg-[#0D1117] border border-[#30363D] rounded-xl p-4 space-y-3 hover:border-gray-500/50 transition-all shadow-md">
                  
                  {/* Top Header Bar: Stage • Runde • Format */}
                  <div className="flex flex-wrap items-center justify-between text-xs font-mono pb-2 border-b border-[#21262D]">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${regionBadgeColor}`}>
                        {m.region}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        {m.stage}
                      </span>
                      <span className="text-gray-300 font-bold bg-[#161B22] px-2 py-0.5 rounded border border-[#30363D]">
                        Runde #{m.roundId || 1}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-gray-400 text-[11px]">
                      <span>{matchDrafts.length > 0 ? `${matchDrafts.length} Draft Sets` : 'Match Overview'}</span>
                      <span className="text-gray-600">•</span>
                      <span className="text-blue-400 font-bold">BO3 / BO5</span>
                    </div>
                  </div>

                  {/* Main Match Display: Team 1 vs Team 2 + Overall Score */}
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center py-2 bg-[#161B22]/60 p-3 rounded-lg border border-[#21262D]">
                    
                    {/* Team 1 & Players */}
                    <div className="md:col-span-3 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-extrabold ${t1IsWinner ? 'text-emerald-400' : 'text-gray-100'}`}>
                          {m.team1Name || 'Team 1'}
                        </span>
                        {t1IsWinner && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            WINNER
                          </span>
                        )}
                      </div>
                      
                      {/* 3x Players list */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {m.team1Players && m.team1Players.length > 0 ? (
                          m.team1Players.map((p, pi) => (
                            <span key={pi} className="px-1.5 py-0.5 rounded bg-[#0D1117] text-purple-300 border border-purple-500/30 text-[10px] font-mono font-medium">
                              👤 {p.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-gray-500 font-mono italic">No Roster Data</span>
                        )}
                      </div>
                    </div>

                    {/* Overall Score Badge */}
                    <div className="md:col-span-1 text-center py-1">
                      <div className="inline-flex items-center justify-center bg-[#0D1117] px-4 py-1.5 rounded-lg border border-[#30363D] font-mono">
                        <span className={`text-xl font-black ${m.team1Score > m.team2Score ? 'text-emerald-400' : 'text-gray-200'}`}>
                          {m.team1Score ?? 0}
                        </span>
                        <span className="text-gray-500 mx-2 text-lg font-bold">:</span>
                        <span className={`text-xl font-black ${m.team2Score > m.team1Score ? 'text-emerald-400' : 'text-gray-200'}`}>
                          {m.team2Score ?? 0}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono mt-1">Overall Score</p>
                    </div>

                    {/* Team 2 & Players */}
                    <div className="md:col-span-3 md:text-right space-y-1">
                      <div className="flex items-center md:justify-end space-x-2">
                        {t2IsWinner && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            WINNER
                          </span>
                        )}
                        <span className={`text-sm font-extrabold ${t2IsWinner ? 'text-emerald-400' : 'text-gray-100'}`}>
                          {m.team2Name || 'Team 2'}
                        </span>
                      </div>
                      
                      {/* 3x Players list */}
                      <div className="flex flex-wrap md:justify-end gap-1 pt-0.5">
                        {m.team2Players && m.team2Players.length > 0 ? (
                          m.team2Players.map((p, pi) => (
                            <span key={pi} className="px-1.5 py-0.5 rounded bg-[#0D1117] text-blue-300 border border-blue-500/30 text-[10px] font-mono font-medium">
                              👤 {p.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-gray-500 font-mono italic">No Roster Data</span>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Sub-category: Draft Sets Details (Picks, Bans, Maps) */}
                  {matchDrafts.length > 0 && (
                    <div className="mt-3 pt-2 space-y-3 border-t border-[#21262D]">
                      <div className="flex items-center space-x-2 text-xs font-bold text-gray-300">
                        <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                        <span>Sub-category: Set Details & Drafts ({matchDrafts.length} Sets)</span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {matchDrafts.map((d) => (
                          <div key={d.id} className="bg-[#161B22] border border-[#21262D] rounded-lg p-3 space-y-2">
                            
                            {/* Set Header: Set # • Map • Game Mode */}
                            <div className="flex flex-wrap items-center justify-between text-xs">
                              <div className="flex items-center space-x-2">
                                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">
                                  Set #{d.gameNum}
                                </span>
                                <span className="font-bold text-gray-200">{d.mapName || 'Map'}</span>
                                {d.gameMode && (
                                  <span className="text-[11px] text-sky-400 font-mono font-semibold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                                    {d.gameMode}
                                  </span>
                                )}
                              </div>

                              <span className="text-[10px] font-mono text-gray-400">
                                Winner: <strong className={d.team1Won ? 'text-emerald-400' : d.team2Won ? 'text-emerald-400' : 'text-gray-300'}>
                                  {d.team1Won ? d.team1Name || 'Team 1' : d.team2Won ? d.team2Name || 'Team 2' : 'Pending'}
                                </strong>
                              </span>
                            </div>

                            {/* Picks & Bans Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
                              
                              {/* Team 1 Drafts */}
                              <div className="bg-[#0D1117] p-2 rounded border border-[#30363D] space-y-1.5">
                                <span className="text-[10px] font-bold text-gray-300 block">
                                  {d.team1Name || 'Team 1'} Bans & Picks:
                                </span>
                                
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10px] text-rose-400 font-bold mr-1">BANS:</span>
                                  {d.team1Bans?.map((b, bi) => (
                                    <span key={bi} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 font-mono text-[10px]">
                                      🚫 {b}
                                    </span>
                                  ))}
                                </div>

                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10px] text-sky-400 font-bold mr-1">PICKS:</span>
                                  {d.team1Picks?.map((p, pi) => {
                                    const playerName = d.team1PlayerPicks?.[pi]?.player || d.team1Players?.[pi]?.name || m.team1Players?.[pi]?.name;
                                    return (
                                      <span key={pi} className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono text-[10px] font-semibold flex items-center space-x-1">
                                        <span>⚡ {playerName ? <strong className="text-purple-300 font-semibold">{playerName}: </strong> : ''}</span>
                                        <span className="text-amber-300 font-bold">{p}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Team 2 Drafts */}
                              <div className="bg-[#0D1117] p-2 rounded border border-[#30363D] space-y-1.5">
                                <span className="text-[10px] font-bold text-gray-300 block">
                                  {d.team2Name || 'Team 2'} Bans & Picks:
                                </span>
                                
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10px] text-rose-400 font-bold mr-1">BANS:</span>
                                  {d.team2Bans?.map((b, bi) => (
                                    <span key={bi} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 font-mono text-[10px]">
                                      🚫 {b}
                                    </span>
                                  ))}
                                </div>

                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10px] text-sky-400 font-bold mr-1">PICKS:</span>
                                  {d.team2Picks?.map((p, pi) => {
                                    const playerName = d.team2PlayerPicks?.[pi]?.player || d.team2Players?.[pi]?.name || m.team2Players?.[pi]?.name;
                                    return (
                                      <span key={pi} className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono text-[10px] font-semibold flex items-center space-x-1">
                                        <span>⚡ {playerName ? <strong className="text-blue-300 font-semibold">{playerName}: </strong> : ''}</span>
                                        <span className="text-amber-300 font-bold">{p}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>

                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Corestats Browser Console Script Helper */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-gray-100">Browser Console Extractor & Cloud SQL Sync Tool</h3>
          </div>
          <button
            onClick={copySnippet}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-all shadow"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSnippet ? 'Copied to Clipboard!' : 'Copy Script for Browser Console'}</span>
          </button>
        </div>
        <p className="text-xs text-gray-400">
          To bypass Cloudflare protection on corestats.pro, copy this JavaScript snippet and paste it directly into your Developer Console (F12) while viewing <span className="text-blue-400 font-mono">corestats.pro</span>. It will fetch all August 2026 matches/drafts and send them directly to your Cloud SQL PostgreSQL instance!
        </p>
        <div className="bg-[#0D1117] p-3 rounded border border-[#30363D] overflow-x-auto">
          <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre">
            {browserConsoleSnippet}
          </pre>
        </div>
      </div>

      {/* Manual Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-100">Manual Bulk JSON Import</h3>
            
            <div className="flex items-center space-x-4 text-xs font-bold text-gray-300">
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="radio"
                  checked={importType === 'matches'}
                  onChange={() => setImportType('matches')}
                />
                <span>Matches JSON</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="radio"
                  checked={importType === 'drafts'}
                  onChange={() => setImportType('drafts')}
                />
                <span>Draft Games JSON</span>
              </label>
            </div>

            <div>
              <textarea
                rows={8}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder={importType === 'matches' 
                  ? '[\n  {\n    "matchUuid": "match-123",\n    "region": "EMEA",\n    "stage": "QD1",\n    "team1Name": "Voltaic",\n    "team2Name": "ZOT",\n    "team1Score": 1,\n    "team2Score": 2\n  }\n]'
                  : '[\n  {\n    "matchUuid": "match-123",\n    "gameNum": 1,\n    "region": "EMEA",\n    "stage": "QD1",\n    "mapName": "Safe Zone",\n    "gameMode": "HEIST",\n    "team1Bans": ["CHUCK", "BROCK"],\n    "team2Bans": ["COLT", "GUS"],\n    "team1Picks": ["MICO", "PIERCE"],\n    "team2Picks": ["CROW", "SURGE"]\n  }\n]'}
                className="w-full bg-[#0D1117] font-mono border border-[#30363D] rounded p-2.5 text-xs text-emerald-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-[#0D1117] text-gray-300 border border-[#30363D] rounded text-xs font-medium hover:bg-[#1C2128]"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                className="px-4 py-2 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-500"
              >
                Import into PostgreSQL
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
