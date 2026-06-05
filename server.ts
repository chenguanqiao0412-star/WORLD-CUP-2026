import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "5mb" }));

  // API: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API: Match Analyze
  app.post("/api/analyze-match", async (req, res) => {
    try {
      const { homeTeam, awayTeam, homeRank, awayRank, context } = req.body;

      if (!homeTeam || !awayTeam) {
        return res.status(400).json({ error: "homeTeam and awayTeam are required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          analysis: `### ⚠️ AI 接口未配置 API 密钥
由于当前系统未检测到 \`GEMINI_API_KEY\`，这里为您提供一份**静态预置战史对比**分析：

- **历史交锋**: **${homeTeam}** 与 **${awayTeam}** 在各大赛事中有过多次经典对阵。
- **世界排名**: [${homeTeam}] 世界排名第 \`${homeRank || "未提供"}\` 位，而 [${awayTeam}] 世界排名第 \`${awayRank || "未提供"}\` 位。
- **战术特点**: ${homeTeam} 擅长的整体战术与 ${awayTeam} 的攻防节奏将产生剧烈摩擦。
- **2026前景**: ${context || "这场对决必将成为 2026美加墨世界杯的焦点战。建议在上方设置中添加真实的 API Key 以获得更深度的 AI 战术分析与实地沙盘推演！"}`,
        });
      }

      const prompt = `您是一位世界顶级的专业足球战术分析大师、著名足球评论员（风格严谨而富含激情，类似詹俊和张路）。
请针对 2026 年美加墨世界杯这场瞩目对决进行极其详尽、深刻的专业级数据分析与历史对比报告：

[对决双方]：
- 主队/队A：${homeTeam} (国际足联参考排名: ${homeRank || "20开外"}) 
- 客队/队B：${awayTeam} (国际足联参考排名: ${awayRank || "20开外"})
- 比赛附加背景：${context || "2026世界杯核心晋级预测"}

请撰写一份包含以下模块的内容，请使用 Markdown 语法进行美观排版：

1. 🏆 **两队纸面实力与核心战术分析**：分析两队的阵型（如4-3-3或3-5-2）、攻防核心球员、战术长处（如高位逼抢、稳守反击、传控压迫）与致命短板。
2. ⚔️ **历史对战战绩与恩怨纠葛**：根据真实历史（或高度合理的国际大赛交锋记录），梳理双方在世界杯、洲际杯上的历史对赛胜平负和经典名场面。
3. 🔬 **2026世界杯碰撞看点 & 关键变数**：分析主教练的智谋对决、天气与赛程体能影响、定位球攻防和个别位置的对位爆点。
4. 🎲 **精准比分沙盘推演**：给出一个最可能发生的预测比分及详细的比赛剧情走势描述（如：上半场谁先拔头筹，下半场谁调整战术扳平，或者最后的读秒绝杀）。

请确保全中文回复，语气专业，用词地道（如“单刀”、“越位”、“阵线收缩”、“高位压迫”），格式排版工整，段落清晰，突出关键球员名字。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ analysis: response.text });
    } catch (error: any) {
      console.error("AI Analyze Error:", error);
      res.status(500).json({ error: "AI 分析服务暂时不可用，请稍后再试", details: error.message });
    }
  });

  // API: General Prediction Brackets Report Generator
  app.post("/api/generate-report", async (req, res) => {
    try {
      const { brackets } = req.body;

      if (!brackets) {
        return res.status(400).json({ error: "Brackets data is required" });
      }

      const { groupStageOutcomes, runnerUps, finalStandings, champion, darkHorses } = brackets;

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          report: `### 📊 2026 美加墨世界杯预测总结报告 (本地预置模式)

亲爱的球迷，您已经成功完成了全部阶段的比赛结果预测！以下是基于您选择做出的宏观分析。

#### 🌟 您的冠军归属
在您的推演中，**【${champion || "未知球队"}】** 一路披荆斩棘，最终捧起了至高无上的大力神杯！

#### 📈 小组赛晋级形势
您推演的各大热门队伍均悉数晋级。在 48 支球队的宏大规模中，前两名与成绩最好的八个小组第三名出线，竞争十分惨烈。您设想的黑马也成功打入淘汰赛。

#### 📢 友情提示
如果您配置了 \`GEMINI_API_KEY\` 环境变量，AI 将会针对您预测的淘汰赛全树状支架、冷门跌宕、总进球趋势进行深度盘点，并为您量身定制一份万字战术预测白皮书！`,
        });
      }

      const bracketSummary = JSON.stringify(brackets);
      const prompt = `您是一位拥有 30 年英超与世界杯评述经验的资深足球主编。
用户在我们的“2026 美加墨世界杯预测器”中完成了解析预测，这是他们自定义推演的所有晋级及冠军结果：

[预测数据概要]：
${bracketSummary}

请基于这些推演结果，制作一份极具文学色彩、逻辑深刻、让人热血沸腾的 **《2026美加墨世界杯·预测全景沙盘与战术战况白皮书》**。

请包含以下核心板块（使用精致的 Markdown 排版，善用重点标粗、Emoji 与引用框）：

1. 👑 **加冕时刻：新王诞生或老帝卫冕**：
   - 针对预测的冠军【${champion || "未知"}】进行重点论述。如果是传统豪门，分析其如何实现复兴或卫冕；如果是新晋力量，阐述其如何书写历史神话。
2. 🌪️ **冷门雷达与最大黑马评述**：
   - 指出用户预测中的哪些淘汰赛晋级（或小组赛冷门）最让人吃惊（例如豪门折戟、或者二线强队打入四强）。如果没有明显的冷门，请推演一个极具戏剧性的冷门交锋。
3. 🛡️ **黄金战术风向标分析**：
   - 纵观晋级八强和四强的队伍特点，归纳 2026 世界杯的主流战术思想（如“三中卫体系的复兴”、“极致快节奏的攻防转换”等）。
4. 🎖️ **个人奖项狂想曲（金靴、金球、最佳新人）**：
   - 根据您的专业视角，为这位预测的冠军及表现优异的队伍预测本届世界杯的金球奖（MVP）、金靴奖（最佳射手，可写出核心前锋）和金手套奖（最佳门将）。

请使用极富足球情怀与专业深度的文字回复。行文流畅，慷慨激昂，字数在 800 - 1500 字，完全使用中文。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ report: response.text });
    } catch (error: any) {
      console.error("AI Report Generator Error:", error);
      res.status(500).json({ error: "AI 报告生成失败，请稍后重试", details: error.message });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to 0.0.0.0 and PORT 3000 as required
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running successfully on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start fullstack server:", err);
});
