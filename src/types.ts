/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Team {
  id: string; // Country code (e.g., 'USA')
  name: string; // Chinese name
  flag: string; // Emoji flag
  rank: number; // FIFA Rank reference in 2026
  group: string; // Group letter (A to L)
}

export interface GroupStanding extends Team {
  mp: number; // Matches played
  w: number;  // Wins
  d: number;  // Draws
  l: number;  // Losses
  gf: number; // Goals for
  ga: number; // Goals against
  gd: number; // Goal difference
  pts: number; // Points
}

export interface Match {
  id: string; // Match dynamic ID (e.g., 'A1', 'R32_1', etc.)
  group?: string; // Group letter if group stage, e.g. 'A'
  homeTeam: string; // Team ID
  awayTeam: string; // Team ID
  homeScore: number | null;
  awayScore: number | null;
  homePenScore?: number | null; // Penalty scores
  awayPenScore?: number | null;
  isPredicted: boolean;
  isKnockout: boolean;
  phase: "Group" | "R32" | "R16" | "QF" | "SF" | "3RD" | "FINAL";
  winner?: string; // Advancing team ID (for knockout)
}

export interface KnockoutBracket {
  R32: Match[];
  R16: Match[];
  QF: Match[];
  SF: Match[];
  "3RD": Match[];
  FINAL: Match[];
}

export const INITIAL_TEAMS: Team[] = [
  // Group A
  { id: "MEX", name: "墨西哥", flag: "🇲🇽", rank: 18, group: "A" },
  { id: "RSA", name: "南非", flag: "🇿🇦", rank: 59, group: "A" },
  { id: "KOR", name: "韩国", flag: "🇰🇷", rank: 22, group: "A" },
  { id: "CZE", name: "捷克", flag: "🇨🇿", rank: 30, group: "A" },

  // Group B
  { id: "CAN", name: "加拿大", flag: "🇨🇦", rank: 37, group: "B" },
  { id: "BIH", name: "波黑", flag: "🇧🇦", rank: 50, group: "B" },
  { id: "QAT", name: "卡塔尔", flag: "🇶🇦", rank: 35, group: "B" },
  { id: "SUI", name: "瑞士", flag: "🇨🇭", rank: 16, group: "B" },

  // Group C
  { id: "BRA", name: "巴西", flag: "🇧🇷", rank: 3, group: "C" },
  { id: "MAR", name: "摩洛哥", flag: "🇲🇦", rank: 13, group: "C" },
  { id: "HAI", name: "海地", flag: "🇭🇹", rank: 80, group: "C" },
  { id: "SCO", name: "苏格兰", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", rank: 44, group: "C" },

  // Group D
  { id: "USA", name: "美国", flag: "🇺🇸", rank: 11, group: "D" },
  { id: "PAR", name: "巴拉圭", flag: "🇵🇾", rank: 55, group: "D" },
  { id: "AUS", name: "澳大利亚", flag: "🇦🇺", rank: 23, group: "D" },
  { id: "TUR", name: "土耳其", flag: "🇹🇷", rank: 40, group: "D" },

  // Group E
  { id: "GER", name: "德国", flag: "🇩🇪", rank: 15, group: "E" },
  { id: "CUW", name: "库拉索", flag: "🇨🇼", rank: 85, group: "E" },
  { id: "CIV", name: "科特迪瓦", flag: "🇨🇮", rank: 36, group: "E" },
  { id: "ECU", name: "厄瓜多尔", flag: "🇪🇨", rank: 27, group: "E" },

  // Group F
  { id: "NED", name: "荷兰", flag: "🇳🇱", rank: 7, group: "F" },
  { id: "JPN", name: "日本", flag: "🇯🇵", rank: 17, group: "F" },
  { id: "SWE", name: "瑞典", flag: "🇸🇪", rank: 25, group: "F" },
  { id: "TUN", name: "突尼斯", flag: "🇹🇳", rank: 30, group: "F" },

  // Group G
  { id: "BEL", name: "比利时", flag: "🇧🇪", rank: 5, group: "G" },
  { id: "EGY", name: "埃及", flag: "🇪🇬", rank: 31, group: "G" },
  { id: "IRN", name: "伊朗", flag: "🇮🇷", rank: 20, group: "G" },
  { id: "NZL", name: "新西兰", flag: "🇳🇿", rank: 103, group: "G" },

  // Group H
  { id: "ESP", name: "西班牙", flag: "🇪🇸", rank: 8, group: "H" },
  { id: "CPV", name: "佛得角", flag: "🇨🇻", rank: 65, group: "H" },
  { id: "KSA", name: "沙特阿拉伯", flag: "🇸🇦", rank: 40, group: "H" },
  { id: "URU", name: "乌拉圭", flag: "🇺🇾", rank: 14, group: "H" },

  // Group I
  { id: "FRA", name: "法国", flag: "🇫🇷", rank: 2, group: "I" },
  { id: "SEN", name: "塞内加尔", flag: "🇸🇳", rank: 19, group: "I" },
  { id: "IRQ", name: "伊拉克", flag: "🇮🇶", rank: 41, group: "I" },
  { id: "NOR", name: "挪威", flag: "🇳🇴", rank: 45, group: "I" },

  // Group J
  { id: "ARG", name: "阿根廷", flag: "🇦🇷", rank: 1, group: "J" },
  { id: "ALG", name: "阿尔及利亚", flag: "🇩🇿", rank: 32, group: "J" },
  { id: "AUT", name: "奥地利", flag: "🇦🇹", rank: 25, group: "J" },
  { id: "JOR", name: "约旦", flag: "🇯🇴", rank: 70, group: "J" },

  // Group K
  { id: "POR", name: "葡萄牙", flag: "🇵🇹", rank: 6, group: "K" },
  { id: "COD", name: "刚果（金）", flag: "🇨🇩", rank: 60, group: "K" },
  { id: "UZB", name: "乌兹别克斯坦", flag: "🇺🇿", rank: 39, group: "K" },
  { id: "COL", name: "哥伦比亚", flag: "🇨🇴", rank: 12, group: "K" },

  // Group L
  { id: "ENG", name: "英格兰", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", rank: 4, group: "L" },
  { id: "CRO", name: "克罗地亚", flag: "🇭🇷", rank: 10, group: "L" },
  { id: "GHA", name: "加纳", flag: "🇬🇭", rank: 35, group: "L" },
  { id: "PAN", name: "巴拿马", flag: "🇵🇦", rank: 43, group: "L" },
];
