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
    stageTitleHi: "2. भुजाओं की लंबाई दर्ज करें → प्लॉट की लाइनों का छोटा-बड़ा खिंचना (Live Morphing)",
    stageTitleEn: "2. Enter Side Lengths → Watch Boundaries Dynamically Stretch & Morph",
    descHi: "जैसे-जैसे आप भुजाएं (24 ft, 35 ft, 18 ft, 26 ft, 43 ft, 56 ft) दर्ज करेंगे, प्लॉट की भुजाएं लाइव छोटी-बड़ी होकर अपने सही अनुपात (Scale) में खिंचेंगी।",
    descEn: "As you input boundary measurements (24 ft, 35 ft, 18 ft, 26 ft, 43 ft, 56 ft), watch the canvas dynamically stretch and contract lines in real-time.",
    tipHi: "पहली भुजा से स्केल कैलिब्रेट होता है और बाकी भुजाएं रीयल-टाइम में एडजस्ट होती हैं।",
    tipEn: "The 1st side sets the calibration scale, and all remaining sides physically morph into proportional geometry.",
  },
  {
    id: 3,
    stageTitleHi: "3. विकर्ण (Diagonals) जोड़ें → प्लॉट का सही आकार में झुकना व त्रिभुज लॉक होना",
    stageTitleEn: "3. Add Diagonals → Plot Morphs & Snaps into Rigid 2D Triangulation",
    descHi: "Base V3 से 3 विकर्ण (40ft, 33ft, 35.5ft) लॉक करते ही प्लॉट के रोटरी जॉइंट्स मुड़कर 100% सही 2D आकार में फिक्स हो जाते हैं और 4 त्रिभुज (1,864.47 sq.ft) बन जाते हैं।",
    descEn: "Locking the 3 diagonals from Base V3 (40 ft, 33 ft, 35.5 ft) flexes the rotary joints, perfectly snapping the polygon into rigid 2D triangulation (4 Triangles: 1,864.47 sq.ft).",
    tipHi: "पटवारी नियम: विकर्ण डालते ही प्लॉट का सही आकार और वास्तविक क्षेत्रफल लॉक हो जाता है।",
    tipEn: "Survey Law: Diagonals rigidly fix irregular plot corners preventing any area distortion.",
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

// Linear interpolation helper
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
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
        return prev + 1.15;
      });
    }, 70);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, activeScene]);

  if (!isOpen) return null;

  const currentSceneData = TUTORIAL_SCENES[activeScene];

  // Base Vertices: Initial Rough Hand Sketch (Before Sizing)
  const rawP1 = { x: 190, y: 70 };
  const rawP2 = { x: 330, y: 65 };
  const rawP3 = { x: 340, y: 135 };
  const rawP4 = { x: 440, y: 145 };
  const rawP5 = { x: 420, y: 220 };
  const rawP6 = { x: 200, y: 215 };

  // Intermediate Vertices: Dynamically Stretched / Morphed (Scene 2)
  const stretchT = Math.min(1, Math.max(0, (frame - 20) / 75));
  const morphedP1 = { x: lerp(rawP1.x, 170, stretchT), y: lerp(rawP1.y, 55, stretchT) };
  const morphedP2 = { x: lerp(rawP2.x, 360, stretchT), y: lerp(rawP2.y, 45, stretchT) };
  const morphedP3 = { x: lerp(rawP3.x, 375, stretchT), y: lerp(rawP3.y, 155, stretchT) };
  const morphedP4 = { x: lerp(rawP4.x, 495, stretchT), y: lerp(rawP4.y, 175, stretchT) };
  const morphedP5 = { x: lerp(rawP5.x, 465, stretchT), y: lerp(rawP5.y, 245, stretchT) };
  const morphedP6 = { x: lerp(rawP6.x, 180, stretchT), y: lerp(rawP6.y, 240, stretchT) };

  // Scene 3: Rotary Flex and Triangulation Snap (Skewed -> Rigid Snap)
  const skewT = activeScene === 2 ? Math.min(1, Math.max(0, (frame - 35) / 35)) : 1;
  const preSnapP3 = { x: 350, y: 175 }; // Slightly skewed before diagonals lock
  const preSnapP5 = { x: 485, y: 230 };

  const finalP1 = { x: 170, y: 55 };
  const finalP2 = { x: 360, y: 45 };
  const finalP3 = { x: lerp(preSnapP3.x, 375, skewT), y: lerp(preSnapP3.y, 155, skewT) };
  const finalP4 = { x: 495, y: 175 };
  const finalP5 = { x: lerp(preSnapP5.x, 465, skewT), y: lerp(preSnapP5.y, 245, skewT) };
  const finalP6 = { x: 180, y: 240 };

  // Current active coordinates for rendering
  const curP1 = activeScene === 0 ? rawP1 : activeScene === 1 ? morphedP1 : finalP1;
  const curP2 = activeScene === 0 ? rawP2 : activeScene === 1 ? morphedP2 : finalP2;
  const curP3 = activeScene === 0 ? rawP3 : activeScene === 1 ? morphedP3 : finalP3;
  const curP4 = activeScene === 0 ? rawP4 : activeScene === 1 ? morphedP4 : finalP4;
  const curP5 = activeScene === 0 ? rawP5 : activeScene === 1 ? morphedP5 : finalP5;
  const curP6 = activeScene === 0 ? rawP6 : activeScene === 1 ? morphedP6 : finalP6;

  // Virtual Finger pointer calculations
  let fingerPos = { x: curP1.x, y: curP1.y, opacity: 0, tapping: false };
  let nodeCount = 0;
  let isClosed = false;

  if (activeScene === 0) {
    if (frame < 16) {
      fingerPos = { x: 100 + (curP1.x - 100) * (frame / 16), y: 100 + (curP1.y - 100) * (frame / 16), opacity: 1, tapping: frame > 12 };
      nodeCount = frame >= 14 ? 1 : 0;
    } else if (frame < 32) {
      fingerPos = { x: curP1.x + (curP2.x - curP1.x) * ((frame - 16) / 16), y: curP1.y + (curP2.y - curP1.y) * ((frame - 16) / 16), opacity: 1, tapping: frame > 28 };
      nodeCount = frame >= 30 ? 2 : 1;
    } else if (frame < 48) {
      fingerPos = { x: curP2.x + (curP3.x - curP2.x) * ((frame - 32) / 16), y: curP2.y + (curP3.y - curP2.y) * ((frame - 32) / 16), opacity: 1, tapping: frame > 44 };
      nodeCount = frame >= 46 ? 3 : 2;
    } else if (frame < 64) {
      fingerPos = { x: curP3.x + (curP4.x - curP3.x) * ((frame - 48) / 16), y: curP3.y + (curP4.y - curP3.y) * ((frame - 48) / 16), opacity: 1, tapping: frame > 60 };
      nodeCount = frame >= 62 ? 4 : 3;
    } else if (frame < 80) {
      fingerPos = { x: curP4.x + (curP5.x - curP4.x) * ((frame - 64) / 16), y: curP4.y + (curP5.y - curP4.y) * ((frame - 64) / 16), opacity: 1, tapping: frame > 76 };
      nodeCount = frame >= 78 ? 5 : 4;
    } else if (frame < 92) {
      fingerPos = { x: curP5.x + (curP6.x - curP5.x) * ((frame - 80) / 12), y: curP5.y + (curP6.y - curP5.y) * ((frame - 80) / 12), opacity: 1, tapping: frame > 88 };
      nodeCount = 6;
    } else {
      fingerPos = { x: curP6.x + (curP1.x - curP6.x) * ((frame - 92) / 8), y: curP6.y + (curP1.y - curP6.y) * ((frame - 92) / 8), opacity: 1, tapping: frame > 96 };
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
            <h3>{lang === "hi" ? "Sketch Pad चलाना सीखें (लाइव मोर्फिंग)" : "Master Sketch Pad (Live Dynamic Morphing)"}</h3>
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
                  {nodeCount >= 2 && <line x1={curP1.x} y1={curP1.y} x2={curP2.x} y2={curP2.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {nodeCount >= 3 && <line x1={curP2.x} y1={curP2.y} x2={curP3.x} y2={curP3.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {nodeCount >= 4 && <line x1={curP3.x} y1={curP3.y} x2={curP4.x} y2={curP4.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {nodeCount >= 5 && <line x1={curP4.x} y1={curP4.y} x2={curP5.x} y2={curP5.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {nodeCount >= 6 && <line x1={curP5.x} y1={curP5.y} x2={curP6.x} y2={curP6.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {isClosed && <line x1={curP6.x} y1={curP6.y} x2={curP1.x} y2={curP1.y} stroke="#2563eb" strokeWidth="2.5" />}

                  {isClosed && (
                    <polygon
                      points={`${curP1.x},${curP1.y} ${curP2.x},${curP2.y} ${curP3.x},${curP3.y} ${curP4.x},${curP4.y} ${curP5.x},${curP5.y} ${curP6.x},${curP6.y}`}
                      fill="rgba(37, 99, 235, 0.15)"
                    />
                  )}

                  {/* Pulsing Start Ring at P1 */}
                  {nodeCount >= 1 && (
                    <g>
                      <circle cx={curP1.x} cy={curP1.y} r="16" fill="none" stroke="#22c55e" strokeWidth="2.5" opacity="0.8">
                        <animate attributeName="r" values="8;20;8" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={curP1.x} cy={curP1.y} r="7" fill="#22c55e" />
                      <text x={curP1.x - 10} y={curP1.y - 12} fill="#22c55e" fontSize="11" fontWeight="800">
                        {nodeCount < 6 ? "P1" : "Tap to Close (P1)"}
                      </text>
                    </g>
                  )}

                  {nodeCount >= 2 && <circle cx={curP2.x} cy={curP2.y} r="6" fill="#2563eb" />}
                  {nodeCount >= 3 && <circle cx={curP3.x} cy={curP3.y} r="6" fill="#2563eb" />}
                  {nodeCount >= 4 && <circle cx={curP4.x} cy={curP4.y} r="6" fill="#2563eb" />}
                  {nodeCount >= 5 && <circle cx={curP5.x} cy={curP5.y} r="6" fill="#2563eb" />}
                  {nodeCount >= 6 && <circle cx={curP6.x} cy={curP6.y} r="6" fill="#2563eb" />}

                  {/* Virtual Finger Cursor */}
                  {fingerPos.opacity > 0 && (
                    <g transform={`translate(${fingerPos.x}, ${fingerPos.y})`} style={{ transition: "transform 0.08s linear" }}>
                      <circle cx="0" cy="0" r="14" fill="rgba(255, 255, 255, 0.25)" stroke="#ffffff" strokeWidth="2" />
                      <path d="M 0 0 L 14 24 L 6 22 L 2 32 L -4 30 L 0 20 L -8 20 Z" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                    </g>
                  )}
                </g>
              )}

              {/* SCENE 2: ENTERING LENGTHS & DYNAMIC STRETCHING/MORPHING OF SIDES */}
              {activeScene === 1 && (
                <g>
                  <polygon
                    points={`${curP1.x},${curP1.y} ${curP2.x},${curP2.y} ${curP3.x},${curP3.y} ${curP4.x},${curP4.y} ${curP5.x},${curP5.y} ${curP6.x},${curP6.y}`}
                    fill="rgba(37, 99, 235, 0.12)"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                  />

                  {/* Vertices */}
                  <circle cx={curP1.x} cy={curP1.y} r="5" fill="#2563eb" />
                  <circle cx={curP2.x} cy={curP2.y} r="5" fill="#2563eb" />
                  <circle cx={curP3.x} cy={curP3.y} r="5" fill="#2563eb" />
                  <circle cx={curP4.x} cy={curP4.y} r="5" fill="#2563eb" />
                  <circle cx={curP5.x} cy={curP5.y} r="5" fill="#2563eb" />
                  <circle cx={curP6.x} cy={curP6.y} r="5" fill="#2563eb" />

                  {/* Side 1 (Base Line 24 ft) */}
                  <g transform={`translate(${(curP1.x + curP2.x) / 2}, ${(curP1.y + curP2.y) / 2 - 12})`}>
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill="#ffffff" stroke="#22c55e" strokeWidth="2" />
                    <text x="0" y="4" fill="#15803d" fontSize="10" fontWeight="800" textAnchor="middle">24 ft 🔒</text>
                  </g>

                  {/* Side 2 (35 ft) */}
                  <g transform={`translate(${(curP2.x + curP3.x) / 2 + 15}, ${(curP2.y + curP3.y) / 2})`}>
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill={frame > 40 ? "#ffffff" : "#fef3c7"} stroke={frame > 40 ? "#22c55e" : "#f59e0b"} strokeWidth="2" />
                    <text x="0" y="4" fill={frame > 40 ? "#15803d" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame > 40 ? "35 ft 🔒" : "~ 32 ft (Est.)"}
                    </text>
                  </g>

                  {/* Side 3 (18 ft) */}
                  <g transform={`translate(${(curP3.x + curP4.x) / 2}, ${(curP3.y + curP4.y) / 2 - 12})`}>
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill={frame > 55 ? "#ffffff" : "#fef3c7"} stroke={frame > 55 ? "#22c55e" : "#f59e0b"} strokeWidth="2" />
                    <text x="0" y="4" fill={frame > 55 ? "#15803d" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame > 55 ? "18 ft 🔒" : "~ 16 ft (Est.)"}
                    </text>
                  </g>

                  {/* Side 4 (26 ft) */}
                  <g transform={`translate(${(curP4.x + curP5.x) / 2 + 20}, ${(curP4.y + curP5.y) / 2})`}>
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill={frame > 70 ? "#ffffff" : "#fef3c7"} stroke={frame > 70 ? "#22c55e" : "#f59e0b"} strokeWidth="2" />
                    <text x="0" y="4" fill={frame > 70 ? "#15803d" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame > 70 ? "26 ft 🔒" : "~ 28 ft (Est.)"}
                    </text>
                  </g>

                  {/* Side 5 (43 ft) */}
                  <g transform={`translate(${(curP5.x + curP6.x) / 2}, ${(curP5.y + curP6.y) / 2 + 15})`}>
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill={frame > 85 ? "#ffffff" : "#fef3c7"} stroke={frame > 85 ? "#22c55e" : "#f59e0b"} strokeWidth="2" />
                    <text x="0" y="4" fill={frame > 85 ? "#15803d" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame > 85 ? "43 ft 🔒" : "~ 39 ft (Est.)"}
                    </text>
                  </g>

                  {/* Side 6 (56 ft) */}
                  <g transform={`translate(${(curP6.x + curP1.x) / 2 - 25}, ${(curP6.y + curP1.y) / 2})`}>
                    <rect x="-38" y="-12" width="76" height="24" rx="12" fill={frame > 92 ? "#ffffff" : "#fef3c7"} stroke={frame > 92 ? "#22c55e" : "#f59e0b"} strokeWidth="2" />
                    <text x="0" y="4" fill={frame > 92 ? "#15803d" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame > 92 ? "56 ft 🔒" : "~ 60 ft (Est.)"}
                    </text>
                  </g>

                  {/* Dynamic Scaling Indicator Banner */}
                  <g transform="translate(300, 18)">
                    <rect x="-115" y="0" width="230" height="26" rx="13" fill="#1e3a8a" opacity="0.95" />
                    <text x="0" y="17" fill="#93c5fd" fontSize="10" fontWeight="800" textAnchor="middle">
                      ⚡ Dynamic Boundary Stretch & Auto-Scale
                    </text>
                  </g>
                </g>
              )}

              {/* SCENE 3: DIAGONALS LOCK & ROTARY JOINTS MORPH TO EXACT TRIANGULATION */}
              {activeScene === 2 && (
                <g>
                  {/* Triangle 1 (P1-P2-P3) */}
                  <polygon points={`${curP1.x},${curP1.y} ${curP2.x},${curP2.y} ${curP3.x},${curP3.y}`} fill="rgba(37, 99, 235, 0.28)" stroke="#3b82f6" strokeWidth="2" />
                  <text x="290" y="85" fill="#93c5fd" fontSize="10" fontWeight="800">T1: 418 sq.ft</text>

                  {/* Triangle 2 (P1-P3-P6) */}
                  <polygon points={`${curP1.x},${curP1.y} ${curP3.x},${curP3.y} ${curP6.x},${curP6.y}`} fill="rgba(34, 197, 94, 0.28)" stroke="#22c55e" strokeWidth="2" />
                  <text x="230" y="160" fill="#86efac" fontSize="10" fontWeight="800">T2: 656 sq.ft</text>

                  {/* Triangle 3 (P3-P4-P5) */}
                  <polygon points={`${curP3.x},${curP3.y} ${curP4.x},${curP4.y} ${curP5.x},${curP5.y}`} fill="rgba(234, 179, 8, 0.28)" stroke="#eab308" strokeWidth="2" />
                  <text x="430" y="195" fill="#fde047" fontSize="10" fontWeight="800">T3: 221 sq.ft</text>

                  {/* Triangle 4 (P3-P5-P6) */}
                  <polygon points={`${curP3.x},${curP3.y} ${curP5.x},${curP5.y} ${curP6.x},${curP6.y}`} fill="rgba(168, 85, 247, 0.28)" stroke="#a855f7" strokeWidth="2" />
                  <text x="330" y="215" fill="#d8b4fe" fontSize="10" fontWeight="800">T4: 569 sq.ft</text>

                  {/* 3 Survey Diagonals from P3 */}
                  <line x1={curP3.x} y1={curP3.y} x2={curP1.x} y2={curP1.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />
                  <line x1={curP3.x} y1={curP3.y} x2={curP6.x} y2={curP6.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />
                  <line x1={curP3.x} y1={curP3.y} x2={curP5.x} y2={curP5.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />

                  {/* Vertices */}
                  <circle cx={curP1.x} cy={curP1.y} r="5" fill="#2563eb" />
                  <circle cx={curP2.x} cy={curP2.y} r="5" fill="#2563eb" />
                  <circle cx={curP3.x} cy={curP3.y} r="7" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                  <circle cx={curP4.x} cy={curP4.y} r="5" fill="#2563eb" />
                  <circle cx={curP5.x} cy={curP5.y} r="5" fill="#2563eb" />
                  <circle cx={curP6.x} cy={curP6.y} r="5" fill="#2563eb" />

                  {/* Diagonal Badges */}
                  <text x="240" y="115" fill="#f59e0b" fontSize="9" fontWeight="800">40.0 ft</text>
                  <text x="280" y="185" fill="#f59e0b" fontSize="9" fontWeight="800">33.0 ft</text>
                  <text x="420" y="225" fill="#f59e0b" fontSize="9" fontWeight="800">35.5 ft</text>

                  {/* Morphed Shape Locked Notification Pill */}
                  <g transform="translate(300, 15)">
                    <rect x="-120" y="0" width="240" height="28" rx="14" fill="#22c55e" filter="drop-shadow(0 4px 12px rgba(34, 197, 94, 0.4))" />
                    <text x="0" y="18" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
                      ✓ Shape Morphed & Locked: 1,864.47 sq.ft
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
