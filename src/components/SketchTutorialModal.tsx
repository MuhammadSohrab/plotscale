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
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  TableProperties,
  Plus,
  Minus,
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
    stageTitleHi: "1. कोने बनाना, क्लोज़ करना, Undo/Redo और Zoom/Fit",
    stageTitleEn: "1. Draw Nodes, Close Plot, Undo/Redo & Zoom Controls",
    descHi: "कैनवास पर टैप करके 6 कोने बनाएं और हरे पल्सिंग रिंग (P1) पर टैप कर क्लोज़ करें। ऊपर Undo/Redo से गलती सुधारें और Zoom In/Out व Fit से कैनवास सेट करें।",
    descEn: "Tap to create 6 cadastral vertices and close on P1. Use top header Undo/Redo buttons for mistake correction and Zoom (+/-) to fit the drawing perfectly.",
    tipHi: "गलत कोना लग जाने पर Undo (Ctrl+Z) दबाएं या Trash बटन से कैनवास रीसेट करें।",
    tipEn: "Press Undo (Ctrl+Z) to reverse a vertex or Clear to reset the canvas.",
  },
  {
    id: 2,
    stageTitleHi: "2. भुजाओं की नाप (24 ft) → ऑटो-स्केल व लाइनों का खिंचना (Dynamic Stretch)",
    stageTitleEn: "2. Input Side Lengths → Proportional Boundary Stretching",
    descHi: "पहली भुजा (P1-P2) पर 24 ft दर्ज करते ही स्केल कैलिब्रेट होगा। बाकी भुजाओं (35, 18, 26, 43, 56 ft) की लंबाई दर्ज करने पर लाइनें लाइव छोटी-बड़ी होकर सही स्केल में खिंचेंगी।",
    descEn: "Entering 24 ft on P1-P2 calibrates the map scale. Inputting remaining sides (35, 18, 26, 43, 56 ft) dynamically stretches and sizes boundaries in real-time.",
    tipHi: "भुजा पर क्लिक करके आप कभी भी उसकी लंबाई बदल सकते हैं।",
    tipEn: "Click any side anytime to re-edit its locked distance.",
  },
  {
    id: 3,
    stageTitleHi: "3. रोटरी ग्रिप हैंडल (Offset Drag) और कोनों के कोण (Degrees)",
    stageTitleEn: "3. Rotary Drag Grip Handle & Corner Degrees Inspector",
    descHi: "किसी भी कोने पर टैप करने से 'Offset Drag Handle' खुलता है। इसे खींचकर आप कोने का झुकाव बदल सकते हैं। कोने पर डबल-टैप करके सीधे कोण (Degrees) भी दर्ज कर सकते हैं।",
    descEn: "Tap any corner node to reveal the Rotary Drag Handle. Drag it to rotate corner orientation or double-tap to directly type exact compass degrees.",
    tipHi: "चारों कोनों के कोण देखने से पता चलता है कि खेत गुनिया (90°) में है या कितना तिरछा है।",
    tipEn: "Corner angles instantly show whether boundaries meet at 90° right angles or are skewed.",
  },
  {
    id: 4,
    stageTitleHi: "4. Diagonals डॉक (Add ➕, Less ➖, Finish ✔️) व सही 2D मोर्फिंग",
    stageTitleEn: "4. Diagonals Action Dock (Add ➕, Less ➖, Finish ✔️) & 2D Morphing",
    descHi: "'Diagonals' बटन दबाकर Base V3 चुनें। V1 (40ft), V6 (33ft), V5 (35.5ft) दर्ज कर 'Lock & Save' दबाएं। प्लॉट तुरंत सही 2D त्रिभुजों में मुड़कर लॉक हो जाएगा।",
    descEn: "Tap 'Diagonals' and pick Base V3. Enter V1 (40 ft), V6 (33 ft), and V5 (35.5 ft) in the floating dock and tap 'Lock & Save' to snap into rigid triangulation.",
    tipHi: "यदि कोई गलत विकर्ण जुड़ जाए तो 'Less (➖)' मोड से उसे 1-क्लिक में हटा सकते हैं।",
    tipEn: "Use the 'Less (➖)' dock button to quickly delete any unwanted diagonal.",
  },
  {
    id: 5,
    stageTitleHi: "5. Triangles डॉक (T1 to T4) और रकबा यूनिट कन्वर्टर (Bigha, Biswa, Gaj)",
    stageTitleEn: "5. Survey Triangles Dock (T1-T4) & Area Unit Switcher",
    descHi: "'Triangles (4)' पर क्लिक करके हर त्रिभुज (T1, T2, T3, T4) का अलग-अलग रकबा और भुजाएं देखें। नीचे एरिया चिप से वर्गफुट, मीटर, बीघा, बिस्वा, कट्टा व एकड़ में कुल रकबा देखें।",
    descEn: "Open 'Triangles (4)' to inspect individual triangle areas and side breakdowns. Use the bottom Area Chip to view live area in Sq.Ft, Sq.M, Bigha, Biswa, Gaj, and Acres.",
    tipHi: "त्रिभुज कार्ड पर माउस ले जाने से कैनवास पर वही त्रिभुज हाइलाइट हो जाता है।",
    tipEn: "Hovering over any triangle card highlights that specific survey triangle on the canvas.",
  },
  {
    id: 6,
    stageTitleHi: "6. Save Plot (लोकल मेमोरी) और Multi-Format Export (PDF, DXF, SVG, CSV)",
    stageTitleEn: "6. Save Plot & Multi-Format Export (Official PDF, DXF, SVG, CSV)",
    descHi: "'Save' दबाकर खसरा नाम के साथ प्लॉट सेव करें। 'Export' से सरकारी 3-पेज PDF नक़्शा रिपोर्ट, AutoCAD (.DXF), स्केलेबल SVG और Excel (.CSV) डेटा एक क्लिक में डाउनलोड करें।",
    descEn: "Save plots with Khasra numbers to local storage. Click 'Export' to generate official 3-page survey PDF sheets, AutoCAD (.DXF) 1:1 vectors, SVGs, and Excel CSV tables.",
    tipHi: "AutoCAD DXF फाइल को सीधे AutoCAD या Civil 3D में 1:1 स्केल पर खोला जा सकता है।",
    tipEn: "The AutoCAD DXF export opens seamlessly in AutoCAD or Civil 3D at exact 1:1 ground scale.",
  },
];

interface SketchTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSamplePlot?: () => void;
}

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

  // Base Vertices: Initial Rough Hand Sketch
  const rawP1 = { x: 190, y: 70 };
  const rawP2 = { x: 330, y: 65 };
  const rawP3 = { x: 340, y: 135 };
  const rawP4 = { x: 440, y: 145 };
  const rawP5 = { x: 420, y: 220 };
  const rawP6 = { x: 200, y: 215 };

  // Intermediate Vertices: Dynamically Stretched / Morphed
  const stretchT = Math.min(1, Math.max(0, (frame - 20) / 75));
  const morphedP1 = { x: lerp(rawP1.x, 170, stretchT), y: lerp(rawP1.y, 55, stretchT) };
  const morphedP2 = { x: lerp(rawP2.x, 360, stretchT), y: lerp(rawP2.y, 45, stretchT) };
  const morphedP3 = { x: lerp(rawP3.x, 375, stretchT), y: lerp(rawP3.y, 155, stretchT) };
  const morphedP4 = { x: lerp(rawP4.x, 495, stretchT), y: lerp(rawP4.y, 175, stretchT) };
  const morphedP5 = { x: lerp(rawP5.x, 465, stretchT), y: lerp(rawP5.y, 245, stretchT) };
  const morphedP6 = { x: lerp(rawP6.x, 180, stretchT), y: lerp(rawP6.y, 240, stretchT) };

  // Scene 3 & 4: Rotary Flex and Triangulation Snap
  const skewT = activeScene === 3 ? Math.min(1, Math.max(0, (frame - 35) / 35)) : 1;
  const preSnapP3 = { x: 350, y: 175 };
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
        {/* Top Header */}
        <header className="sketch-tutorial-header">
          <div className="sketch-tutorial-title-group">
            <span className="sketch-tutorial-badge">
              <Sparkles size={13} /> {lang === "hi" ? "कम्प्लीट वीडियो गाइड" : "Full Feature Video Guide"}
            </span>
            <h3>{lang === "hi" ? "Sketch Pad के सभी टूल्स चलाना सीखें" : "Learn All Sketch Pad Tools & Controls"}</h3>
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
              {/* SCENE 1: DRAWING NODES, UNDO/REDO & ZOOM CONTROLS */}
              {activeScene === 0 && (
                <g>
                  {/* Top Action Toolbar Simulation */}
                  <g transform="translate(150, 15)">
                    <rect x="0" y="0" width="300" height="28" rx="8" fill="rgba(255,255,255,0.95)" stroke="#cbd5e1" strokeWidth="1" />
                    <text x="15" y="18" fill="#2563eb" fontSize="10" fontWeight="bold">↶ Undo</text>
                    <text x="70" y="18" fill="#64748b" fontSize="10">↷ Redo</text>
                    <text x="120" y="18" fill="#15803d" fontSize="10">💾 Save</text>
                    <text x="165" y="18" fill="#2563eb" fontSize="10">📥 Export</text>
                    <text x="220" y="18" fill="#ef4444" fontSize="10">🗑️ Clear</text>
                    <text x="265" y="18" fill="#0f172a" fontSize="10" fontWeight="800">100%</text>
                  </g>

                  {/* Polygon lines */}
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

              {/* SCENE 2: BASELINE 24 FT & SIDES DYNAMIC STRETCHING */}
              {activeScene === 1 && (
                <g>
                  <polygon
                    points={`${curP1.x},${curP1.y} ${curP2.x},${curP2.y} ${curP3.x},${curP3.y} ${curP4.x},${curP4.y} ${curP5.x},${curP5.y} ${curP6.x},${curP6.y}`}
                    fill="rgba(37, 99, 235, 0.12)"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                  />

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

                  {/* Dimension input popover modal demo */}
                  {frame > 10 && frame < 35 && (
                    <g transform="translate(240, 85)">
                      <rect x="0" y="0" width="130" height="46" rx="10" fill="#ffffff" stroke="#2563eb" strokeWidth="2" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.3))" />
                      <text x="12" y="16" fill="#64748b" fontSize="9" fontWeight="bold">Side P1-P2 Length:</text>
                      <text x="12" y="34" fill="#1e3a8a" fontSize="14" fontWeight="800">24 ft</text>
                      <rect x="80" y="20" width="40" height="20" rx="5" fill="#22c55e" />
                      <text x="100" y="34" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">Set</text>
                    </g>
                  )}
                </g>
              )}

              {/* SCENE 3: ROTARY DRAG GRIP & CORNER ANGLES */}
              {activeScene === 2 && (
                <g>
                  <polygon
                    points={`${curP1.x},${curP1.y} ${curP2.x},${curP2.y} ${curP3.x},${curP3.y} ${curP4.x},${curP4.y} ${curP5.x},${curP5.y} ${curP6.x},${curP6.y}`}
                    fill="rgba(37, 99, 235, 0.15)"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                  />

                  {/* Corner Angles Displayed */}
                  <g transform={`translate(${curP1.x - 20}, ${curP1.y - 10})`}>
                    <rect x="0" y="0" width="44" height="18" rx="5" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
                    <text x="22" y="13" fill="#92400e" fontSize="9" fontWeight="bold" textAnchor="middle">256.4°</text>
                  </g>
                  <g transform={`translate(${curP2.x + 10}, ${curP2.y - 10})`}>
                    <rect x="0" y="0" width="44" height="18" rx="5" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
                    <text x="22" y="13" fill="#92400e" fontSize="9" fontWeight="bold" textAnchor="middle">279.7°</text>
                  </g>
                  <g transform={`translate(${curP4.x + 10}, ${curP4.y})`}>
                    <rect x="0" y="0" width="44" height="18" rx="5" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
                    <text x="22" y="13" fill="#92400e" fontSize="9" fontWeight="bold" textAnchor="middle">283.9°</text>
                  </g>
                  <g transform={`translate(${curP5.x + 10}, ${curP5.y + 10})`}>
                    <rect x="0" y="0" width="44" height="18" rx="5" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
                    <text x="22" y="13" fill="#92400e" fontSize="9" fontWeight="bold" textAnchor="middle">262.0°</text>
                  </g>

                  {/* Offset Drag Handle on P3 */}
                  <line x1={curP3.x} y1={curP3.y} x2={curP3.x + 35} y2={curP3.y - 30} stroke="#22c55e" strokeWidth="2.5" strokeDasharray="3 3" />
                  <circle cx={curP3.x + 35} cy={curP3.y - 30} r="16" fill="#22c55e" stroke="#ffffff" strokeWidth="3" filter="drop-shadow(0 4px 10px rgba(34,197,94,0.5))">
                    <animate attributeName="r" values="14;18;14" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <text x={curP3.x + 35} y={curP3.y - 48} fill="#4ade80" fontSize="10" fontWeight="bold" textAnchor="middle">
                    Drag Grip Handle
                  </text>
                </g>
              )}

              {/* SCENE 4: DIAGONALS SETUP DOCK & RIGID SNAP */}
              {activeScene === 3 && (
                <g>
                  {/* Floating Action Dock (Add, Less, Finish) */}
                  <g transform="translate(180, 12)">
                    <rect x="0" y="0" width="240" height="32" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.15))" />
                    <rect x="6" y="5" width="70" height="22" rx="6" fill="#eff6ff" />
                    <text x="41" y="20" fill="#2563eb" fontSize="10" fontWeight="bold" textAnchor="middle">➕ Add</text>
                    <text x="120" y="20" fill="#64748b" fontSize="10" textAnchor="middle">➖ Less</text>
                    <rect x="164" y="5" width="70" height="22" rx="6" fill="#22c55e" />
                    <text x="199" y="20" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">✔️ Finish</text>
                  </g>

                  {/* 4 Triangles */}
                  <polygon points={`${curP1.x},${curP1.y} ${curP2.x},${curP2.y} ${curP3.x},${curP3.y}`} fill="rgba(37, 99, 235, 0.28)" stroke="#3b82f6" strokeWidth="2" />
                  <polygon points={`${curP1.x},${curP1.y} ${curP3.x},${curP3.y} ${curP6.x},${curP6.y}`} fill="rgba(34, 197, 94, 0.28)" stroke="#22c55e" strokeWidth="2" />
                  <polygon points={`${curP3.x},${curP3.y} ${curP4.x},${curP4.y} ${curP5.x},${curP5.y}`} fill="rgba(234, 179, 8, 0.28)" stroke="#eab308" strokeWidth="2" />
                  <polygon points={`${curP3.x},${curP3.y} ${curP5.x},${curP5.y} ${curP6.x},${curP6.y}`} fill="rgba(168, 85, 247, 0.28)" stroke="#a855f7" strokeWidth="2" />

                  {/* 3 Survey Diagonals from P3 */}
                  <line x1={curP3.x} y1={curP3.y} x2={curP1.x} y2={curP1.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />
                  <line x1={curP3.x} y1={curP3.y} x2={curP6.x} y2={curP6.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />
                  <line x1={curP3.x} y1={curP3.y} x2={curP5.x} y2={curP5.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" />

                  {/* Base V3 Pill */}
                  <g transform={`translate(${curP3.x}, ${curP3.y})`}>
                    <circle cx="0" cy="0" r="9" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                    <text x="14" y="4" fill="#fbbf24" fontSize="10" fontWeight="bold">Pivot Base V3</text>
                  </g>
                </g>
              )}

              {/* SCENE 5: TRIANGLES DOCK & AREA CHIP */}
              {activeScene === 4 && (
                <g>
                  {/* Triangles Dock Drawer Demo on Right */}
                  <g transform="translate(380, 20)">
                    <rect x="0" y="0" width="200" height="230" rx="12" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" filter="drop-shadow(0 6px 16px rgba(0,0,0,0.3))" />
                    <rect x="10" y="10" width="180" height="26" rx="6" fill="#f8fafc" />
                    <text x="20" y="27" fill="#1e3a8a" fontSize="11" fontWeight="800">Survey Triangles (4)</text>

                    {/* T1 Card */}
                    <g transform="translate(10, 45)">
                      <rect x="0" y="0" width="180" height="38" rx="8" fill="#eff6ff" stroke="#bfdbfe" />
                      <text x="10" y="18" fill="#1e40af" fontSize="10" fontWeight="bold">Triangle 1 (V1-V2-V3)</text>
                      <text x="10" y="30" fill="#64748b" fontSize="9">418.00 sq.ft (24, 35, 40 ft)</text>
                    </g>

                    {/* T2 Card */}
                    <g transform="translate(10, 90)">
                      <rect x="0" y="0" width="180" height="38" rx="8" fill="#f0fdf4" stroke="#bbf7d0" />
                      <text x="10" y="18" fill="#166534" fontSize="10" fontWeight="bold">Triangle 2 (V1-V3-V6)</text>
                      <text x="10" y="30" fill="#64748b" fontSize="9">656.00 sq.ft (40, 33, 56 ft)</text>
                    </g>

                    {/* T3 Card */}
                    <g transform="translate(10, 135)">
                      <rect x="0" y="0" width="180" height="38" rx="8" fill="#fefce8" stroke="#fef08a" />
                      <text x="10" y="18" fill="#854d0e" fontSize="10" fontWeight="bold">Triangle 3 (V3-V4-V5)</text>
                      <text x="10" y="30" fill="#64748b" fontSize="9">221.00 sq.ft (18, 26, 35.5 ft)</text>
                    </g>

                    {/* T4 Card */}
                    <g transform="translate(10, 180)">
                      <rect x="0" y="0" width="180" height="38" rx="8" fill="#faf5ff" stroke="#e9d5ff" />
                      <text x="10" y="18" fill="#6b21a8" fontSize="10" fontWeight="bold">Triangle 4 (V3-V5-V6)</text>
                      <text x="10" y="30" fill="#64748b" fontSize="9">569.00 sq.ft (35.5, 43, 33 ft)</text>
                    </g>
                  </g>

                  {/* Left Mini Plot Canvas */}
                  <polygon
                    points="60,60 200,50 210,130 310,145 285,210 70,205"
                    fill="rgba(37, 99, 235, 0.15)"
                    stroke="#2563eb"
                    strokeWidth="2"
                  />
                  <line x1="210" y1="130" x2="60" y2="60" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 2" />
                  <line x1="210" y1="130" x2="70" y2="205" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 2" />
                  <line x1="210" y1="130" x2="285" y2="210" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 2" />

                  {/* Bottom Area Chip Simulation */}
                  <g transform="translate(50, 225)">
                    <rect x="0" y="0" width="280" height="40" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                    <text x="14" y="25" fill="#15803d" fontSize="13" fontWeight="800">1,864.47 sq.ft</text>
                    <text x="140" y="24" fill="#64748b" fontSize="11">(173.2 m² / 1.34 Bigha)</text>
                  </g>
                </g>
              )}

              {/* SCENE 6: SAVE & 4 EXPORT FORMATS */}
              {activeScene === 5 && (
                <g>
                  {/* Export Modal Simulation */}
                  <g transform="translate(130, 20)">
                    <rect x="0" y="0" width="340" height="230" rx="16" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" filter="drop-shadow(0 10px 30px rgba(0,0,0,0.35))" />
                    <rect x="15" y="12" width="310" height="26" rx="6" fill="#f8fafc" />
                    <text x="25" y="30" fill="#0f172a" fontSize="12" fontWeight="800">Export Survey Drawing</text>

                    {/* AutoCAD DXF */}
                    <g transform="translate(20, 50)">
                      <rect x="0" y="0" width="140" height="65" rx="10" fill="#eff6ff" stroke="#bfdbfe" />
                      <text x="15" y="24" fill="#1d4ed8" fontSize="11" fontWeight="bold">AutoCAD (.DXF)</text>
                      <text x="15" y="42" fill="#64748b" fontSize="8">CAD Vector 1:1 Scale</text>
                    </g>

                    {/* PDF Plot Sheet */}
                    <g transform="translate(180, 50)">
                      <rect x="0" y="0" width="140" height="65" rx="10" fill="#faf5ff" stroke="#e9d5ff" />
                      <text x="15" y="24" fill="#7e22ce" fontSize="11" fontWeight="bold">PDF Plot Sheet</text>
                      <text x="15" y="42" fill="#64748b" fontSize="8">Official 3-Page Report</text>
                    </g>

                    {/* SVG Vector */}
                    <g transform="translate(20, 130)">
                      <rect x="0" y="0" width="140" height="65" rx="10" fill="#f0fdf4" stroke="#bbf7d0" />
                      <text x="15" y="24" fill="#15803d" fontSize="11" fontWeight="bold">SVG Vector</text>
                      <text x="15" y="42" fill="#64748b" fontSize="8">Graphic with Labels</text>
                    </g>

                    {/* Excel CSV Data */}
                    <g transform="translate(180, 130)">
                      <rect x="0" y="0" width="140" height="65" rx="10" fill="#fff7ed" stroke="#fed7aa" />
                      <text x="15" y="24" fill="#c2410c" fontSize="11" fontWeight="bold">Survey Data (.CSV)</text>
                      <text x="15" y="42" fill="#64748b" fontSize="8">Excel Field Book Data</text>
                    </g>
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
