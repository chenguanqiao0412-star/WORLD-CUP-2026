import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Match, KnockoutBracket, Team, INITIAL_TEAMS } from "../types";
import { calculateGroupStanding } from "../utils/calc";
import { Trophy, Download, X, Calendar, Share2, Sparkles, AlertCircle, CheckCircle2, Printer, Copy } from "lucide-react";

interface PredictionPosterProps {
  isOpen: boolean;
  onClose: () => void;
  groupMatches: Match[];
  knockoutBracket: KnockoutBracket;
  getTeamById: (id: string) => Team;
  getKnockoutMatchWinner: (m: Match) => string;
}

export const PredictionPoster: React.FC<PredictionPosterProps> = ({
  isOpen,
  onClose,
  groupMatches,
  knockoutBracket,
  getTeamById,
  getKnockoutMatchWinner,
}) => {
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [compiledImageUri, setCompiledImageUri] = useState<string | null>(null);
  const isIframe = typeof window !== "undefined" && window.self !== window.top;

  if (!isOpen) return null;

  // 1. Calculate Podium Finishers
  const finalMatch = knockoutBracket.FINAL?.[0];
  let championId = "待定";
  let runnerUpId = "待定";
  if (finalMatch && finalMatch.homeScore !== null && finalMatch.awayScore !== null) {
    championId = getKnockoutMatchWinner(finalMatch);
    runnerUpId = championId === finalMatch.homeTeam ? finalMatch.awayTeam : finalMatch.homeTeam;
  }

  const champion = getTeamById(championId);
  const runnerUp = getTeamById(runnerUpId);

  const thirdMatch = knockoutBracket["3RD"]?.[0];
  let thirdPlaceId = "待定";
  let fourthPlaceId = "待定";
  if (thirdMatch && thirdMatch.homeScore !== null && thirdMatch.awayScore !== null) {
    thirdPlaceId = getKnockoutMatchWinner(thirdMatch);
    fourthPlaceId = thirdPlaceId === thirdMatch.homeTeam ? thirdMatch.awayTeam : thirdMatch.homeTeam;
  }

  const thirdPlace = getTeamById(thirdPlaceId);
  const fourthPlace = getTeamById(fourthPlaceId);

  // 12 Groups A to L
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  // Check if fully predicted (meaning at least the champion is selected, representing completion)
  const isComplete = championId !== "待定";

  const isTeamReal = (id: string) => INITIAL_TEAMS.some((t) => t.id === id);

  const renderMicroMatch = (m: Match, index: number) => {
    const h = getTeamById(m.homeTeam);
    const a = getTeamById(m.awayTeam);
    const played = m.homeScore !== null && m.awayScore !== null;
    const isHomeReal = isTeamReal(m.homeTeam);
    const isAwayReal = isTeamReal(m.awayTeam);
    const winnerId = played ? getKnockoutMatchWinner(m) : null;
    const isHomeWinner = winnerId === m.homeTeam;
    const isAwayWinner = winnerId === m.awayTeam;

    return (
      <div 
        key={m.id} 
        className="flex items-center justify-between py-1 px-2.5 bg-slate-950 border border-slate-900 rounded-xl text-[9px] text-slate-350 hover:border-slate-850/80 transition"
      >
        <span className="text-[7.5px] font-mono font-bold text-slate-600 flex-shrink-0 w-5">
          #{index}
        </span>
        
        <div className="flex-1 flex items-center justify-end gap-1.5 text-right min-w-0 pr-0.5">
          <span className={`truncate text-[8px] max-w-[55px] ${
            !isHomeReal 
              ? "text-slate-600 font-medium" 
              : isHomeWinner 
              ? "text-amber-400 font-black" 
              : "text-slate-200"
          }`} title={h.name}>
            {h.name}
          </span>
          <span className="text-[10px] select-none flex-shrink-0">{h.flag}</span>
        </div>
        
        <div className="flex-shrink-0 px-1 bg-slate-900 rounded font-bold font-mono text-[8.5px] border border-slate-800 text-center min-w-[28px] py-0.2">
          {played ? (
            <span className="text-emerald-450 font-bold">
              {m.homeScore}-{m.awayScore}
            </span>
          ) : (
            <span className="text-slate-550">VS</span>
          )}
        </div>
        
        <div className="flex-1 flex items-center gap-1.5 text-left min-w-0 pl-0.5">
          <span className="text-[10px] select-none flex-shrink-0">{a.flag}</span>
          <span className={`truncate text-[8px] max-w-[55px] ${
            !isAwayReal 
              ? "text-slate-600 font-medium" 
              : isAwayWinner 
              ? "text-amber-400 font-black" 
              : "text-slate-200"
          }`} title={a.name}>
            {a.name}
          </span>
        </div>
      </div>
    );
  };

  const handleDownload = async () => {
    const originalNode = posterRef.current;
    if (!originalNode) return;
    
    setDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      // Direct high-fidelity canvas generation on the live rendered poster
      const canvas = await html2canvas(originalNode, {
        useCORS: true,
        allowTaint: true,
        scale: 1.2, // Clean crisp ratio without overloading sandboxed memory limits
        backgroundColor: "#070e1e",
        logging: false,
      });

      const dataUrl = canvas.toDataURL("image/png");
      setCompiledImageUri(dataUrl);
      
      // Attempt triggering download block
      const link = document.createElement("a");
      const userName = "2026-WorldCup";
      link.download = `${userName}-forecast-poster.png`;
      link.href = dataUrl;
      link.click();

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4500);
    } catch (err: any) {
      console.warn("Direct html2canvas compile failed:", err);
      setDownloadError("海报图片编译被浏览器拦截，这常见于手机微信、iOS 壳浏览器，或小内存沙箱环境。建议您点击下方“打印或保存为 PDF”，或“复制极简文字结果”分享！");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      alert("您的系统暂不支持直接打印，请尝试使用“复制极简文字结果”分享您的预测哦。");
    }
  };

  const handleCopyText = () => {
    try {
      const groupLines = letters.map((letter) => {
        const standings = calculateGroupStanding(letter, INITIAL_TEAMS, groupMatches);
        const first = standings[0] ? `${standings[0].flag} ${standings[0].name}` : "未定";
        const second = standings[1] ? `${standings[1].flag} ${standings[1].name}` : "未定";
        return `⚽ ${letter}组: 1️⃣ ${first} | 2️⃣ ${second}`;
      }).join("\n");

      const text = `🏆 2026 美加墨世界杯全景沙盘预测 🏆
====================================
【 终极王座 & 四强格局 】
🥇 世界冠军: ${champion?.flag || "⏱️"} ${champion?.name || "待定"}
🥈 亚军得主: ${runnerUp?.flag || "⏱️"} ${runnerUp?.name || "待定"}
🥉 季军荣誉: ${thirdPlace?.flag || "⏱️"} ${thirdPlace?.name || "待定"}
🏅 第四名: ${fourthPlace?.flag || "⏱️"} ${fourthPlace?.name || "待定"}

【 12个小组出线局势预测 】
${groupLines}

------------------------------------
💡 以上数据由「2026美加墨世界杯沙盘预测器」自动解算推演生成。快来测测你的专属预测吧！`;

      navigator.clipboard.writeText(text);
      alert("📢 预测文字版结果已成功复制到剪贴板！快去微信、QQ等聊天框粘贴分享吧！");
    } catch (err) {
      console.error("Copy text error:", err);
      alert("复制失败，您的浏览器拒绝了剪贴板写入。请手动选择海报文字进行复制。");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fade-in" id="poster-modal-backdrop">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col md:flex-row overflow-hidden border border-slate-200" id="poster-modal-container">
        
        {/* Left Side: Setup Guidance & Controls */}
        <div className="md:w-80 bg-slate-50 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200" id="poster-left-control-rail">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <Trophy className="w-6 h-6" />
              </span>
              <button 
                onClick={onClose}
                className="p-1 px-2.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer flex items-center gap-1 font-bold"
              >
                <X className="w-3.5 h-3.5" /> 关闭
              </button>
            </div>

            <h3 className="text-lg font-black text-slate-800 leading-snug">
              2026 沙盘专属预测卡
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              这是为您预测生成的精美数字海报。您可以一键保存生成超高清 PNG 图片，便于分享到朋友圈、群聊或博客，记录下您作为金牌主教练的专业预测！
            </p>

            {/* Achievement/Completion badge */}
            <div className="mt-5 p-4 rounded-2xl border bg-white shadow-sm flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">
                沙盘完整度检查
              </span>
              <div className="flex items-center gap-2 mt-1">
                {isComplete ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-black text-slate-700">🎉 已决出终极冠军！</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-amber-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-600">
                      沙盘尚未全部解算
                    </span>
                  </>
                )}
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                {isComplete 
                  ? "太棒了！您的模拟链已经完整解算，冠军预测已归属于国家豪强！点击一键下载，记录您的黄金预测！"
                  : "建议您先通过极速生成，或者手动填满淘汰赛比分。虽然不加满也可以下载海报，但决出冠军的海报最具观赏与交流属性哦！"}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3" id="poster-controls-bottom">
            {downloadSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>海报成功保存！请检查浏览器的下载目录中。</span>
              </div>
            )}

            {downloadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                {downloadError}
              </div>
            )}

            {isIframe && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left space-y-2.5 animate-pulse">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-extrabold text-xs">⚠️ 检测到浏览器沙箱环境</span>
                </div>
                <p className="text-[10px] text-slate-650 leading-relaxed">
                  您当前处于 AI Studio 安全沙箱预览框（iFrame）中，浏览器处于安全考虑会<strong>主动静默拦截</strong>『生成海报图片』和『保存/打印 PDF』功能。
                </p>
                <p className="text-[10px] font-semibold text-amber-600 leading-relaxed">
                  💡 极速解决方案：打开新标签页即可100%成功输出！您的预测历史已安全保存在本地。
                </p>
                <a
                  href={typeof window !== "undefined" ? window.location.href : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md text-center cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  在新标签页中打开并打印
                </a>
              </div>
            )}

            {/* Print Friendly CSS injected dynamically inside modal */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                /* Force dark rich colors for pristine display printing matching the UI vibe */
                html, body {
                  background-color: #070e1e !important;
                  color: #ffffff !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                /* Hide everything in the page universally */
                body * {
                  visibility: hidden !important;
                }
                /* Reveal ONLY the captured poster and its micro elements */
                #poster-capture-wrapper, #poster-capture-wrapper * {
                  visibility: visible !important;
                }
                /* Perfectly center the visible poster in the center of the viewport */
                #poster-capture-wrapper {
                  position: absolute !important;
                  left: 50% !important;
                  top: 0 !important;
                  transform: translateX(-50%) !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  border-radius: 0 !important;
                  width: 760px !important;
                  max-width: 100% !important;
                }
                #worldcup-poster-capture {
                  border: none !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                  background-image: linear-gradient(135deg, #070e1e 0%, #0b152d 50%, #061024 100%) !important;
                }
                #mobile-save-overlay {
                  display: none !important;
                }
              }
            ` }} />

            <button
              id="btn-poster-download"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
              title="使用网页 Canvas 机制进行渲染保存"
            >
              {downloading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  正在渲染图片...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  保存手机/电脑高清 JPG图片
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="w-full py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="使用手机/电脑系统高保真打印预览 (可另存为超高清 PDF)"
            >
              <Printer className="w-3.5 h-3.5" />
              电脑/手机系统打印 (保存高保真PDF)
            </button>

            <button
              onClick={handleCopyText}
              className="w-full py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              title="复制结构化文本总结"
            >
              <Copy className="w-3.5 h-3.5" />
              复制极简文字结果记录
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 px-3 border border-slate-200 hover:bg-slate-100 text-slate-550 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition"
            >
              返回修改沙盘
            </button>
          </div>
        </div>

        {/* Right Side: Virtual Poster Rendering Container (Viewport with scroll wrapper) */}
        <div className="flex-1 bg-slate-900 p-4 md:p-6 flex justify-center items-start overflow-y-auto max-h-[92vh] scroll-slim">
          {/* Scrollable Container on Mobile, captures as standard 760px size */}
          <div className="min-w-[760px] max-w-[760px] my-auto scale-90 sm:scale-100 origin-top shadow-2xl rounded-2xl overflow-hidden relative" id="poster-capture-wrapper">
            
            {/* Mobile Long Press Capture Overlay */}
            {compiledImageUri && (
              <div className="absolute inset-0 bg-slate-950/98 z-30 flex flex-col items-center justify-start p-6 overflow-y-auto" id="mobile-save-overlay">
                <div className="max-w-md w-full bg-slate-900/95 backdrop-blur border border-emerald-500/30 rounded-2xl p-5 text-center mb-6 shadow-2xl animate-fade-in">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <h4 className="text-sm font-black text-white">🎉 高清预测海报已生成完毕！</h4>
                  <p className="text-xs text-emerald-400 font-bold mt-1.5 leading-relaxed">
                    手机用户、微信内置浏览器或 iOS 客户端：
                  </p>
                  <p className="text-xs text-amber-300 font-black mt-1 animate-pulse">
                    👇 请在下方大图上【长按 2-3 秒】选择【保存到相册】👇
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    由于部分移动浏览器存在安全沙箱限制，长按存图是移动端最稳定的保存方式。
                  </p>
                  <div className="flex gap-2 justify-center mt-3.5">
                    <button
                      onClick={() => setCompiledImageUri(null)}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      修改预测
                    </button>
                    <a
                      href={compiledImageUri}
                      download="2026-worldcup-sandbox.png"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 text-center"
                    >
                      点击强制下载
                    </a>
                  </div>
                </div>
                
                <div className="relative border-4 border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl bg-slate-950 max-w-full">
                  <div className="absolute top-2 right-2 bg-black/75 backdrop-blur text-white text-[8px] font-bold px-2 py-0.5 rounded-full z-10 pointer-events-none select-none">
                    💡 长按下方图片自由保存
                  </div>
                  <img 
                    src={compiledImageUri} 
                    alt="2026 World Cup Prediction Poster" 
                    className="w-[710px] h-auto block select-all cursor-pointer"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}

            {/* --- ACTUAL CAPTURED DIV --- */}
            <div
              ref={posterRef}
              id="worldcup-poster-capture"
              className="w-[760px] bg-slate-950 text-slate-100 p-8 font-sans relative flex flex-col gap-6 selection:bg-none"
              style={{
                backgroundImage: "linear-gradient(135deg, #070e1e 0%, #0b152d 50%, #061024 100%)",
                boxShadow: "inset 0 0 100px rgba(16, 185, 129, 0.08)",
                border: "4px solid #1e293b"
              }}
            >
              {/* Subtle background world cup ring glow - engineered with pure canvas-safe radial gradients */}
              <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] pointer-events-none rounded-full" style={{ background: "radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 65%)" }} />
              <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none rounded-full" style={{ background: "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 65%)" }} />

              {/* Poster Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-5 relative z-10">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 animate-pulse" />
                  </span>
                  <div>
                    <span className="text-[10px] tracking-wider font-extrabold uppercase text-emerald-400 block">
                      2026 UNITED WORLD CUP · SANDBOX FORECAST
                    </span>
                    <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                      2026 美加墨世界杯全景沙盘预测 
                      <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-full font-mono font-medium">大师预测版</span>
                    </h2>
                  </div>
                </div>
                
                <div className="text-right flex flex-col justify-center">
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 tracking-wider font-mono justify-end">
                    <Calendar className="w-3 h-3" />
                    <span>UTC {new Date().toISOString().split('T')[0]}</span>
                  </div>
                  <span className="text-[8px] text-slate-500 tracking-widest font-bold uppercase mt-1">
                    CRAFTED BY AI STUDIO
                  </span>
                </div>
              </div>

              {/* Champion Card Section (Hero Banner) */}
              <div className="relative z-10" id="poster-champion-spotlight">
                <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-3xl p-6 shadow-lg flex flex-col items-center justify-center text-center relative overflow-hidden">
                  {/* Glowing background decor */}
                  <div className="absolute -inset-0.5 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(245, 158, 11, 0.05) 0%, transparent 80%)" }} />
                  
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full flex items-center justify-center text-2xl shadow mb-2 animate-bounce">
                    🏆
                  </div>

                  {championId !== "待定" ? (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-5xl mt-1 select-none">{champion.flag}</span>
                      <h3 className="text-2xl font-black text-amber-500 tracking-tight mt-1 flex items-center gap-2">
                        {champion.name}
                      </h3>
                      <p className="text-[10px] text-amber-300 font-mono tracking-widest font-black uppercase">
                        ⭐ 预 测 总 冠 军 ⭐
                      </p>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5 bg-slate-800/60 px-2 py-0.5 border border-slate-700/55 rounded-full">
                        FIFA 战力排名: #{champion.rank} | 冠军之路实至名归
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 py-1">
                      <div className="text-slate-500 text-3xl select-none">⏱️</div>
                      <h3 className="text-xl font-bold text-slate-400 mt-1">诸神并立 · 静待王者诞生</h3>
                      <p className="text-[10px] text-slate-400 max-w-[360px] leading-relaxed mx-auto">
                        在沙盘中填满淘汰赛节点，决出终极金盃归属。当历史重演或奇迹降临，此处将铭刻您的夺冠畅想！
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-Podium Finisher Grid */}
              <div className="grid grid-cols-3 gap-4 relative z-10" id="poster-podium-row">
                {/* 2nd Place */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-3 flex flex-col items-center text-center">
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest block mb-1">
                    🥈 亚军预测 (2nd)
                  </span>
                  <div className="text-2xl my-1">{runnerUpId !== "待定" ? runnerUp.flag : "⏱️"}</div>
                  <strong className="text-xs font-extrabold text-slate-200 mt-0.5 truncate max-w-full">
                    {runnerUpId !== "待定" ? runnerUp.name : "待决队伍"}
                  </strong>
                </div>

                {/* 3rd Place */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-3 flex flex-col items-center text-center">
                  <span className="text-[9px] text-amber-600/90 uppercase font-black tracking-widest block mb-1">
                    🥉 季军预测 (3rd)
                  </span>
                  <div className="text-2xl my-1">{thirdPlaceId !== "待定" ? thirdPlace.flag : "⏱️"}</div>
                  <strong className="text-xs font-extrabold text-slate-200 mt-0.5 truncate max-w-full">
                    {thirdPlaceId !== "待定" ? thirdPlace.name : "待决队伍"}
                  </strong>
                </div>

                {/* 4th Place */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-3 flex flex-col items-center text-center">
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest block mb-1">
                    🎖️ 殿军预测 (4th)
                  </span>
                  <div className="text-2xl my-1">{fourthPlaceId !== "待定" ? fourthPlace.flag : "⏱️"}</div>
                  <strong className="text-xs font-extrabold text-slate-200 mt-0.5 truncate max-w-full">
                    {fourthPlaceId !== "待定" ? fourthPlace.name : "待决队伍"}
                  </strong>
                </div>
              </div>

              {/* Group Standings (Dense Bento Grid Layout of 12 Groups) */}
              <div className="relative z-10" id="poster-groups-grid-wrapper">
                <div className="text-[10px] text-emerald-400 tracking-widest font-black uppercase mb-2.5 border-l-2 border-emerald-500 pl-2">
                  12 个小组完整积分榜与交战赛果 (Group Stage Standings & Match Results)
                </div>
                
                <div className="grid grid-cols-2 gap-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/80">
                  {letters.map((groupLetter) => {
                    const standings = calculateGroupStanding(groupLetter, INITIAL_TEAMS, groupMatches);
                    const groupMatchesList = groupMatches.filter((m) => m.group === groupLetter);

                    return (
                      <div 
                        key={groupLetter} 
                        className="bg-slate-950/85 border border-slate-800/70 p-3 rounded-2xl flex flex-col gap-2.5"
                      >
                        {/* Title Row */}
                        <div className="text-[10px] font-black tracking-wider text-slate-350 border-b border-slate-800/60 pb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="w-1 h-2.5 bg-emerald-500 rounded-sm"></span>
                            {groupLetter} 组 (Group {groupLetter})
                          </span>
                          <span className="text-[8px] text-slate-500 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800/60 font-black">
                            积分排名 (1-4)
                          </span>
                        </div>

                        {/* Standings Table */}
                        <div className="overflow-x-auto select-none">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="text-[8px] text-slate-500 font-extrabold uppercase border-b border-slate-900 pb-1">
                                <th className="py-0.5 pl-1 text-center w-5">#</th>
                                <th className="py-0.5">球队</th>
                                <th className="py-0.5 text-center w-5">场</th>
                                <th className="py-0.5 text-center w-5">胜</th>
                                <th className="py-0.5 text-center w-5">平</th>
                                <th className="py-0.5 text-center w-5">负</th>
                                <th className="py-0.5 text-center w-9">得/失</th>
                                <th className="py-0.5 text-center w-5">净</th>
                                <th className="py-0.5 pr-1 text-center font-bold text-slate-400 w-5">分</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/40 text-[9px]">
                              {standings.map((team, idx) => {
                                const isQualifying = idx < 2;
                                return (
                                  <tr 
                                    key={team.id} 
                                    className={`hover:bg-slate-900/10 transition-colors ${
                                      isQualifying ? "text-slate-100" : "text-slate-400"
                                    }`}
                                  >
                                    <td className="py-0.5 pl-1 text-center font-mono font-bold">
                                      <span className={`inline-block w-3.5 h-3.5 rounded-full text-[8px] leading-3.5 text-center font-sans ${
                                        idx === 0 
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20" 
                                          : idx === 1 
                                          ? "bg-amber-950 text-amber-400 border border-amber-500/10"
                                          : "bg-slate-900 text-slate-500"
                                      }`}>
                                        {idx + 1}
                                      </span>
                                    </td>
                                    <td className="py-0.5 font-semibold flex items-center gap-1 pr-1">
                                      <span className="text-xs flex-shrink-0 select-none">{team.flag}</span>
                                      <span className="truncate max-w-[65px]" title={team.name}>{team.name}</span>
                                    </td>
                                    <td className="py-0.5 text-center font-mono text-slate-450">{team.mp}</td>
                                    <td className="py-0.5 text-center font-mono text-slate-450">{team.w}</td>
                                    <td className="py-0.5 text-center font-mono text-slate-450">{team.d}</td>
                                    <td className="py-0.5 text-center font-mono text-slate-450">{team.l}</td>
                                    <td className="py-0.5 text-center font-mono text-slate-500 text-[8px]">
                                      {team.gf}/{team.ga}
                                    </td>
                                    <td className={`py-0.5 text-center font-mono ${
                                      team.gd > 0 ? "text-emerald-400/80" : team.gd < 0 ? "text-red-400/80" : "text-slate-500"
                                    }`}>
                                      {team.gd > 0 ? `+${team.gd}` : team.gd}
                                    </td>
                                    <td className={`py-0.5 pr-1 text-center font-mono font-black ${
                                      isQualifying ? "text-emerald-400" : "text-slate-400"
                                    }`}>
                                      {team.pts}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Match Fixtures Header */}
                        <div className="flex items-center justify-between border-t border-slate-900/60 pt-1.5 text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                          <span>小组赛交战比分</span>
                          <span>ROUND ROBIN ({groupMatchesList.length}场)</span>
                        </div>

                        {/* 6 Matches Grid */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] bg-slate-950 p-1.5 rounded-lg border border-slate-900 pb-2">
                          {groupMatchesList.map((m, mIdx) => {
                            const home = getTeamById(m.homeTeam);
                            const away = getTeamById(m.awayTeam);
                            const isPredicted = m.homeScore !== null && m.awayScore !== null;
                            
                            return (
                              <div 
                                key={m.id} 
                                className="flex items-center justify-between gap-1 border-b border-slate-900/45 pb-0.5 last:border-b-0"
                              >
                                <span className="text-[7px] font-mono font-bold text-slate-600 flex-shrink-0" title={`第${mIdx + 1}场`}>
                                  #{mIdx + 1}
                                </span>
                                
                                <div className="flex-1 flex items-center justify-end gap-0.5 text-right min-w-0 pr-0.5">
                                  <span className="truncate text-slate-350 font-medium text-[8px]" title={home.name}>
                                    {home.name}
                                  </span>
                                  <span className="text-[10px] select-none flex-shrink-0">{home.flag}</span>
                                </div>
                                
                                <div className="flex-shrink-0 px-0.5 bg-slate-900 rounded font-bold font-mono text-[8px] border border-slate-800 text-center min-w-[24px] py-0.2">
                                  {isPredicted ? (
                                    <span className="text-emerald-450 font-bold">
                                      {m.homeScore}-{m.awayScore}
                                    </span>
                                  ) : (
                                    <span className="text-slate-550">VS</span>
                                  )}
                                </div>
                                
                                <div className="flex-1 flex items-center gap-0.5 text-left min-w-0 pl-0.5">
                                  <span className="text-[10px] select-none flex-shrink-0">{away.flag}</span>
                                  <span className="truncate text-slate-350 font-medium text-[8px]" title={away.name}>
                                    {away.name}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* --- Full Knockout Stages Detailed Results --- */}
              <div className="relative z-10" id="poster-knockout-detailed-wrapper">
                <div className="text-[10px] text-indigo-400 tracking-widest font-black uppercase mb-2.5 border-l-2 border-indigo-500 pl-2">
                  淘汰赛各轮次晋级赛果预测 (Detailed Knockout Results)
                </div>
                
                <div className="flex flex-col gap-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/80">
                  {/* R32 Row */}
                  <div>
                    <div className="text-[9px] text-indigo-350 font-extrabold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span className="w-1 h-2 bg-indigo-500 rounded-sm"></span>
                        1/16 决赛 / 32强赛 (Round of 32)
                      </span>
                      <span className="text-[8px] text-slate-500 font-mono">1-16 场</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {knockoutBracket.R32.map((m, mIdx) => renderMicroMatch(m, mIdx + 1))}
                    </div>
                  </div>

                  {/* R16 Row */}
                  <div className="border-t border-slate-900/50 pt-3">
                    <div className="text-[9px] text-indigo-350 font-extrabold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span className="w-1 h-2 bg-indigo-500 rounded-sm"></span>
                        1/8 决赛 / 16强赛 (Round of 16)
                      </span>
                      <span className="text-[8px] text-slate-500 font-mono">17-24 场</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {knockoutBracket.R16.map((m, mIdx) => renderMicroMatch(m, mIdx + 17))}
                    </div>
                  </div>

                  {/* QF Row */}
                  <div className="border-t border-slate-900/50 pt-3">
                    <div className="text-[9px] text-indigo-350 font-extrabold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span className="w-1 h-2 bg-indigo-500 rounded-sm"></span>
                        1/4 决赛 / 八强赛 (Quarter-Finals)
                      </span>
                      <span className="text-[8px] text-slate-500 font-mono">25-28 场</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {knockoutBracket.QF.map((m, mIdx) => renderMicroMatch(m, mIdx + 25))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Crucial Knockout Milestones summary */}
              <div className="grid grid-cols-2 gap-4 relative z-10" id="poster-knockout-milestones">
                {/* Semifinals matches */}
                <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-2">
                  <div className="text-[9px] text-slate-400 tracking-widest font-black uppercase flex items-center justify-between mb-1">
                    <span>👑 半决赛巅峰对决 (Semi-Finals)</span>
                    <span className="text-[8px] bg-slate-800 font-mono px-1.5 rounded text-slate-400">里程碑</span>
                  </div>
                  
                  <div className="flex flex-col gap-2 text-xs">
                    {knockoutBracket.SF.map((m: Match, index: number) => {
                      const h = getTeamById(m.homeTeam);
                      const a = getTeamById(m.awayTeam);
                      const homeUndecided = m.homeTeam.includes("待定") || m.homeTeam === "待定";
                      const awayUndecided = m.awayTeam.includes("待定") || m.awayTeam === "待定";
                      const played = m.homeScore !== null && m.awayScore !== null;
                      return (
                        <div key={m.id} className="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                          <span className="text-[9px] text-slate-500 font-semibold font-mono">SF_{index + 1}</span>
                          <div className="flex items-center gap-1 max-w-[170px] truncate">
                            <span className="text-slate-200 font-medium truncate">{homeUndecided ? "待定" : h.name}</span>
                            <span className="text-slate-400 font-semibold">{played ? `${m.homeScore}` : "-"}</span>
                            <span className="text-[9px] text-slate-500 font-mono uppercase bg-slate-900 px-1 py-0.2 rounded">VS</span>
                            <span className="text-slate-400 font-semibold">{played ? `${m.awayScore}` : "-"}</span>
                            <span className="text-slate-200 font-medium truncate">{awayUndecided ? "待定" : a.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Golden Finals match */}
                <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-2">
                  <div className="text-[9px] text-amber-500 tracking-widest font-black uppercase flex items-center justify-between mb-1">
                    <span>🥇 金仙之巅终章 (Grand Final)</span>
                    <span className="text-[8px] bg-amber-500/10 text-amber-400 font-mono px-1.5 rounded">决冠战</span>
                  </div>

                  {finalMatch ? (
                    <div className="flex flex-col justify-center h-full gap-2">
                      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-900 flex items-center justify-between">
                        {/* Home Finalist */}
                        <div className="flex items-center gap-1 px-1 min-w-[70px]">
                          <span>{getTeamById(finalMatch.homeTeam).flag}</span>
                          <span className="text-xs font-bold text-slate-100 truncate max-w-[80px]">
                            {getTeamById(finalMatch.homeTeam).name}
                          </span>
                        </div>

                        {/* Scores */}
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-black text-amber-400 font-mono tracking-tighter">
                            {finalMatch.homeScore !== null && finalMatch.awayScore !== null
                              ? `${finalMatch.homeScore} - ${finalMatch.awayScore}`
                              : "VS"}
                          </span>
                          {finalMatch.homeScore === finalMatch.awayScore && finalMatch.homeScore !== null && (
                            <span className="text-[8px] text-amber-300 font-bold bg-amber-950 px-1.5 py-0.2 rounded-full mt-0.5">
                              点点 {finalMatch.homePenScore} - {finalMatch.awayPenScore}
                            </span>
                          )}
                        </div>

                        {/* Away Finalist */}
                        <div className="flex items-center gap-1 px-1 justify-end min-w-[70px] text-right">
                          <span className="text-xs font-bold text-slate-100 truncate max-w-[80px]">
                            {getTeamById(finalMatch.awayTeam).name}
                          </span>
                          <span>{getTeamById(finalMatch.awayTeam).flag}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-[11px] text-slate-500 py-4 h-full flex items-center justify-center">
                      等待决赛宿敌晋级
                    </div>
                  )}
                </div>
              </div>

              {/* Poster Footer Credentials */}
              <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between text-[10px] text-slate-500 mt-2 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  <span className="font-mono tracking-tight">
                    PRODUCED BY 2026 WORLD CUP PREDICTOR & GEMINI INTEL
                  </span>
                </div>
                
                <div className="font-medium">
                  一沙一球 · 畅想无疆
                </div>
              </div>

            </div>
            {/* --- END OF CAPTURED DIV --- */}

          </div>
        </div>

      </div>
    </div>
  );
};
