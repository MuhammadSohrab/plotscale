import "./sketchTutorial.css";

import { useState, useEffect } from "react";
import {
  PlayCircle,
  PauseCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Lightbulb,
  Sparkles,
  PencilRuler,
  CheckCircle2,
  GitCommit,
  Triangle,
  Move,
  FileSpreadsheet,
  Download,
  FileCode2,
  FileImage,
  Save,
  Check,
} from "lucide-react";

export interface TutorialScene {
  id: number;
  stageTitleHi: string;
  stageTitleEn: string;
  descHi: string;
  descEn: string;
  tipHi: string;
  tipEn: string;
}

const TUTORIAL_SCENES: TutorialScene[] = [
  {
    id: 1,
    stageTitleHi: "1. 6 कोनों (P1 to P6) का खेत बनाएं व P1 पर टैप कर बंद करें",
    stageTitleEn: "1. Draw 6 Plot Corners (P1 to P6) & Close on P1 Ring",
    descHi: "स्क्रीन पर 6 कोने (P1 से P6) लगाएं। अंतिम कोना लगाने के बाद पहले हरे कोने (P1) पर टैप करके बंद बाउंड्री लॉक करें।",
    descEn: "Tap on the canvas to place 6 cadastral vertices (P1 to P6). Tap the pulsing green circle on P1 to lock and close the polygon boundary.",
    tipHi: "कैनवास पर आप 3 कोनों से लेकर 10+ कोनों का कैसा भी खेत बना सकते हैं।",
    tipEn: "You can draw land plots of any shape from 3 to 10+ corners.",
  },
  {
    id: 2,
    stageTitleHi: "2. पहली भुजा (24 ft) नापें → बाकी सभी भुजाएं स्वतः अनुमानित होंगी",
    stageTitleEn: "2. Set Base Line (24 ft) → All Other Sides Auto-Estimate",
    descHi: "पहली भुजा (P1-P2) पर 24 ft दर्ज करते ही स्केल कैलिब्रेट हो जाएगा और बाकी भुजाओं की अनुमानित नाप (Estimated) तुरंत दिखने लगेगी।",
    descEn: "Setting the base line (24 ft on P1-P2) immediately calibrates the map scale, generating real-time estimated dimensions on all other sides.",
    tipHi: "स्केल सेट होने के बाद क्रमशः सभी भुजाएं (35 ft, 18 ft, 26 ft, 43 ft, 56 ft) लॉक करें।",
    tipEn: "After base calibration, enter the actual field measurements for all remaining boundary sides.",
  },
  {
    id: 3,
    stageTitleHi: "3. Base V3 से 3 विकर्ण (40ft, 33ft, 35.5ft) जोड़ें → 4 त्रिभुज (T1 to T4)",
    stageTitleEn: "3. Connect 3 Diagonals from Pivot V3 → 4 Exact Triangles (T1 to T4)",
    descHi: "'Diagonals' मोड में V3 को Pivot बनाकर V1 (40ft), V6 (33ft) व V5 (35.5ft) जोड़ें। प्लॉट 4 त्रिभुजों में बंटकर 100% सही रकबा (1,864.47 sq.ft) लॉक कर देगा।",
    descEn: "In Diagonals mode, select V3 as Pivot and link to V1 (40 ft), V6 (33 ft), and V5 (35.5 ft). The plot divides into 4 Heron's triangles, locking the true area at 1,864.47 sq.ft.",
    tipHi: "पटवारी नियम: 6-भुजा वाले प्लॉट में 3 विकर्ण नापने से क्षेत्रफल 100% सही निकलता है।",
    tipEn: "Survey Law: A 6-sided polygon requires exactly 3 diagonals to establish true geometric triangulation.",
  },
  {
    id: 4,
    stageTitleHi: "4. सरकारी 3-पेज PDF नक़्शा रिपोर्ट व AutoCAD DXF एक्सपोर्ट",
    stageTitleEn: "4. Official 3-Page Survey PDF Report & AutoCAD DXF Export",
    descHi: "'Export' पर क्लिक करके PDF Plot Sheet चुनें। 3 पेजों की विस्तृत सरकारी रिपोर्ट (त्रिभुज तालिका, हाई-रेज़ नक़्शा व नाप-जोख विवरण) डाउनलोड होगी।",
    descEn: "Click 'Export' and select 'PDF Plot Sheet'. A comprehensive 3-page official survey report is instantly generated with triangles table, high-res drawing, and measurements.",
    tipHi: "PDF रिपोर्ट में सरकारी मानक के अनुसार P1-P6 लेबल, क्रॉसहेयर और विकर्ण तालिका शामिल होती है।",
    tipEn: "The report includes verified title blocks, precise vertex coordinates, and diagonal breakdown tables.",
  },
];

interface SketchTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSamplePlot?: () => void;
}

export function SketchTutorialModal({ isOpen, onClose, onLoadSamplePlot }: SketchTutorialModalProps) {
  const [lang, setLang] = useState<"hi" | "en">("hi");
  const [activeScene, setActiveScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setFrame(0);
  }, [isOpen, activeScene]);

  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const timer = setInterval(() => {
      setFrame((prev) => {
        if (prev >= 100) {
          setActiveScene((curr) => (curr + 1) % TUTORIAL_SCENES.length);
          return 0;
        }
        return prev + 1.2;
      });
    }, 70);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, activeScene]);

  if (!isOpen) return null;

  const currentSceneData = TUTORIAL_SCENES[activeScene];

  // Exact 6 Vertices from User's Video Screen Recording
  const p1 = { x: 170, y: 55 };
  const p2 = { x: 360, y: 45 };
  const p3 = { x: 375, y: 155 };
  const p4 = { x: 495, y: 175 };
  const p5 = { x: 465, y: 245 };
  const p6 = { x: 180, y: 240 };

  // Virtual Finger pointer calculations
  let fingerPos = { x: p1.x, y: p1.y, opacity: 0, tapping: false };
  let nodeCount = 0;
  let isClosed = false;

  if (activeScene === 0) {
    if (frame < 16) {
      fingerPos = { x: 100 + (p1.x - 100) * (frame / 16), y: 100 + (p1.y - 100) * (frame / 16), opacity: 1, tapping: frame > 12 };
      nodeCount = frame >= 14 ? 1 : 0;
    } else if (frame < 32) {
      fingerPos = { x: p1.x + (p2.x - p1.x) * ((frame - 16) / 16), y: p1.y + (p2.y - p1.y) * ((frame - 16) / 16), opacity: 1, tapping: frame > 28 };
      nodeCount = frame >= 30 ? 2 : 1;
    } else if (frame < 48) {
      fingerPos = { x: p2.x + (p3.x - p2.x) * ((frame - 32) / 16), y: p2.y + (p3.y - p2.y) * ((frame - 32) / 16), opacity: 1, tapping: frame > 44 };
      nodeCount = frame >= 46 ? 3 : 2;
    } else if (frame < 64) {
      fingerPos = { x: p3.x + (p4.x - p3.x) * ((frame - 48) / 16), y: p3.y + (p4.y - p3.y) * ((frame - 48) / 16), opacity: 1, tapping: frame > 60 };
      nodeCount = frame >= 62 ? 4 : 3;
    } else if (frame < 80) {
      fingerPos = { x: p4.x + (p5.x - p4.x) * ((frame - 64) / 16), y: p4.y + (p5.y - p4.y) * ((frame - 64) / 16), opacity: 1, tapping: frame > 76 };
      nodeCount = frame >= 78 ? 5 : 4;
    } else if (frame < 92) {
      fingerPos = { x: p5.x + (p6.x - p5.x) * ((frame - 80) / 12), y: p5.y + (p6.y - p5.y) * ((frame - 80) / 12), opacity: 1, tapping: frame > 88 };
      nodeCount = 6;
    } else {
      fingerPos = { x: p6.x + (p1.x - p6.x) * ((frame - 92) / 8), y: p6.y + (p1.y - p6.y) * ((frame - 92) / 8), opacity: 1, tapping: frame > 96 };
      nodeCount = 6;
      isClosed = frame >= 96;
    }
  } else {
    nodeCount = 6;
    isClosed = true;
  }

  return (
    <div className="sketch-tutorial-backdrop" onClick={onClose}>
      <div className="sketch-tutorial-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="sketch-tutorial-header">
          <div className="sketch-tutorial-title-group">
            <span className="sketch-tutorial-badge">
              <Sparkles size={13} /> {lang === "hi" ? "लाइव वीडियो ट्यूटोरियल" : "Live Video Simulation"}
            </span>
            <h3>{lang === "hi" ? "Sketch Pad चलाना सीखें (स्टेप-बाय-स्टेप)" : "Master Sketch Pad (Video Step-by-Step)"}</h3>
          </div>

          <div className="sketch-tutorial-header-actions">
            <div className="sketch-lang-switcher">
              <button
                type="button"
                className={`sketch-lang-btn ${lang === "hi" ? "is-active" : ""}`}
                onClick={() => setLang("hi")}
              >
                🇮🇳 हिंदी
              </button>
              <button
                type="button"
                className={`sketch-lang-btn ${lang === "en" ? "is-active" : ""}`}
                onClick={() => setLang("en")}
              >
                🌐 English
              </button>
            </div>
            <button type="button" className="sketch-tutorial-close" onClick={onClose} title="Close Tutorial">
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Video Canvas Stage */}
        <div className="sketch-tutorial-body">
          <div className="sketch-tutorial-stage">
            <div className="sketch-stage-grid" />

            <svg className="sketch-stage-svg" viewBox="0 0 600 280">
              {/* SCENE 1: DRAWING 6 CORNERS */}
              {activeScene === 0 && (
                <g>
                  {nodeCount >= 2 && <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {nodeCount >= 3 && <line x1={p2.x} y1={p2.y} x2={p3.x} y2={p3.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {nodeCount >= 4 && <line x1={p3.x} y1={p3.y} x2={p4.x} y2={p4.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {nodeCount >= 5 && <line x1={p4.x} y1={p4.y} x2={p5.x} y2={p5.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {nodeCount >= 6 && <line x1={p5.x} y1={p5.y} x2={p6.x} y2={p6.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {isClosed && <line x1={p6.x} y1={p6.y} x2={p1.x} y2={p1.y} stroke="#2563eb" strokeWidth="2.5" />}

                  {isClosed && (
                    <polygon
                      points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y} ${p5.x},${p5.y} ${p6.x},${p6.y}`}
                      fill="rgba(37, 99, 235, 0.15)"
                    />
                  )}

                  {/* Pulsing Start Ring at P1 */}
                  {nodeCount >= 1 && (
                    <g>
                      <circle cx={p1.x} cy={p1.y} r="16" fill="none" stroke="#22c55e" strokeWidth="2.5" opacity="0.8">
                        <animate attributeName="r" values="8;20;8" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={p1.x} cy={p1.y} r="7" fill="#22c55e" />
                      <text x={p1.x - 10} y={p1.y - 12} fill="#22c55e" fontSize="11" fontWeight="800">
                        {nodeCount < 6 ? "P1" : "Tap to Close (P1)"}
                      </text>
                    </g>
                  )}

                  {nodeCount >= 2 && <circle cx={p2.x} cy={p2.y} r="6" fill="#2563eb" />}
                  {nodeCount >= 3 && <circle cx={p3.x} cy={p3.y} r="6" fill="#2563eb" />}
                  {nodeCount >= 4 && <circle cx={p4.x} cy={p4.y} r="6" fill="#2563eb" />}
                  {nodeCount >= 5 && <circle cx={p5.x} cy={p5.y} r="6" fill="#2563eb" />}
                  {nodeCount >= 6 && <circle cx={p6.x} cy={p6.y} r="6" fill="#2563eb" />}

                  {/* Virtual Finger Cursor */}
                  {fingerPos.opacity > 0 && (
                    <g transform={`translate(${fingerPos.x}, ${fingerPos.y})`} style={{ transition: "transform 0.08s linear" }}>
                      <circle cx="0" cy="0" r="14" fill="rgba(255, 255, 255, 0.25)" stroke="#ffffff" strokeWidth="2" />
                      <path d="M 0 0 L 14 24 L 6 22 L 2 32 L -4 30 L 0 20 L -8 20 Z" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                    </g>
                  )}
                </g>
              )}

              {/* SCENE 2: BASELINE 24 FT & ALL SIDES ESTIMATED -> LOCKED */}
              {activeScene === 1 && (
                <g>
                  <polygon
                    points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y} ${p5.x},${p5.y} ${p6.x},${p6.y}`}
                    fill="rgba(37, 99, 235, 0.12)"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                  />

                  {/* Side 1 (Base Line 24 ft) */}
                  <g transform="translate(265, 40)">
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill="#ffffff" stroke="#22c55e" strokeWidth="2" />
                    <text x="0" y="4" fill="#15803d" fontSize="10" fontWeight="800" textAnchor="middle">24 ft 🔒</text>
                  </g>

                  {/* Side 2 (35 ft) */}
                  <g transform="translate(390, 100)">
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill={frame > 40 ? "#ffffff" : "#fef3c7"} stroke={frame > 40 ? "#22c55e" : "#f59e0b"} strokeWidth="2" />
                    <text x="0" y="4" fill={frame > 40 ? "#15803d" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame > 40 ? "35 ft 🔒" : "~ 32 ft (Est.)"}
                    </text>
                  </g>

                  {/* Side 3 (18 ft) */}
                  <g transform="translate(450, 155)">
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill={frame > 55 ? "#ffffff" : "#fef3c7"} stroke={frame > 55 ? "#22c55e" : "#f59e0b"} strokeWidth="2" />
                    <text x="0" y="4" fill={frame > 55 ? "#15803d" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame > 55 ? "18 ft 🔒" : "~ 16 ft (Est.)"}
                    </text>
                  </g>

                  {/* Side 4 (26 ft) */}
                  <g transform="translate(495, 215)">
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill={frame > 70 ? "#ffffff" : "#fef3c7"} stroke={frame > 70 ? "#22c55e" : "#f59e0b"} strokeWidth="2" />
                    <text x="0" y="4" fill={frame > 70 ? "#15803d" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame > 70 ? "26 ft 🔒" : "~ 28 ft (Est.)"}
                    </text>
                  </g>

                  {/* Side 5 (43 ft) */}
                  <g transform="translate(320, 252)">
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill={frame > 85 ? "#ffffff" : "#fef3c7"} stroke={frame > 85 ? "#22c55e" : "#f59e0b"} strokeWidth="2" />
                    <text x="0" y="4" fill={frame > 85 ? "#15803d" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame > 85 ? "43 ft 🔒" : "~ 39 ft (Est.)"}
                    </text>
                  </g>

                  {/* Side 6 (56 ft) */}
                  <g transform="translate(150, 150)">
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill={frame > 92 ? "#ffffff" : "#fef3c7"} stroke={frame > 92 ? "#22c55e" : "#f59e0b"} strokeWidth="2" />
                    <text x="0" y="4" fill={frame > 92 ? "#15803d" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame > 92 ? "56 ft 🔒" : "~ 60 ft (Est.)"}
                    </text>
                  </g>
                </g>
              )}

              {/* SCENE 3: DIAGONALS FROM V3 -> 4 TRIANGLES (T1 TO T4) */}
              {activeScene === 2 && (
                <g>
                  {/* Triangle 1 (P1-P2-P3) */}
                  <polygon points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`} fill="rgba(37, 99, 235, 0.25)" stroke="#3b82f6" strokeWidth="2" />
                  <text x="290" y="85" fill="#93c5fd" fontSize="10" fontWeight="800">T1: 418 sq.ft</text>

                  {/* Triangle 2 (P1-P3-P6) */}
                  <polygon points={`${p1.x},${p1.y} ${p3.x},${p3.y} ${p6.x},${p6.y}`} fill="rgba(34, 197, 94, 0.25)" stroke="#22c55e" strokeWidth="2" />
                  <text x="230" y="160" fill="#86efac" fontSize="10" fontWeight="800">T2: 656 sq.ft</text>

                  {/* Triangle 3 (P3-P4-P5) */}
                  <polygon points={`${p3.x},${p3.y} ${p4.x},${p4.y} ${p5.x},${p5.y}`} fill="rgba(234, 179, 8, 0.25)" stroke="#eab308" strokeWidth="2" />
                  <text x="430" y="195" fill="#fde047" fontSize="10" fontWeight="800">T3: 221 sq.ft</text>

                  {/* Triangle 4 (P3-P5-P6) */}
                  <polygon points={`${p3.x},${p3.y} ${p5.x},${p5.y} ${p6.x},${p6.y}`} fill="rgba(168, 85, 247, 0.25)" stroke="#a855f7" strokeWidth="2" />
                  <text x="330" y="215" fill="#d8b4fe" fontSize="10" fontWeight="800">T4: 569 sq.ft</text>

                  {/* 3 Survey Diagonals from P3 */}
                  <line x1={p3.x} y1={p3.y} x2={p1.x} y2={p1.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />
                  <line x1={p3.x} y1={p3.y} x2={p6.x} y2={p6.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />
                  <line x1={p3.x} y1={p3.y} x2={p5.x} y2={p5.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />

                  {/* Diagonal Badges */}
                  <text x="240" y="115" fill="#f59e0b" fontSize="9" fontWeight="800">40.0 ft</text>
                  <text x="280" y="185" fill="#f59e0b" fontSize="9" fontWeight="800">33.0 ft</text>
                  <text x="420" y="225" fill="#f59e0b" fontSize="9" fontWeight="800">35.5 ft</text>

                  {/* Total Area Floating Pill */}
                  <g transform="translate(300, 15)">
                    <rect x="-105" y="0" width="210" height="28" rx="14" fill="#22c55e" filter="drop-shadow(0 4px 10px rgba(34, 197, 94, 0.4))" />
                    <text x="0" y="18" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
                      Total: 1,864.47 sq.ft (173.2 m²)
                    </text>
                  </g>
                </g>
              )}

              {/* SCENE 4: 3-PAGE OFFICIAL SURVEY PDF REPORT */}
              {activeScene === 3 && (
                <g>
                  {/* Page 1 Preview */}
                  <g transform="translate(130, 20)">
                    <rect x="0" y="0" width="100" height="135" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.3))" />
                    <rect x="8" y="8" width="84" height="14" rx="3" fill="#1e3a8a" />
                    <text x="50" y="18" fill="#ffffff" fontSize="6" fontWeight="bold" textAnchor="middle">PlotScale Report</text>
                    <text x="10" y="32" fill="#0f172a" fontSize="6" fontWeight="bold">Area: 1,864.47 sq.ft</text>
                    <rect x="8" y="42" width="84" height="75" rx="4" fill="#f8fafc" stroke="#e2e8f0" />
                    <text x="12" y="55" fill="#1e3a8a" fontSize="6" fontWeight="bold">Triangles Table (4)</text>
                    <text x="12" y="68" fill="#64748b" fontSize="5">T1: 418 sq.ft (22%)</text>
                    <text x="12" y="78" fill="#64748b" fontSize="5">T2: 656 sq.ft (35%)</text>
                    <text x="12" y="88" fill="#64748b" fontSize="5">T3: 221 sq.ft (12%)</text>
                    <text x="12" y="98" fill="#64748b" fontSize="5">T4: 569 sq.ft (31%)</text>
                  </g>

                  {/* Page 2 Preview (Drawing) */}
                  <g transform="translate(250, 20)">
                    <rect x="0" y="0" width="100" height="135" rx="6" fill="#ffffff" stroke="#2563eb" strokeWidth="2" filter="drop-shadow(0 6px 14px rgba(37,99,235,0.3))" />
                    <rect x="8" y="8" width="84" height="14" rx="3" fill="#eff6ff" />
                    <text x="50" y="18" fill="#1e3a8a" fontSize="5" fontWeight="bold" textAnchor="middle">Cadastral Survey Map</text>
                    {/* Mini Polygon */}
                    <polygon points="25,40 65,37 68,65 88,70 82,90 27,88" fill="rgba(37, 99, 235, 0.1)" stroke="#0f172a" strokeWidth="1" />
                    <line x1="68" y1="65" x2="25" y2="40" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 1" />
                    <line x1="68" y1="65" x2="27" y2="88" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 1" />
                    <line x1="68" y1="65" x2="82" y2="90" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 1" />
                    <text x="50" y="120" fill="#15803d" fontSize="6" fontWeight="bold" textAnchor="middle">Page 2: Vector Drawing</text>
                  </g>

                  {/* Page 3 Preview (Measurements Table) */}
                  <g transform="translate(370, 20)">
                    <rect x="0" y="0" width="100" height="135" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.3))" />
                    <rect x="8" y="8" width="84" height="14" rx="3" fill="#f1f5f9" />
                    <text x="50" y="18" fill="#334155" fontSize="6" fontWeight="bold" textAnchor="middle">Boundary Details</text>
                    <rect x="8" y="30" width="84" height="85" rx="4" fill="#f8fafc" stroke="#e2e8f0" />
                    <text x="12" y="44" fill="#0f172a" fontSize="5">P1-P2: 24.00 ft</text>
                    <text x="12" y="54" fill="#0f172a" fontSize="5">P2-P3: 35.00 ft</text>
                    <text x="12" y="64" fill="#0f172a" fontSize="5">P3-P4: 18.00 ft</text>
                    <text x="12" y="74" fill="#0f172a" fontSize="5">P4-P5: 26.00 ft</text>
                    <text x="12" y="84" fill="#0f172a" fontSize="5">P5-P6: 43.00 ft</text>
                    <text x="12" y="94" fill="#0f172a" fontSize="5">P6-P1: 56.00 ft</text>
                  </g>

                  {/* Export Pill Action */}
                  <g transform="translate(300, 210)">
                    <rect x="-90" y="-14" width="180" height="28" rx="14" fill="#2563eb" filter="drop-shadow(0 4px 10px rgba(37, 99, 235, 0.4))" />
                    <text x="0" y="4" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
                      Downloaded 3-Page PDF Report
                    </text>
                  </g>
                </g>
              )}
            </svg>

            {/* Play/Pause overlay */}
            <button
              type="button"
              className="sketch-stage-play-overlay"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
              <span>{isPlaying ? (lang === "hi" ? "पॉज़" : "Pause") : (lang === "hi" ? "चलाएं" : "Play")}</span>
            </button>
          </div>

          {/* Scene Explanation Content */}
          <div className="sketch-tutorial-content">
            <div className="sketch-tutorial-step-title">
              <span className="sketch-step-pill">
                Step {activeScene + 1} of {TUTORIAL_SCENES.length}
              </span>
              <h4>{lang === "hi" ? currentSceneData.stageTitleHi : currentSceneData.stageTitleEn}</h4>
            </div>

            <p className="sketch-tutorial-desc">
              {lang === "hi" ? currentSceneData.descHi : currentSceneData.descEn}
            </p>

            <div className="sketch-tutorial-tip-box">
              <Lightbulb size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>{lang === "hi" ? "सर्वेयर गाइड: " : "Surveyor Tip: "}</strong>
                {lang === "hi" ? currentSceneData.tipHi : currentSceneData.tipEn}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <footer className="sketch-tutorial-footer">
          <div className="sketch-tutorial-progress-dots">
            {TUTORIAL_SCENES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`sketch-dot-btn ${activeScene === idx ? "is-active" : ""}`}
                onClick={() => { setActiveScene(idx); setFrame(0); }}
                title={`Scene ${idx + 1}`}
              />
            ))}
          </div>

          <div className="sketch-tutorial-nav-group">
            {onLoadSamplePlot && (
              <button
                type="button"
                className="sketch-btn-try-canvas"
                onClick={() => {
                  onLoadSamplePlot();
                  onClose();
                }}
              >
                <CheckCircle2 size={15} />
                <span>{lang === "hi" ? "कैनवास में लोड करें" : "Load 6-Corner Plot"}</span>
              </button>
            )}

            <button
              type="button"
              className="sketch-btn-tutorial-prev"
              onClick={() => setActiveScene((curr) => Math.max(0, curr - 1))}
              disabled={activeScene === 0}
            >
              <ChevronLeft size={16} />
              <span>{lang === "hi" ? "पीछे" : "Prev"}</span>
            </button>

            <button
              type="button"
              className="sketch-btn-tutorial-next"
              onClick={activeScene === TUTORIAL_SCENES.length - 1 ? onClose : () => setActiveScene((curr) => Math.min(TUTORIAL_SCENES.length - 1, curr + 1))}
            >
              <span>
                {activeScene === TUTORIAL_SCENES.length - 1
                  ? (lang === "hi" ? "समाप्त करें" : "Finish")
                  : (lang === "hi" ? "आगे बढ़ें" : "Next")}
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
