/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Team, GroupStanding, Match, INITIAL_TEAMS, KnockoutBracket } from "../types";

// Generates the 6 matches for a specific group A to L
export function generateGroupMatches(groupLetter: string, teamsInGroup: Team[]): Match[] {
  if (teamsInGroup.length !== 4) return [];

  const t = teamsInGroup;
  // Standard round robin pairings (6 matches)
  const pairings = [
    { home: t[0].id, away: t[1].id, id: `G_${groupLetter}_1` },
    { home: t[2].id, away: t[3].id, id: `G_${groupLetter}_2` },
    { home: t[0].id, away: t[2].id, id: `G_${groupLetter}_3` },
    { home: t[1].id, away: t[3].id, id: `G_${groupLetter}_4` },
    { home: t[3].id, away: t[0].id, id: `G_${groupLetter}_5` },
    { home: t[1].id, away: t[2].id, id: `G_${groupLetter}_6` },
  ];

  return pairings.map((p) => ({
    id: p.id,
    group: groupLetter,
    homeTeam: p.home,
    awayTeam: p.away,
    homeScore: null,
    awayScore: null,
    isPredicted: false,
    isKnockout: false,
    phase: "Group",
  }));
}

// Generates all 72 Group stage matches
export function generateAllGroupMatches(teams: Team[]): Match[] {
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  let allMatches: Match[] = [];
  letters.forEach((letter) => {
    const groupTeams = teams.filter((t) => t.group === letter);
    allMatches = allMatches.concat(generateGroupMatches(letter, groupTeams));
  });
  return allMatches;
}

// Calculate standing of a single group
export function calculateGroupStanding(
  groupLetter: string,
  teams: Team[],
  matches: Match[]
): GroupStanding[] {
  const groupTeams = teams.filter((t) => t.group === groupLetter);
  const groupMatches = matches.filter((m) => m.group === groupLetter);

  // Initialize standings
  const standingsMap: { [teamId: string]: GroupStanding } = {};
  groupTeams.forEach((t) => {
    standingsMap[t.id] = {
      ...t,
      mp: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    };
  });

  // Accumulate matches
  groupMatches.forEach((m) => {
    if (m.homeScore === null || m.awayScore === null) return;

    const home = standingsMap[m.homeTeam];
    const away = standingsMap[m.awayTeam];

    if (!home || !away) return;

    home.mp += 1;
    away.mp += 1;

    home.gf += m.homeScore;
    home.ga += m.awayScore;
    away.gf += m.awayScore;
    away.ga += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.w += 1;
      home.pts += 3;
      away.l += 1;
    } else if (m.homeScore < m.awayScore) {
      away.w += 1;
      away.pts += 3;
      home.l += 1;
    } else {
      home.d += 1;
      home.pts += 1;
      away.d += 1;
      away.pts += 1;
    }
  });

  const standingsList = Object.values(standingsMap);

  // Sort according to: PTS > GD > GF > Rank (Lower FIFA rank means stronger)
  standingsList.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.rank - b.rank; // Better rank (smaller number) first
  });

  // Calculate gd
  standingsList.forEach((team) => {
    team.gd = team.gf - team.ga;
  });

  return standingsList;
}

// Calculate third-place team standings to select top 8 third-place teams
export function calculateThirdPlaceStandings(
  teams: Team[],
  matches: Match[]
): GroupStanding[] {
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const thirds: GroupStanding[] = [];

  letters.forEach((groupLetter) => {
    const groupStanding = calculateGroupStanding(groupLetter, teams, matches);
    if (groupStanding.length >= 3) {
      // Third place team is index 2
      thirds.push(groupStanding[2]);
    }
  });

  // Sort third-place teams: PTS > GD > GF > FIFA Rank (Lower is better)
  thirds.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.rank - b.rank; // smaller number gets priority
  });

  return thirds;
}

// Initialize knockout brackets (Round of 32, R16, QF, SF, 3RD, FINAL)
export function buildKnockoutStage(
  teams: Team[],
  groupMatches: Match[]
): KnockoutBracket {
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const groupStandings: { [group: string]: GroupStanding[] } = {};

  letters.forEach((l) => {
    groupStandings[l] = calculateGroupStanding(l, teams, groupMatches);
  });

  const thirdStandings = calculateThirdPlaceStandings(teams, groupMatches);
  const top8Thirds = thirdStandings.slice(0, 8);

  // Helper to fallback if team has no matches calculated yet
  const getW = (groupLetter: string) => groupStandings[groupLetter]?.[0]?.id || `${groupLetter}1_待定`;
  const getRU = (groupLetter: string) => groupStandings[groupLetter]?.[1]?.id || `${groupLetter}2_待定`;
  const get3rd = (index: number) => top8Thirds[index]?.id || `T3_${index + 1}_待定`;

  // Standard R32 Matchups (16 matches)
  const r32Matches: Match[] = [
    { id: "R32_1", homeTeam: getW("A"), awayTeam: get3rd(0), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_2", homeTeam: getW("B"), awayTeam: get3rd(1), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_3", homeTeam: getW("C"), awayTeam: get3rd(2), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_4", homeTeam: getW("D"), awayTeam: get3rd(3), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_5", homeTeam: getW("E"), awayTeam: get3rd(4), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_6", homeTeam: getW("F"), awayTeam: get3rd(5), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_7", homeTeam: getW("G"), awayTeam: get3rd(6), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_8", homeTeam: getW("H"), awayTeam: get3rd(7), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_9", homeTeam: getRU("A"), awayTeam: getRU("B"), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_10", homeTeam: getRU("C"), awayTeam: getRU("D"), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_11", homeTeam: getRU("E"), awayTeam: getRU("F"), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_12", homeTeam: getRU("G"), awayTeam: getRU("H"), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_13", homeTeam: getW("I"), awayTeam: getRU("J"), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_14", homeTeam: getW("J"), awayTeam: getRU("I"), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_15", homeTeam: getW("K"), awayTeam: getRU("L"), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
    { id: "R32_16", homeTeam: getW("L"), awayTeam: getRU("K"), homeScore: null, awayScore: null, isPredicted: false, isKnockout: true, phase: "R32" },
  ];

  // Helper function to create empty knockout match
  const makeEmptyMatch = (id: string, phase: "R16" | "QF" | "SF" | "3RD" | "FINAL"): Match => ({
    id,
    homeTeam: "待定",
    awayTeam: "待定",
    homeScore: null,
    awayScore: null,
    isPredicted: false,
    isKnockout: true,
    phase,
  });

  return {
    R32: r32Matches,
    R16: Array.from({ length: 8 }, (_, i) => makeEmptyMatch(`R16_${i + 1}`, "R16")),
    QF: Array.from({ length: 4 }, (_, i) => makeEmptyMatch(`QF_${i + 1}`, "QF")),
    SF: Array.from({ length: 2 }, (_, i) => makeEmptyMatch(`SF_${i + 1}`, "SF")),
    "3RD": [makeEmptyMatch("3RD_1", "3RD")],
    FINAL: [makeEmptyMatch("FINAL_1", "FINAL")],
  };
}

// Function to calculate winner of a knockout match, returns teamId
export function getKnockoutMatchWinner(m: Match): string {
  if (m.homeScore === null || m.awayScore === null) return "待定";
  if (m.homeScore > m.awayScore) return m.homeTeam;
  if (m.homeScore < m.awayScore) return m.awayTeam;

  // Penalty shoot-out
  if (m.homePenScore !== undefined && m.awayPenScore !== undefined && m.homePenScore !== null && m.awayPenScore !== null) {
    return m.homePenScore > m.awayPenScore ? m.homeTeam : m.awayTeam;
  }
  return "待定"; // Undecided draw without penalties input
}

export function getKnockoutMatchLoser(m: Match): string {
  if (m.homeScore === null || m.awayScore === null) return "待定";
  if (m.homeScore > m.awayScore) return m.awayTeam;
  if (m.homeScore < m.awayScore) return m.homeTeam;

  // Penalty shoot-out
  if (m.homePenScore !== undefined && m.awayPenScore !== undefined && m.homePenScore !== null && m.awayPenScore !== null) {
    return m.homePenScore > m.awayPenScore ? m.awayTeam : m.homeTeam;
  }
  return "待定";
}

// Re-propagates the knockout stages when any match outcome changes
export function propagateKnockoutBrackets(
  bracket: KnockoutBracket
): KnockoutBracket {
  const newBracket = {
    R32: [...bracket.R32],
    R16: [...bracket.R16],
    QF: [...bracket.QF],
    SF: [...bracket.SF],
    "3RD": [...bracket["3RD"]],
    FINAL: [...bracket.FINAL],
  };

  // 1. R32 -> R16
  // Match R16_1: Winner R32_1 vs Winner R32_9
  // Match R16_2: Winner R32_2 vs Winner R32_10
  // Match R16_3: Winner R32_3 vs Winner R32_11
  // Match R16_4: Winner R32_4 vs Winner R32_12
  // Match R16_5: Winner R32_5 vs Winner R32_13
  // Match R16_6: Winner R32_6 vs Winner R32_14
  // Match R16_7: Winner R32_7 vs Winner R32_15
  // Match R16_8: Winner R32_8 vs Winner R32_16
  for (let i = 0; i < 8; i++) {
    const prevMatchLeft = newBracket.R32[i];
    const prevMatchRight = newBracket.R32[i + 8];
    newBracket.R16[i] = {
      ...newBracket.R16[i],
      homeTeam: getKnockoutMatchWinner(prevMatchLeft),
      awayTeam: getKnockoutMatchWinner(prevMatchRight),
    };
  }

  // 2. R16 -> QF
  // Match QF_1: Winner R16_1 vs Winner R16_5
  // Match QF_2: Winner R16_2 vs Winner R16_6
  // Match QF_3: Winner R16_3 vs Winner R16_7
  // Match QF_4: Winner R16_4 vs Winner R16_8
  for (let i = 0; i < 4; i++) {
    const prevMatchLeft = newBracket.R16[i];
    const prevMatchRight = newBracket.R16[i + 4];
    newBracket.QF[i] = {
      ...newBracket.QF[i],
      homeTeam: getKnockoutMatchWinner(prevMatchLeft),
      awayTeam: getKnockoutMatchWinner(prevMatchRight),
    };
  }

  // 3. QF -> SF
  // Match SF_1: Winner QF_1 vs Winner QF_2
  // Match SF_2: Winner QF_3 vs Winner QF_4
  for (let i = 0; i < 2; i++) {
    const prevMatchLeft = newBracket.QF[i * 2];
    const prevMatchRight = newBracket.QF[i * 2 + 1];
    newBracket.SF[i] = {
      ...newBracket.SF[i],
      homeTeam: getKnockoutMatchWinner(prevMatchLeft),
      awayTeam: getKnockoutMatchWinner(prevMatchRight),
    };
  }

  // 4. SF -> 3RD & FINAL
  const sf1 = newBracket.SF[0];
  const sf2 = newBracket.SF[1];

  newBracket["3RD"][0] = {
    ...newBracket["3RD"][0],
    homeTeam: getKnockoutMatchLoser(sf1),
    awayTeam: getKnockoutMatchLoser(sf2),
  };

  newBracket.FINAL[0] = {
    ...newBracket.FINAL[0],
    homeTeam: getKnockoutMatchWinner(sf1),
    awayTeam: getKnockoutMatchWinner(sf2),
  };

  return newBracket;
}
