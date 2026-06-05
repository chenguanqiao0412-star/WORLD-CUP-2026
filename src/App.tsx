/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import {
  Trophy,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  Plus,
  Minus,
  X,
  FileText,
  Compass,
  LayoutGrid,
  TrendingDown,
  Activity,
  AlertCircle,
  Copy,
  SlidersHorizontal,
  ChevronLeft
} from "lucide-react";
import { Team, GroupStanding, Match, INITIAL_TEAMS } from "./types";
import { PredictionPoster } from "./components/PredictionPoster";
import {
  generateAllGroupMatches,
  calculateGroupStanding,
  calculateThirdPlaceStandings,
  buildKnockoutStage,
  getKnockoutMatchWinner,
  getKnockoutMatchLoser,
  propagateKnockoutBrackets
} from "./utils/calc";

// Local Storage Keys
const LOCAL_STORAGE_KEY_MATCHES = "wc2026_group_matches";
const LOCAL_STORAGE_KEY_KNOCKOUT = "wc2026_knockout_bracket";

export default function App() {
  // --- States ---
  const [activeTab, setActiveTab] = useState<"group" | "thirds" | "knockout" | "insight">("group");
  const [selectedGroup, setSelectedGroup] = useState<string>("A");
  
  // Loaded state
  const [groupMatches, setGroupMatches] = useState<Match[]>([]);
  const [knockoutBracket, setKnockoutBracket] = useState<any>(null);

  // AI states
  const [analyzingMatch, setAnalyzingMatch] = useState<Match | null>(null);
  const [matchAnalysisText, setMatchAnalysisText] = useState<string>("");
  const [analyzingLoading, setAnalyzingLoading] = useState<boolean>(false);
  const [aiMatchCache, setAiMatchCache] = useState<{ [matchId: string]: string }>({});

  // Full Bracket report
  const [fullReport, setFullReport] = useState<string>("");
  const [reportLoading, setReportLoading] = useState<boolean>(false);

  // Poster Modal Open State
  const [isPosterOpen, setIsPosterOpen] = useState<boolean>(false);

  // Initialize and load from local storage with thorough validation
  useEffect(() => {
    const cachedMatches = localStorage.getItem(LOCAL_STORAGE_KEY_MATCHES);
    const cachedKnockout = localStorage.getItem(LOCAL_STORAGE_KEY_KNOCKOUT);

    let initialMatches: Match[] = [];
    let isCacheValid = false;

    if (cachedMatches) {
      try {
        const parsed = JSON.parse(cachedMatches);
        if (Array.isArray(parsed) && parsed.length === 72) {
          // Verify that all teams in the cached matches exist in INITIAL_TEAMS and are mapped to the correct group
          const isValid = parsed.every((m: Match) => {
            const h = INITIAL_TEAMS.find((t) => t.id === m.homeTeam);
            const a = INITIAL_TEAMS.find((t) => t.id === m.awayTeam);
            return h && a && h.group === m.group && a.group === m.group;
          });
          if (isValid) {
            initialMatches = parsed;
            isCacheValid = true;
          }
        }
      } catch (e) {
        isCacheValid = false;
      }
    }

    if (!isCacheValid) {
      initialMatches = generateAllGroupMatches(INITIAL_TEAMS);
      localStorage.setItem(LOCAL_STORAGE_KEY_MATCHES, JSON.stringify(initialMatches));
    }

    setGroupMatches(initialMatches);

    let initialKnockout: any = null;
    if (isCacheValid && cachedKnockout) {
      try {
        initialKnockout = JSON.parse(cachedKnockout);
      } catch (e) {
        initialKnockout = null;
      }
    }

    if (!initialKnockout) {
      const freshKnockout = buildKnockoutStage(INITIAL_TEAMS, initialMatches);
      initialKnockout = propagateKnockoutBrackets(freshKnockout);
      localStorage.setItem(LOCAL_STORAGE_KEY_KNOCKOUT, JSON.stringify(initialKnockout));
    }

    setKnockoutBracket(initialKnockout);
  }, []);

  // Sync to local storage
  const saveState = (updatedMatches: Match[], updatedKnockout: any) => {
    localStorage.setItem(LOCAL_STORAGE_KEY_MATCHES, JSON.stringify(updatedMatches));
    localStorage.setItem(LOCAL_STORAGE_KEY_KNOCKOUT, JSON.stringify(updatedKnockout));
  };

  // Get active teams
  const getTeamById = (id: string): Team => {
    const found = INITIAL_TEAMS.find((t) => t.id === id);
    if (found) return found;

    let flag = "🏳️";
    let name = id;

    if (id === "待定") {
      flag = "⏱️";
      name = "待决队伍";
    } else if (id.endsWith("_待定")) {
      const base = id.replace("_待定", "");
      flag = "⏱️";
      if (base.length === 2) {
        const grp = base[0];
        const rk = base[1];
        name = `${grp}组第${rk === "1" ? "一" : "二"}`;
      } else if (base.startsWith("T3_")) {
        const num = base.replace("T3_", "");
        name = `小组第三 #${num}`;
      }
    }

    return { id, name, flag, rank: 99, group: "" };
  };

  // --- Handlers & Simulators ---

  // Handle Group Stage goal input changes
  const handleGroupScoreChange = (
    matchId: string,
    teamType: "home" | "away",
    val: number | null
  ) => {
    const updated = groupMatches.map((m) => {
      if (m.id === matchId) {
        const updatedMatch = {
          ...m,
          homeScore: teamType === "home" ? val : m.homeScore,
          awayScore: teamType === "away" ? val : m.awayScore,
          isPredicted: true,
        };
        return updatedMatch;
      }
      return m;
    });

    setGroupMatches(updated);

    // Rebuild knockout seeds based on new standings
    if (knockoutBracket) {
      const freshKnockout = buildKnockoutStage(INITIAL_TEAMS, updated);
      
      // Preserve existing knockout inputs if team matches
      const mergedKnockout = mergePreservingKnockout(knockoutBracket, freshKnockout);
      const fullyPropagated = propagateKnockoutBrackets(mergedKnockout);
      
      setKnockoutBracket(fullyPropagated);
      saveState(updated, fullyPropagated);
    }
  };

  // Preserve previous scores if teams are identical in knockout rounds
  const mergePreservingKnockout = (oldBracket: any, freshBracket: any) => {
    const phases: Array<"R32" | "R16" | "QF" | "SF" | "3RD" | "FINAL"> = [
      "R32",
      "R16",
      "QF",
      "SF",
      "3RD",
      "FINAL",
    ];

    phases.forEach((p) => {
      freshBracket[p] = freshBracket[p].map((newMatch: Match, index: number) => {
        const oldMatch = oldBracket[p]?.[index];
        if (
          oldMatch &&
          oldMatch.homeTeam === newMatch.homeTeam &&
          oldMatch.awayTeam === newMatch.awayTeam
        ) {
          return {
            ...newMatch,
            homeScore: oldMatch.homeScore,
            awayScore: oldMatch.awayScore,
            homePenScore: oldMatch.homePenScore,
            awayPenScore: oldMatch.awayPenScore,
            isPredicted: oldMatch.isPredicted,
          };
        }
        return newMatch;
      });
    });

    return freshBracket;
  };

  // Adjust scores with buttons
  const adjustScore = (
    matchId: string,
    teamType: "home" | "away",
    currentVal: number | null,
    delta: number,
    isKnockout: boolean = false,
    phase?: string,
    idx?: number
  ) => {
    const baseVal = currentVal === null ? 0 : currentVal;
    const newVal = Math.max(0, baseVal + delta);
    
    if (!isKnockout) {
      handleGroupScoreChange(matchId, teamType, newVal);
    } else if (phase && idx !== undefined) {
      handleKnockoutScoreChange(phase, idx, teamType, newVal);
    }
  };

  // Handle Knockout phase inputs
  const handleKnockoutScoreChange = (
    phase: string,
    idx: number,
    teamType: "home" | "away" | "homePen" | "awayPen",
    val: number | null
  ) => {
    if (!knockoutBracket) return;

    const targetPhaseList = [...knockoutBracket[phase]];
    const targetMatch = { ...targetPhaseList[idx] };

    if (teamType === "home") targetMatch.homeScore = val;
    if (teamType === "away") targetMatch.awayScore = val;
    if (teamType === "homePen") targetMatch.homePenScore = val;
    if (teamType === "awayPen") targetMatch.awayPenScore = val;
    
    targetMatch.isPredicted = true;

    // Reset penalties if scores are not equal anymore
    if (targetMatch.homeScore !== null && targetMatch.awayScore !== null && targetMatch.homeScore !== targetMatch.awayScore) {
      targetMatch.homePenScore = null;
      targetMatch.awayPenScore = null;
    }

    targetPhaseList[idx] = targetMatch;

    const updatedBracket = {
      ...knockoutBracket,
      [phase]: targetPhaseList,
    };

    const fullyPropagated = propagateKnockoutBrackets(updatedBracket);
    setKnockoutBracket(fullyPropagated);
    saveState(groupMatches, fullyPropagated);
  };

  // Quick Auto-fill: Favors higher FIFA ranking (realistic preset)
  const simulateByRanking = () => {
    // Fill all group stages
    const updatedGroup = groupMatches.map((m) => {
      const homeInfo = getTeamById(m.homeTeam);
      const awayInfo = getTeamById(m.awayTeam);
      
      // rank is better if smaller (e.g., 1st vs 20th)
      const isHomeBetter = homeInfo.rank < awayInfo.rank;
      const rankDiff = Math.abs(homeInfo.rank - awayInfo.rank);

      let homeScore = 1;
      let awayScore = 1;

      if (rankDiff <= 5) {
        // Close ranking - high chance of draw or 1-goal gap
        homeScore = Math.floor(Math.random() * 2) + 1;
        awayScore = isHomeBetter ? homeScore : homeScore + 1;
        if (Math.random() < 0.3) awayScore = homeScore; // Draw
      } else if (rankDiff <= 15) {
        homeScore = isHomeBetter ? 2 : 1;
        awayScore = isHomeBetter ? 1 : 2;
      } else {
        homeScore = isHomeBetter ? 3 : 0;
        awayScore = isHomeBetter ? 0 : 3;
      }

      return {
        ...m,
        homeScore,
        awayScore,
        isPredicted: true,
      };
    });

    setGroupMatches(updatedGroup);

    // Build knockout matches
    let freshKnockout = buildKnockoutStage(INITIAL_TEAMS, updatedGroup);
    
    // Simulate knockout phase-by-phase using ranking to resolve winner
    const phases: Array<"R32" | "R16" | "QF" | "SF" | "3RD" | "FINAL"> = [
      "R32",
      "R16",
      "QF",
      "SF",
      "3RD",
      "FINAL",
    ];

    for (let pIdx = 0; pIdx < phases.length; pIdx++) {
      const phase = phases[pIdx];
      freshKnockout = propagateKnockoutBrackets(freshKnockout);

      freshKnockout[phase] = freshKnockout[phase].map((m: Match) => {
        if (m.homeTeam === "待定" || m.awayTeam === "待定" || m.homeTeam.includes("待定") || m.awayTeam.includes("待定")) {
          return m;
        }

        const h = getTeamById(m.homeTeam);
        const a = getTeamById(m.awayTeam);
        const isHBetter = h.rank < a.rank;

        let homeScore = isHBetter ? 2 : 1;
        let awayScore = isHBetter ? 1 : 2;

        return {
          ...m,
          homeScore,
          awayScore,
          isPredicted: true,
        };
      });
    }

    freshKnockout = propagateKnockoutBrackets(freshKnockout);
    setKnockoutBracket(freshKnockout);
    saveState(updatedGroup, freshKnockout);
  };

  // Quick Auto-fill: Random prediction with upsets (fun preset)
  const simulateByRandom = () => {
    const updatedGroup = groupMatches.map((m) => {
      const homeScore = Math.floor(Math.random() * 4);
      const awayScore = Math.floor(Math.random() * 4);
      return {
        ...m,
        homeScore,
        awayScore,
        isPredicted: true,
      };
    });

    setGroupMatches(updatedGroup);

    let freshKnockout = buildKnockoutStage(INITIAL_TEAMS, updatedGroup);
    const phases: Array<"R32" | "R16" | "QF" | "SF" | "3RD" | "FINAL"> = [
      "R32",
      "R16",
      "QF",
      "SF",
      "3RD",
      "FINAL",
    ];

    for (let pIdx = 0; pIdx < phases.length; pIdx++) {
      const phase = phases[pIdx];
      freshKnockout = propagateKnockoutBrackets(freshKnockout);

      freshKnockout[phase] = freshKnockout[phase].map((m: Match) => {
        if (m.homeTeam === "待定" || m.awayTeam === "待定") return m;

        let homeScore = Math.floor(Math.random() * 4);
        let awayScore = Math.floor(Math.random() * 4);
        let homePenScore = null;
        let awayPenScore = null;

        if (homeScore === awayScore) {
          // penalty shootout
          homePenScore = Math.floor(Math.random() * 3) + 4;
          awayPenScore = homePenScore === 5 ? 4 : 5; // force distinct
        }

        return {
          ...m,
          homeScore,
          awayScore,
          homePenScore,
          awayPenScore,
          isPredicted: true,
        };
      });
    }

    freshKnockout = propagateKnockoutBrackets(freshKnockout);
    setKnockoutBracket(freshKnockout);
    saveState(updatedGroup, freshKnockout);
  };

  // Clear all predictions
  const resetAllPredictions = () => {
    const clearedGroup = generateAllGroupMatches(INITIAL_TEAMS);
    const freshKnockout = buildKnockoutStage(INITIAL_TEAMS, clearedGroup);
    
    setGroupMatches(clearedGroup);
    setKnockoutBracket(propagateKnockoutBrackets(freshKnockout));
    setFullReport("");
    saveState(clearedGroup, propagateKnockoutBrackets(freshKnockout));
  };

  // --- AI Integrations via Express Backend ---

  // Analyze single match H2H & tactics
  const openMatchAnalysis = async (m: Match) => {
    setAnalyzingMatch(m);
    setMatchAnalysisText("");
    setAnalyzingLoading(true);

    if (aiMatchCache[m.id]) {
      setMatchAnalysisText(aiMatchCache[m.id]);
      setAnalyzingLoading(false);
      return;
    }

    const homeTeam = getTeamById(m.homeTeam);
    const awayTeam = getTeamById(m.awayTeam);

    try {
      const response = await fetch("/api/analyze-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeam: `${homeTeam.flag} ${homeTeam.name}`,
          awayTeam: `${awayTeam.flag} ${awayTeam.name}`,
          homeRank: homeTeam.rank,
          awayRank: awayTeam.rank,
          context: `2026 美加墨世界杯预测：双方在小组赛 / 淘汰赛节点展开正面对抗，这是一场极具戏剧性的高能模拟。`,
        }),
      });

      const data = await response.json();
      if (data.analysis) {
        setMatchAnalysisText(data.analysis);
        setAiMatchCache((prev) => ({ ...prev, [m.id]: data.analysis }));
      } else {
        setMatchAnalysisText("⚠️ 无法获取 AI 深度战术评价。请检查您的 API 配置。");
      }
    } catch (e: any) {
      setMatchAnalysisText(`⚠️ 分析请求遇到故障: ${e.message}`);
    } finally {
      setAnalyzingLoading(false);
    }
  };

  // Generate All-World Cup Tournament Report
  const generateFullTournamentReport = async () => {
    if (!knockoutBracket) return;
    setReportLoading(true);
    setFullReport("");

    // Gather final stats
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    const groupsOutputs: any = {};
    letters.forEach((l) => {
      groupsOutputs[l] = calculateGroupStanding(l, INITIAL_TEAMS, groupMatches).map((t) => ({
        name: t.name,
        pts: t.pts,
        gd: t.gd,
      }));
    });

    const finalMatch = knockoutBracket.FINAL?.[0];
    const championId = getKnockoutMatchWinner(finalMatch);
    const championNode = championId !== "待定" ? getTeamById(championId) : null;

    const bracketsData = {
      groupStageOutcomes: groupsOutputs,
      runnerUps: letters.map((l) => {
        const list = calculateGroupStanding(l, INITIAL_TEAMS, groupMatches);
        return { group: l, first: list[0]?.name, second: list[1]?.name };
      }),
      finalStandings: {
        winner: championNode ? `${championNode.flag} ${championNode.name}` : "未决出冠军",
        finals: finalMatch ? `${getTeamById(finalMatch.homeTeam).name} vs ${getTeamById(finalMatch.awayTeam).name}` : "未决出对手"
      },
      champion: championNode ? `${championNode.flag} ${championNode.name}` : "未知黑马",
    };

    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brackets: bracketsData }),
      });
      const data = await response.json();
      if (data.report) {
        setFullReport(data.report);
        setActiveTab("insight");
      } else {
        setFullReport("⚠️ 生成全景预测报告失败，请稍后重试。");
      }
    } catch (e: any) {
      setFullReport(`⚠️ 起草报告过程发生中断: ${e.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  // Copy report helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("📋 预测白皮书已复制到您的剪切板，快去朋友圈或社群分享吧！");
  };

  // Calculate stats
  const activeGroupStandings = calculateGroupStanding(selectedGroup, INITIAL_TEAMS, groupMatches);
  const thirdPlaceWildcards = calculateThirdPlaceStandings(INITIAL_TEAMS, groupMatches);
  const top8ThirdIds = thirdPlaceWildcards.slice(0, 8).map((t) => t.id);

  const finalMatchResolved = knockoutBracket?.FINAL?.[0];
  const worldCupChampionId = finalMatchResolved ? getKnockoutMatchWinner(finalMatchResolved) : "待定";
  const worldCupChampion = worldCupChampionId !== "待定" ? getTeamById(worldCupChampionId) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-200">
      {/* Top Banner Accent */}
      <div className="h-2 bg-gradient-to-r from-emerald-600 via-yellow-500 to-indigo-600 w-full" id="top-stripe" />

      {/* Hero Header */}
      <header className="bg-white border-b border-slate-200 transition-all duration-200" id="app-header">
        <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 flex items-center justify-center animate-pulse" id="trophy-badge">
                  <Trophy className="w-8 h-8" />
                </span>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">2026 北美狂欢</span>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900" id="main-title">
                    2026 美加墨世界杯全景沙盘预测器
                  </h1>
                </div>
              </div>
              <p className="mt-2 text-sm md:text-base text-slate-500 max-w-3xl leading-relaxed" id="main-subtitle">
                这里不仅是简单的积分推演，更是包含 <strong className="text-slate-800">48简轨、32强、3rd机制</strong> 的国际正规赛制终极预测场：自动精准演算各组出线走向、支持一键大师级实力/奇迹模拟，并借助 <strong className="text-emerald-700">Gemini AI</strong> 实时评说单场战局与谱写冠军情怀白皮书！
              </p>
            </div>

            {/* Fast Control Box */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/70" id="quick-simulation-panel">
              <div className="text-xs text-emerald-950 font-bold w-full mb-1">⚡ 极速全景生成器</div>
              
              <button
                id="btn-rank-sim"
                onClick={simulateByRanking}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm hover:shadow active:scale-95 cursor-pointer"
                title="根据 FIFA 战力排行快速填满所有阶段"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                权威实力模拟
              </button>
              
              <button
                id="btn-random-sim"
                onClick={simulateByRandom}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm hover:shadow active:scale-95 cursor-pointer"
                title="开启无序大乱斗，创造奇迹杯赛"
              >
                <Sparkles className="w-3.5 h-3.5" />
                绿茵奇迹大乱斗
              </button>
              
              <button
                id="btn-reset-sim"
                onClick={resetAllPredictions}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg flex items-center gap-1 transition active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                重置沙盘
              </button>

              <button
                id="btn-show-poster"
                onClick={() => setIsPosterOpen(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm hover:shadow active:scale-95 cursor-pointer"
                title="生成并下载属于您的世界杯预测精美大合影高清海报"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-300" />
                生成预测海报
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px mb-8" id="nav-tabs">
          <button
            id="tab-group"
            onClick={() => setActiveTab("group")}
            className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "group"
                ? "border-emerald-600 text-emerald-700 font-bold bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            1. 小组赛阶段推演
          </button>
          
          <button
            id="tab-thirds"
            onClick={() => setActiveTab("thirds")}
            className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "thirds"
                ? "border-emerald-600 text-emerald-700 font-bold bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Activity className="w-4 h-4" />
            2. 小组第三积分排名
            {top8ThirdIds.length > 0 && (
              <span className="text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 ml-1 font-bold">
                8强晋级
              </span>
            )}
          </button>
          
          <button
            id="tab-knockout"
            onClick={() => setActiveTab("knockout")}
            className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "knockout"
                ? "border-emerald-600 text-emerald-700 font-bold bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Trophy className="w-4 h-4" />
            3. 淘汰赛树状图 (32强 → 决赛)
          </button>
          
          <button
            id="tab-insight"
            onClick={() => setActiveTab("insight")}
            className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "insight"
                ? "border-emerald-600 text-emerald-700 font-bold bg-white animate-pulse"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <FileText className="w-4 h-4" />
            4. AI 夺冠白皮书报告
          </button>
        </div>

        {/* Content Screens */}
        
        {/* TAB 1: GROUP STAGE */}
        {activeTab === "group" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="stage-group-content">
            {/* Left Sidebar: Groups Selector */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                  <span>选择推演小组 (48强)</span>
                </div>
                
                {/* 12 group grid list */}
                <div className="grid grid-cols-3 gap-2" id="groups-select-grid">
                  {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map((letter) => {
                    const top2 = calculateGroupStanding(letter, INITIAL_TEAMS, groupMatches).slice(0, 2);
                    const isActive = selectedGroup === letter;
                    return (
                      <button
                        key={letter}
                        id={`group-btn-${letter}`}
                        onClick={() => setSelectedGroup(letter)}
                        className={`p-2.5 rounded-xl text-left border flex flex-col justify-between transition active:scale-95 cursor-pointer h-20 ${
                          isActive
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                        }`}
                      >
                        <span className="font-black text-sm">小組 {letter}</span>
                        <div className="flex items-center gap-1 mt-1">
                          {top2.map((team, idx) => (
                            <span key={idx} className="text-xs" title={team.name}>
                              {team.flag}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group Rules Helper */}
              <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold mb-1.5">
                  <Info className="w-4 h-4 text-amber-600" />
                  <span>2026 赛事晋级规程</span>
                </div>
                <p>
                  美加墨世界杯采用创新 48 队赛制。12 个小组的前两名（24支球队）与 <strong>8 个成绩最好的小组第三名</strong> 直接晋级 32 强淘汰赛。请在积分榜变化时，随时查看第二阶段“小组第三排名”。
                </p>
              </div>
            </div>

            {/* Middle Main Column: Group Matches Interactivity */}
            <div className="lg:col-span-5 flex flex-col gap-6" id="group-matches-area">
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      小组 {selectedGroup} 对阵推演
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      输入每场赛况的预期进球数，可使用两端加减调整按钮
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-slate-150 text-slate-600 font-bold rounded-lg uppercase">
                    第 1-3 轮循环
                  </span>
                </div>

                {/* 6 Matches list */}
                <div className="flex flex-col gap-4" id="group-matches-list">
                  {groupMatches
                    .filter((m) => m.group === selectedGroup)
                    .map((m, index) => {
                      const h = getTeamById(m.homeTeam);
                      const a = getTeamById(m.awayTeam);
                      return (
                        <div
                          key={m.id}
                          id={`group-match-card-${m.id}`}
                          className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/60 rounded-xl flex flex-col gap-2 transition"
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>赛序 {index + 1} / 组内对决</span>
                            <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              2026 正赛场
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 py-1.5">
                            {/* Home team */}
                            <div className="flex-1 flex items-center justify-end gap-2 text-right min-w-0">
                              <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                                #{h.rank}
                              </span>
                              <span className="text-sm font-bold text-slate-800 truncate" title={`${h.name} (FIFA排名:${h.rank})`}>
                                {h.name}
                              </span>
                              <span className="text-xl flex-shrink-0" role="img" aria-label={h.name}>
                                {h.flag}
                              </span>
                            </div>

                            {/* Score Input Core */}
                            <div className="flex items-center justify-center gap-1 flex-shrink-0 bg-slate-50/85 border border-slate-200/60 rounded-lg p-0.5 shadow-2xs">
                              {/* Home score decrease */}
                              <button
                                id={`btn-dec-home-${m.id}`}
                                onClick={() => adjustScore(m.id, "home", m.homeScore, -1)}
                                className="w-5 h-5 bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-xs text-slate-600 transition cursor-pointer flex-shrink-0 shadow-xs"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              
                              <input
                                id={`input-home-score-${m.id}`}
                                type="text"
                                value={m.homeScore ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? null : parseInt(e.target.value);
                                  handleGroupScoreChange(m.id, "home", isNaN(val as number) ? null : val);
                                }}
                                placeholder="-"
                                className="w-7 h-7 bg-white text-center font-black text-slate-800 text-sm border border-slate-200 rounded focus:border-emerald-500 focus:outline-none flex-shrink-0 shadow-2xs"
                              />

                              <span className="text-slate-450 font-black px-0.5 flex-shrink-0">:</span>

                              <input
                                id={`input-away-score-${m.id}`}
                                type="text"
                                value={m.awayScore ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? null : parseInt(e.target.value);
                                  handleGroupScoreChange(m.id, "away", isNaN(val as number) ? null : val);
                                }}
                                placeholder="-"
                                className="w-7 h-7 bg-white text-center font-black text-slate-800 text-sm border border-slate-200 rounded focus:border-emerald-500 focus:outline-none flex-shrink-0 shadow-2xs"
                              />

                              {/* Away score increase */}
                              <button
                                id={`btn-inc-away-${m.id}`}
                                onClick={() => adjustScore(m.id, "away", m.awayScore, 1)}
                                className="w-5 h-5 bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-xs text-slate-600 transition cursor-pointer flex-shrink-0 shadow-xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Away team */}
                            <div className="flex-1 flex items-center justify-start gap-2 text-left min-w-0">
                              <span className="text-xl flex-shrink-0" role="img" aria-label={a.name}>
                                {a.flag}
                              </span>
                              <span className="text-sm font-bold text-slate-800 truncate" title={`${a.name} (FIFA排名:${a.rank})`}>
                                {a.name}
                              </span>
                              <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                                #{a.rank}
                              </span>
                            </div>
                          </div>

                          {/* Quick AI Advisor Trigger */}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                            {m.homeScore !== null && m.awayScore !== null ? (
                              <div className="text-[10px] text-slate-400 max-w-[65%] truncate">
                                结果预测:{" "}
                                {m.homeScore > m.awayScore ? (
                                  <span className="text-emerald-600 font-semibold">{h.name} 胜</span>
                                ) : m.homeScore < m.awayScore ? (
                                  <span className="text-emerald-600 font-semibold">{a.name} 胜</span>
                                ) : (
                                  <span className="text-slate-500 font-semibold">双方握手言和</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400">尚未填报比分</div>
                            )}

                            <button
                              id={`btn-ai-match-${m.id}`}
                              onClick={() => openMatchAnalysis(m)}
                              className="px-2 py-1 bg-white hover:bg-emerald-50 border border-emerald-100 hover:border-emerald-300 text-[10px] text-emerald-800 font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-emerald-500" />
                              AI 战史及战术推演
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Right Column: Real-time dynamic standings */}
            <div className="lg:col-span-4 flex flex-col gap-4" id="group-standings-area">
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    小组 {selectedGroup} 实时积分榜
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    根据您设定的比分，表格完全自主按 FIFA 官方规则排名
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-150 uppercase bg-slate-50/50">
                        <th className="py-2 px-1 text-center w-6">#</th>
                        <th className="py-2 px-1">球队</th>
                        <th className="py-2 px-1 text-center">赛</th>
                        <th className="py-2 px-1 text-center">胜</th>
                        <th className="py-2 px-1 text-center">平</th>
                        <th className="py-2 px-1 text-center">负</th>
                        <th className="py-2 px-1 text-center">得/失</th>
                        <th className="py-2 px-1 text-center font-bold">净</th>
                        <th className="py-2 px-1 text-center font-bold text-emerald-600 bg-emerald-50/50">分</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeGroupStandings.map((team, idx) => {
                        const isAdvancing = idx < 2;
                        const isThird = idx === 2;
                        return (
                          <tr
                            key={team.id}
                            id={`standing-row-${team.id}`}
                            className={`transition ${
                              isAdvancing
                                ? "bg-emerald-50/30 hover:bg-emerald-50/50 text-slate-900"
                                : isThird
                                ? "bg-amber-50/30 hover:bg-amber-50/55 text-slate-800"
                                : "text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <td className="py-2.5 px-1 text-center font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-1 font-bold flex items-center gap-1 truncate max-w-[120px]">
                              <span>{team.flag}</span>
                              <span className="truncate">{team.name}</span>
                              {isAdvancing && (
                                <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                              )}
                            </td>
                            <td className="py-2.5 px-1 text-center">{team.mp}</td>
                            <td className="py-2.5 px-1 text-center">{team.w}</td>
                            <td className="py-2.5 px-1 text-center">{team.d}</td>
                            <td className="py-2.5 px-1 text-center">{team.l}</td>
                            <td className="py-2.5 px-1 text-center whitespace-nowrap">
                              {team.gf}-{team.ga}
                            </td>
                            <td className="py-2.5 px-1 text-center font-bold">
                              {team.gd > 0 ? `+${team.gd}` : team.gd}
                            </td>
                            <td className="py-2.5 px-1 text-center font-black text-emerald-700 bg-emerald-50/30">
                              {team.pts}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-500/20 border border-emerald-500 rounded-full inline-block" />
                    <span>区域内前两名：直接获得 32强 淘汰赛直通门票</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-amber-500/20 border border-amber-500 rounded-full inline-block" />
                    <span>区域内第三名：进入 12租 总榜筛选（前 8 名亦可晋级）</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-slate-200 border border-slate-350 rounded-full inline-block" />
                    <span>尾部第四名：遗憾出局，止步北美</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BEST THIRD-PLACE TEAMS */}
        {activeTab === "thirds" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200" id="stage-thirds-content">
            <div className="border-b border-slate-100 pb-5 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  12个小组第三名 总榜积分大比拼
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  12个组内的第三位球队汇聚于此。排名前 8 位的队伍即可在 Round of 32 补盲晋级。
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl max-w-sm text-xs text-slate-600">
                <strong>💡 排序标准:</strong> 积分 &gt; 净胜球 &gt; 进球数 &gt; 初始国际排名
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200 py-3 bg-slate-50/50">
                    <th className="py-3 px-3 text-center w-12">排序</th>
                    <th className="py-3 px-3">球队 (小组)</th>
                    <th className="py-3 px-2 text-center">赛</th>
                    <th className="py-3 px-2 text-center">胜</th>
                    <th className="py-3 px-2 text-center">平</th>
                    <th className="py-3 px-2 text-center">负</th>
                    <th className="py-3 px-2 text-center">进/失</th>
                    <th className="py-3 px-2 text-center font-bold">净胜球</th>
                    <th className="py-3 px-2 text-center font-bold text-emerald-600">积分</th>
                    <th className="py-3 px-3 text-center">状态走向</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {thirdPlaceWildcards.map((team, idx) => {
                    const isAdvancing = idx < 8;
                    return (
                      <tr
                        key={team.id}
                        id={`third-row-${team.id}`}
                        className={`transition ${
                          isAdvancing
                            ? "bg-emerald-50/20 hover:bg-emerald-50/40 text-slate-900"
                            : "bg-red-50/10 hover:bg-slate-50 text-slate-500"
                        }`}
                      >
                        <td className="py-3 px-3 text-center font-extrabold text-slate-700">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-bold flex items-center gap-2">
                          <span className="text-2xl">{team.flag}</span>
                          <div>
                            <span className="text-slate-950 font-bold">{team.name}</span>
                            <span className="text-xs text-slate-400 block font-normal">
                              组别 {team.group}组 (FIFA #{team.rank})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">{team.mp}</td>
                        <td className="py-3 px-2 text-center">{team.w}</td>
                        <td className="py-3 px-2 text-center">{team.d}</td>
                        <td className="py-3 px-2 text-center">{team.l}</td>
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {team.gf}-{team.ga}
                        </td>
                        <td className="py-3 px-2 text-center font-extrabold">
                          {team.gd > 0 ? `+${team.gd}` : team.gd}
                        </td>
                        <td className="py-3 px-2 text-center font-black text-emerald-600">
                          {team.pts}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isAdvancing ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <Check className="w-3 h-3" />
                              直冲32强
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
                              <X className="w-3.5 h-3.5" />
                              吞恨淘汰
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: KNOCKOUT BRACKET GRAPH */}
        {activeTab === "knockout" && knockoutBracket && (
          <div className="flex flex-col gap-6" id="stage-knockout-content">
            {/* Top Prompt Info */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Compass className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">淘汰赛即时演习沙盘 (动态树状结构)</h3>
                  <p className="text-xs text-slate-400">小组赛的所有积分变化，都将一秒更新到这里！</p>
                </div>
              </div>

              {worldCupChampion && (
                <div className="bg-emerald-50 text-emerald-950 px-4 py-2 rounded-xl flex items-center gap-2.5 border border-emerald-200">
                  <span className="text-2xl animate-bounce">{worldCupChampion.flag}</span>
                  <div>
                    <span className="text-[10px] text-emerald-600 block uppercase font-bold">最终冠军预测归属</span>
                    <strong className="text-sm tracking-tight text-emerald-900">{worldCupChampion.name}</strong>
                  </div>
                  <button
                    id="btn-fast-report"
                    onClick={generateFullTournamentReport}
                    className="ml-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    写一万字分析
                  </button>
                </div>
              )}
            </div>

            {/* Horizontal Grid Tree visualization */}
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto min-w-[1200px]" id="knockout-tree-board">
              <div className="grid grid-cols-6 gap-6 text-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 bg-slate-50/50 py-3 rounded-xl border border-slate-100">
                <div>32 强赛 (Round of 32)</div>
                <div>16 强赛 (Round of 16)</div>
                <div>四分之一决赛 (Quarter-Finals)</div>
                <div>半决赛 (Semi-Finals)</div>
                <div>三四名 / 冠亚军 (Finals)</div>
                <div>荣誉总览</div>
              </div>

              {/* Bracket columns mapping */}
              <div className="grid grid-cols-6 gap-6 relative" id="tree-columns-container">
                {/* 1. Round of 32 (16 Matches) */}
                <div className="flex flex-col justify-around gap-4">
                  {knockoutBracket.R32.map((m: Match, idx: number) => {
                    const h = getTeamById(m.homeTeam);
                    const a = getTeamById(m.awayTeam);
                    const homeUndecided = m.homeTeam.includes("待定") || m.homeTeam === "待定";
                    const awayUndecided = m.awayTeam.includes("待定") || m.awayTeam === "待定";
                    return (
                      <div
                        key={m.id}
                        id={`match-card-${m.id}`}
                        className={`p-2.5 rounded-xl border transition-all text-[11px] ${
                          m.homeScore !== null && m.awayScore !== null
                            ? "bg-slate-55 border-slate-300"
                            : "bg-slate-50/55 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1.5 border-b border-slate-100 pb-1">
                          <span>场次 R32_{idx + 1}</span>
                          <button
                            onClick={() => openMatchAnalysis(m)}
                            className="text-emerald-600 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                            disabled={homeUndecided || awayUndecided}
                          >
                            <Sparkles className="w-2.5 h-2.5" /> AI
                          </button>
                        </div>
                        
                        {/* Match rows */}
                        <div className="flex flex-col gap-1.5 pb-0.5">
                          {/* Home */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.homeTeam && m.isPredicted ? "text-emerald-700 font-bold" : "text-slate-700"}`}>
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[110px] flex-shrink">
                              <span className="flex-shrink-0">{h.flag}</span>
                              <span className="truncate" title={h.name}>{h.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {m.homeScore === m.awayScore && m.homeScore !== null && (
                                <input
                                  type="text"
                                  value={m.homePenScore ?? ""}
                                  placeholder="点"
                                  title="点球大战得分"
                                  onChange={(e) => handleKnockoutScoreChange("R32", idx, "homePen", e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="w-5 h-5 bg-amber-50 text-center font-bold text-[9px] border border-amber-200 rounded animate-fade-in"
                                />
                              )}
                              <input
                                type="text"
                                value={m.homeScore ?? ""}
                                placeholder="-"
                                onChange={(e) => handleKnockoutScoreChange("R32", idx, "home", e.target.value === "" ? null : parseInt(e.target.value))}
                                className="w-6 h-6 text-center font-black border border-slate-200 rounded bg-white"
                              />
                            </div>
                          </div>
                          
                          {/* Away */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.awayTeam && m.isPredicted ? "text-emerald-700 font-bold" : "text-slate-700"}`}>
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[110px] flex-shrink">
                              <span className="flex-shrink-0">{a.flag}</span>
                              <span className="truncate" title={a.name}>{a.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {m.homeScore === m.awayScore && m.homeScore !== null && (
                                <input
                                  type="text"
                                  value={m.awayPenScore ?? ""}
                                  placeholder="点"
                                  title="点球大战得分"
                                  onChange={(e) => handleKnockoutScoreChange("R32", idx, "awayPen", e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="w-5 h-5 bg-amber-50 text-center font-bold text-[9px] border border-amber-200 rounded animate-fade-in"
                                />
                              )}
                              <input
                                type="text"
                                value={m.awayScore ?? ""}
                                placeholder="-"
                                onChange={(e) => handleKnockoutScoreChange("R32", idx, "away", e.target.value === "" ? null : parseInt(e.target.value))}
                                className="w-6 h-6 text-center font-black border border-slate-200 rounded bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Round of 16 (8 Matches) */}
                <div className="flex flex-col justify-around gap-6">
                  {knockoutBracket.R16.map((m: Match, idx: number) => {
                    const h = getTeamById(m.homeTeam);
                    const a = getTeamById(m.awayTeam);
                    const isDecided = m.homeTeam !== "待定" && m.awayTeam !== "待定";
                    return (
                      <div
                        key={m.id}
                        id={`match-card-${m.id}`}
                        className={`p-2.5 rounded-xl border transition-all text-[11px] ${
                          isDecided ? "bg-white border-slate-250 shadow-sm" : "bg-slate-50/50 border-slate-150 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1 border-b border-slate-100 pb-1">
                          <span>场次 R16_{idx + 1}</span>
                          <button
                            onClick={() => openMatchAnalysis(m)}
                            disabled={!isDecided}
                            className="text-emerald-600 hover:underline flex items-center gap-0.5 font-bold cursor-pointer disabled:opacity-30"
                          >
                            <Sparkles className="w-2.5 h-2.5" /> AI
                          </button>
                        </div>
                        
                        <div className="flex flex-col gap-1.5 pb-0.5">
                          {/* Home */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.homeTeam && m.isPredicted ? "text-emerald-700 font-bold" : "text-slate-700"}`}>
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[110px] flex-shrink">
                              <span className="flex-shrink-0">{h.flag}</span>
                              <span className="truncate" title={h.name}>{h.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {m.homeScore === m.awayScore && m.homeScore !== null && (
                                <input
                                  type="text"
                                  value={m.homePenScore ?? ""}
                                  placeholder="点"
                                  onChange={(e) => handleKnockoutScoreChange("R16", idx, "homePen", e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="w-5 h-5 bg-amber-50 text-center font-bold text-[9px] border border-amber-200 rounded"
                                />
                              )}
                              <input
                                type="text"
                                value={m.homeScore ?? ""}
                                placeholder="-"
                                disabled={!isDecided}
                                onChange={(e) => handleKnockoutScoreChange("R16", idx, "home", e.target.value === "" ? null : parseInt(e.target.value))}
                                className="w-6 h-6 text-center font-black border border-slate-200 rounded disabled:bg-slate-100 bg-white"
                              />
                            </div>
                          </div>

                          {/* Away */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.awayTeam && m.isPredicted ? "text-emerald-700 font-bold" : "text-slate-700"}`}>
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[110px] flex-shrink">
                              <span className="flex-shrink-0">{a.flag}</span>
                              <span className="truncate" title={a.name}>{a.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {m.homeScore === m.awayScore && m.homeScore !== null && (
                                <input
                                  type="text"
                                  value={m.awayPenScore ?? ""}
                                  placeholder="点"
                                  onChange={(e) => handleKnockoutScoreChange("R16", idx, "awayPen", e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="w-5 h-5 bg-amber-50 text-center font-bold text-[9px] border border-amber-200 rounded"
                                />
                              )}
                              <input
                                type="text"
                                value={m.awayScore ?? ""}
                                placeholder="-"
                                disabled={!isDecided}
                                onChange={(e) => handleKnockoutScoreChange("R16", idx, "away", e.target.value === "" ? null : parseInt(e.target.value))}
                                className="w-6 h-6 text-center font-black border border-slate-200 rounded disabled:bg-slate-100 bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 3. Quarterfinals (4 Matches) */}
                <div className="flex flex-col justify-around gap-12">
                  {knockoutBracket.QF.map((m: Match, idx: number) => {
                    const h = getTeamById(m.homeTeam);
                    const a = getTeamById(m.awayTeam);
                    const isDecided = m.homeTeam !== "待定" && m.awayTeam !== "待定";
                    return (
                      <div
                        key={m.id}
                        id={`match-card-${m.id}`}
                        className={`p-2.5 rounded-xl border transition-all text-[11px] ${
                          isDecided ? "bg-white border-slate-250 shadow-md" : "bg-slate-50/50 border-slate-150 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1 border-b border-slate-100 pb-1">
                          <span>八强 QF_{idx + 1}</span>
                          <button
                            onClick={() => openMatchAnalysis(m)}
                            disabled={!isDecided}
                            className="text-emerald-600 hover:underline flex items-center gap-0.5 font-bold cursor-pointer disabled:opacity-30"
                          >
                            <Sparkles className="w-2.5 h-2.5" /> AI
                          </button>
                        </div>
                        
                        <div className="flex flex-col gap-1.5 pb-0.5">
                          {/* Home */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.homeTeam && m.isPredicted ? "text-emerald-700 font-bold" : "text-slate-700"}`}>
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[110px] flex-shrink">
                              <span className="flex-shrink-0">{h.flag}</span>
                              <span className="truncate" title={h.name}>{h.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {m.homeScore === m.awayScore && m.homeScore !== null && (
                                <input
                                  type="text"
                                  value={m.homePenScore ?? ""}
                                  placeholder="点"
                                  onChange={(e) => handleKnockoutScoreChange("QF", idx, "homePen", e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="w-5 h-5 bg-amber-50 text-center font-bold text-[9px] border border-amber-200 rounded"
                                />
                              )}
                              <input
                                type="text"
                                value={m.homeScore ?? ""}
                                placeholder="-"
                                disabled={!isDecided}
                                onChange={(e) => handleKnockoutScoreChange("QF", idx, "home", e.target.value === "" ? null : parseInt(e.target.value))}
                                className="w-6 h-6 text-center font-black border border-slate-200 rounded disabled:bg-slate-100 bg-white"
                              />
                            </div>
                          </div>

                          {/* Away */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.awayTeam && m.isPredicted ? "text-emerald-700 font-bold" : "text-slate-700"}`}>
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[110px] flex-shrink">
                              <span className="flex-shrink-0">{a.flag}</span>
                              <span className="truncate" title={a.name}>{a.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {m.homeScore === m.awayScore && m.homeScore !== null && (
                                <input
                                  type="text"
                                  value={m.awayPenScore ?? ""}
                                  placeholder="点"
                                  onChange={(e) => handleKnockoutScoreChange("QF", idx, "awayPen", e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="w-5 h-5 bg-amber-50 text-center font-bold text-[9px] border border-amber-200 rounded"
                                />
                              )}
                              <input
                                type="text"
                                value={m.awayScore ?? ""}
                                placeholder="-"
                                disabled={!isDecided}
                                onChange={(e) => handleKnockoutScoreChange("QF", idx, "away", e.target.value === "" ? null : parseInt(e.target.value))}
                                className="w-6 h-6 text-center font-black border border-slate-200 rounded disabled:bg-slate-100 bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 4. Semi-Finals (2 Matches) */}
                <div className="flex flex-col justify-around gap-20">
                  {knockoutBracket.SF.map((m: Match, idx: number) => {
                    const h = getTeamById(m.homeTeam);
                    const a = getTeamById(m.awayTeam);
                    const isDecided = m.homeTeam !== "待定" && m.awayTeam !== "待定";
                    return (
                      <div
                        key={m.id}
                        id={`match-card-${m.id}`}
                        className={`p-3.5 rounded-xl border transition-all text-xs ${
                          isDecided ? "bg-emerald-50/20 border-emerald-300 shadow-lg" : "bg-slate-50/50 border-slate-150 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1.5 border-b border-slate-150 pb-1">
                          <span className="font-bold text-amber-800">半决赛 SF_{idx + 1}</span>
                          <button
                            onClick={() => openMatchAnalysis(m)}
                            disabled={!isDecided}
                            className="text-emerald-600 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                          >
                            <Sparkles className="w-2.5 h-2.5" /> AI
                          </button>
                        </div>
                        
                        <div className="flex flex-col gap-2 pb-0.5">
                          {/* Home */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.homeTeam && m.isPredicted ? "text-emerald-700 font-bold" : "text-slate-700"}`}>
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[110px] flex-shrink">
                              <span className="flex-shrink-0">{h.flag}</span>
                              <span className="truncate font-extrabold" title={h.name}>{h.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {m.homeScore === m.awayScore && m.homeScore !== null && (
                                <input
                                  type="text"
                                  value={m.homePenScore ?? ""}
                                  placeholder="点"
                                  onChange={(e) => handleKnockoutScoreChange("SF", idx, "homePen", e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="w-5 h-5 bg-amber-50 text-center font-bold text-[9px] border border-amber-200 rounded"
                                />
                              )}
                              <input
                                type="text"
                                value={m.homeScore ?? ""}
                                placeholder="-"
                                disabled={!isDecided}
                                onChange={(e) => handleKnockoutScoreChange("SF", idx, "home", e.target.value === "" ? null : parseInt(e.target.value))}
                                className="w-7 h-7 text-center font-black border border-slate-200 rounded bg-white"
                              />
                            </div>
                          </div>

                          {/* Away */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.awayTeam && m.isPredicted ? "text-emerald-700 font-bold" : "text-slate-700"}`}>
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[110px] flex-shrink">
                              <span className="flex-shrink-0">{a.flag}</span>
                              <span className="truncate font-extrabold" title={a.name}>{a.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {m.homeScore === m.awayScore && m.homeScore !== null && (
                                <input
                                  type="text"
                                  value={m.awayPenScore ?? ""}
                                  placeholder="点"
                                  onChange={(e) => handleKnockoutScoreChange("SF", idx, "awayPen", e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="w-5 h-5 bg-amber-50 text-center font-bold text-[9px] border border-amber-200 rounded"
                                />
                              )}
                              <input
                                type="text"
                                value={m.awayScore ?? ""}
                                placeholder="-"
                                disabled={!isDecided}
                                onChange={(e) => handleKnockoutScoreChange("SF", idx, "away", e.target.value === "" ? null : parseInt(e.target.value))}
                                className="w-7 h-7 text-center font-black border border-slate-200 rounded bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 5. Finals & 3rd Place */}
                <div className="flex flex-col justify-around gap-6">
                  {/* Final Match */}
                  {knockoutBracket.FINAL.map((m: Match, idx: number) => {
                    const h = getTeamById(m.homeTeam);
                    const a = getTeamById(m.awayTeam);
                    const isDecided = m.homeTeam !== "待定" && m.awayTeam !== "待定";
                    return (
                      <div
                        key={m.id}
                        id="final-match-card"
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-2.5 shadow-2xl relative overflow-hidden ${
                          isDecided
                            ? "bg-amber-50/20 border-amber-400"
                            : "bg-slate-50/50 border-slate-200 text-slate-400"
                        }`}
                      >
                        {isDecided && (
                          <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 text-[8px] font-black uppercase px-2 py-0.5 rounded-bl">
                            大力神杯之巅
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 border-b border-amber-200/50 pb-1.5">
                          <span className="font-extrabold text-amber-700">🏆 终极总决赛</span>
                          <button
                            onClick={() => openMatchAnalysis(m)}
                            disabled={!isDecided}
                            className="text-emerald-700 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-500" /> AI 战术白币书
                          </button>
                        </div>
                        
                        <div className="flex flex-col gap-2 pb-0.5">
                          {/* Home */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.homeTeam && m.isPredicted ? "text-amber-800 font-extrabold" : "text-slate-800"}`}>
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[110px] flex-shrink">
                              <span className="flex-shrink-0">{h.flag}</span>
                              <span className="truncate font-black" title={h.name}>{h.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {m.homeScore === m.awayScore && m.homeScore !== null && (
                                <input
                                  type="text"
                                  value={m.homePenScore ?? ""}
                                  placeholder="点"
                                  onChange={(e) => handleKnockoutScoreChange("FINAL", idx, "homePen", e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="w-5 h-5 bg-amber-100 text-center font-bold text-[9px] border border-amber-300 rounded"
                                />
                              )}
                              <input
                                type="text"
                                value={m.homeScore ?? ""}
                                placeholder="-"
                                disabled={!isDecided}
                                onChange={(e) => handleKnockoutScoreChange("FINAL", idx, "home", e.target.value === "" ? null : parseInt(e.target.value))}
                                className="w-8 h-8 text-center font-black border border-slate-200 rounded bg-white"
                              />
                            </div>
                          </div>

                          {/* Away */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.awayTeam && m.isPredicted ? "text-amber-800 font-extrabold" : "text-slate-800"}`}>
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[110px] flex-shrink">
                              <span className="flex-shrink-0">{a.flag}</span>
                              <span className="truncate font-black" title={a.name}>{a.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {m.homeScore === m.awayScore && m.homeScore !== null && (
                                <input
                                  type="text"
                                  value={m.awayPenScore ?? ""}
                                  placeholder="点"
                                  onChange={(e) => handleKnockoutScoreChange("FINAL", idx, "awayPen", e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="w-5 h-5 bg-amber-100 text-center font-bold text-[9px] border border-amber-300 rounded"
                                />
                              )}
                              <input
                                type="text"
                                value={m.awayScore ?? ""}
                                placeholder="-"
                                disabled={!isDecided}
                                onChange={(e) => handleKnockoutScoreChange("FINAL", idx, "away", e.target.value === "" ? null : parseInt(e.target.value))}
                                className="w-8 h-8 text-center font-black border border-slate-200 rounded bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* 3rd Place Match */}
                  {knockoutBracket["3RD"].map((m: Match, idx: number) => {
                    const h = getTeamById(m.homeTeam);
                    const a = getTeamById(m.awayTeam);
                    const isDecided = m.homeTeam !== "待定" && m.awayTeam !== "待定";
                    return (
                      <div
                        key={m.id}
                        id="third-match-card"
                        className={`p-3 rounded-xl border transition-all text-xs flex flex-col gap-1.5 shadow-md ${
                          isDecided ? "bg-slate-50 border-slate-300" : "bg-slate-50/50 border-slate-150 text-slate-400"
                        }`}
                      >
                        <div className="text-[9px] text-slate-400 border-b border-slate-200 pb-1 mb-1 font-bold">
                          🥉 季军争夺战
                        </div>
                        <div className="flex flex-col gap-1.5 pb-0.5">
                          {/* Home */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.homeTeam && m.isPredicted ? "text-amber-800 font-bold" : "text-slate-700"}`}>
                            <div className="flex items-center gap-1 min-w-0 max-w-[95px] flex-shrink">
                              <span className="flex-shrink-0">{h.flag}</span>
                              <span className="truncate" title={h.name}>{h.name}</span>
                            </div>
                            <input
                              type="text"
                              value={m.homeScore ?? ""}
                              placeholder="-"
                              disabled={!isDecided}
                              onChange={(e) => handleKnockoutScoreChange("3RD", idx, "home", e.target.value === "" ? null : parseInt(e.target.value))}
                              className="w-6 h-6 text-center font-bold border border-slate-200 rounded disabled:bg-slate-100 bg-white"
                            />
                          </div>

                          {/* Away */}
                          <div className={`flex items-center justify-between gap-2 min-w-0 ${getKnockoutMatchWinner(m) === m.awayTeam && m.isPredicted ? "text-amber-800 font-bold" : "text-slate-700"}`}>
                            <div className="flex items-center gap-1 min-w-0 max-w-[95px] flex-shrink">
                              <span className="flex-shrink-0">{a.flag}</span>
                              <span className="truncate" title={a.name}>{a.name}</span>
                            </div>
                            <input
                              type="text"
                              value={m.awayScore ?? ""}
                              placeholder="-"
                              disabled={!isDecided}
                              onChange={(e) => handleKnockoutScoreChange("3RD", idx, "away", e.target.value === "" ? null : parseInt(e.target.value))}
                              className="w-6 h-6 text-center font-bold border border-slate-200 rounded disabled:bg-slate-100 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 6. Grand Champion Celebration Column */}
                <div className="flex flex-col justify-center items-center gap-6" id="grand-champion-celebration">
                  {worldCupChampion ? (
                    <div className="p-6 bg-gradient-to-b from-amber-50 to-amber-100/50 border-2 border-amber-300 rounded-2xl shadow-xl text-center flex flex-col items-center gap-3 w-full animate-bounce">
                      <div className="w-14 h-14 bg-amber-400 text-white rounded-full flex items-center justify-center text-4xl shadow-md border border-amber-300">
                        👑
                      </div>
                      <div className="text-4xl">{worldCupChampion.flag}</div>
                      <div>
                        <span className="text-[10px] text-amber-700 uppercase tracking-widest font-black block">2026 世界杯总冠军</span>
                        <h4 className="text-xl font-extrabold text-amber-950 mt-1">{worldCupChampion.name}</h4>
                        <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">FIFA 世界排名 #{worldCupChampion.rank}</span>
                      </div>
                      
                      <button
                        id="btn-generate-manifest"
                        onClick={generateFullTournamentReport}
                        disabled={reportLoading}
                        className="mt-2 text-[10px] py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 shadow transition cursor-pointer"
                      >
                        {reportLoading ? "正在筹备万字报告..." : "📊 生成预测全景白皮书"}
                      </button>

                      <button
                        id="btn-champion-poster"
                        onClick={() => setIsPosterOpen(true)}
                        className="text-[10px] py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1 shadow transition cursor-pointer"
                      >
                        🎨 保存专属预测海报
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center flex flex-col items-center gap-2 w-full text-slate-400">
                      <div className="w-12 h-12 bg-slate-100 text-slate-350 rounded-full flex items-center justify-center text-2xl">
                        🏆
                      </div>
                      <span className="text-xs font-bold font-mono">等待王牌决出</span>
                      <p className="text-[10px] max-w-[140px] leading-relaxed">
                        在淘汰赛树状图上，输入所有赛果直至金盃诞生！
                      </p>
                    </div>
                  )}

                  {/* World Cup 3rd Winner summary badge */}
                  {knockoutBracket["3RD"]?.[0]?.homeScore !== null && knockoutBracket["3RD"]?.[0]?.awayScore !== null && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 w-full shadow-sm">
                      🥉 季军获得者：
                      <strong className="text-slate-800 ml-1 font-extrabold">
                        {getTeamById(getKnockoutMatchWinner(knockoutBracket["3RD"][0])).name}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FINAL FULL REPORT */}
        {activeTab === "insight" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md max-w-4xl mx-auto" id="stage-report-content">
            <div className="border-b border-slate-200 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileText className="w-6 h-6" />
                </span>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    2026 美加墨世界杯：AI 预测全景沙盘与战书白皮书
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    系统为您实时汇总了整套沙盘的大数据出线趋势，并连线 Gemini 战术大师实时起草
                  </p>
                </div>
              </div>

              {fullReport && (
                <div className="flex items-center gap-2">
                  <button
                    id="btn-copy-report"
                    onClick={() => copyToClipboard(fullReport)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    复制报告文本
                  </button>
                </div>
              )}
            </div>

            {/* Content area */}
            {reportLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-4" id="ai-report-spinner">
                <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-slate-700">
                  🎙️ 正在连线最权威的足球战术评论大师（Gemini AI）进行深度复盘...
                </p>
                <p className="text-xs text-slate-400">
                  这包含分析您录入的所有黑马奇迹、总冠军战术精髓，需要消耗几秒钟，请稍候。
                </p>
              </div>
            ) : fullReport ? (
              <div className="prose prose-slate max-w-none prose-emerald bg-slate-50/55 p-6 rounded-2xl border border-slate-100 text-sm leading-relaxed" id="ai-report-paper">
                <div className="whitespace-pre-wrap">{fullReport}</div>
                <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <span>© 2026美加墨世界杯极限预测沙盘</span>
                  <span>•</span>
                  <span>由 Google Gemini 3.5 顶尖足球战术引擎全力支持</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center" id="ai-report-empty">
                <div className="max-w-md mx-auto flex flex-col items-center gap-4">
                  <Trophy className="w-16 h-16 text-amber-400 animate-bounce" />
                  <h3 className="text-lg font-bold text-slate-800">尚未起草预测白皮书</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    在淘汰赛阶段决出您的【总冠军】后，点击下方的按钮，AI 将一键调取整条晋级树的胜平负数据、冷门概率，为您写成一份专业的赛事宏观分析白皮书！
                  </p>
                  
                  <button
                    id="btn-report-run"
                    onClick={generateFullTournamentReport}
                    className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow transition active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-305" />
                    立即生成 AI 世界杯白皮书
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-10 mt-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 text-center flex flex-col gap-4">
          <div className="flex items-center justify-center gap-2 text-white">
            <Trophy className="w-6 h-6 text-amber-400" />
            <span className="font-extrabold tracking-wider">FIFA WORLD CUP 2026 SIMULATOR</span>
          </div>
          <p className="text-xs max-w-3xl mx-auto leading-relaxed">
            2026 美加墨世界杯（联同美国、加拿大及墨西哥）是历史上最大规模的 48 队世界杯盛典。本工具由球迷倾心开发，仅供玩家娱乐与预测沙盘推演，排名计算机制完全对齐 FIFA 2026 组赛第一阶段的出线规则标准。
          </p>
          <div className="text-[10px] text-slate-600 pt-4 border-t border-slate-800/60 font-mono">
            Vite 6 Fullstack React 19 Applet • Powered by AI Studio & DeepMind
          </div>
        </div>
      </footer>

      {/* SIDEBAR DRAWER: AI MATCH BATTLEFIELD ANALYSIS */}
      {analyzingMatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50 transition-opacity" id="ai-match-modal">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col relative animate-fade-in-left">
            {/* Drawer top header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Gemini 3.5 智能绿茵演武场 (H2H 分析)
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    深度对比历史战绩、战术痛点、核心主干及2026对位沙盘剖析
                  </p>
                </div>
              </div>
              <button
                id="btn-close-analysis"
                onClick={() => setAnalyzingMatch(null)}
                className="p-1.5 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sidebar content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Teams Quick Duel Header */}
              <div className="p-4 bg-emerald-950 text-white rounded-2xl flex items-center justify-around text-center border-b-4 border-emerald-500 shadow-md mb-6">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl">{getTeamById(analyzingMatch.homeTeam).flag}</span>
                  <strong className="text-sm">{getTeamById(analyzingMatch.homeTeam).name}</strong>
                  <span className="text-[9px] bg-emerald-800/60 px-1.5 py-0.5 rounded font-mono">FIFA #{getTeamById(analyzingMatch.homeTeam).rank}</span>
                </div>
                
                <div className="flex flex-col items-center">
                  <span className="text-xs text-emerald-400 tracking-widest font-black uppercase">VS</span>
                  <span className="text-[10px] text-slate-350 bg-emerald-900 font-mono px-2 py-0.5 rounded-full mt-1.5">
                    {analyzingMatch.homeScore !== null && analyzingMatch.awayScore !== null
                      ? `您预测比分: ${analyzingMatch.homeScore} - ${analyzingMatch.awayScore}`
                      : "沙盘待定"}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl">{getTeamById(analyzingMatch.awayTeam).flag}</span>
                  <strong className="text-sm">{getTeamById(analyzingMatch.awayTeam).name}</strong>
                  <span className="text-[9px] bg-emerald-800/60 px-1.5 py-0.5 rounded font-mono">FIFA #{getTeamById(analyzingMatch.awayTeam).rank}</span>
                </div>
              </div>

              {/* Loader */}
              {analyzingLoading ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold text-slate-700 animate-pulse">
                    🎙️ 詹俊和张路正在挑灯夜战，对比两队的世界杯历年档案与最新攻防战术数据...
                  </p>
                  <p className="text-[10px] text-slate-400">这需要大约 3-5 秒...</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50/55 p-5 rounded-2xl border border-slate-100">
                  {matchAnalysisText}
                </div>
              )}
            </div>

            {/* Sidebar drawer bottom */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                id="btn-close-analysis-bottom"
                onClick={() => setAnalyzingMatch(null)}
                className="px-4 py-2 bg-white border border-slate-250 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                关闭对话框
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prediction Poster Export Engine Modal */}
      <PredictionPoster
        isOpen={isPosterOpen}
        onClose={() => setIsPosterOpen(false)}
        groupMatches={groupMatches}
        knockoutBracket={knockoutBracket}
        getTeamById={getTeamById}
        getKnockoutMatchWinner={getKnockoutMatchWinner}
      />
    </div>
  );
}
