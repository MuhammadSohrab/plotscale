import "./sketchTutorial.css";

import { useState, useEffect, useRef } from "react";
import {
  PlayCircle,
  PauseCircle,
  RotateCcw,
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
    stageTitleHi: "1. उंगली से टैप करके कोने (V1 to V4) बनाएं व क्लोज़ करें",
    stageTitleEn: "1. Finger Tap to Draw Corners (V1 to V4) & Close Plot",
    descHi: "स्क्रीन पर उंगली (Finger) से एक-एक करके 4 कोने लगाएं। जब चौथा कोना बन जाए, तो पहले हरे कोने (V1) पर टैप करके बाउंड्री को क्लोज़ (Lock) करें।",
    descEn: "Watch the finger tap to place corner nodes (V1, V2, V3, V4). Tapping the pulsing green ring on V1 completes and locks the closed plot boundary.",
    tipHi: "कैनवास पर आप 3 कोनों से लेकर 10+ कोनों का कैसा भी तिरछा खेत या प्लॉट बना सकते हैं।",
    tipEn: "You can draw any shape from 3 to 10+ irregular land corners.",
  },
  {
    id: 2,
    stageTitleHi: "2. पहली भुजा नापें → बाकी भुजाएं ऑटो-अनुमानित (Estimated) होंगी",
    stageTitleEn: "2. Enter 1st Side → All Other Sides Auto-Calibrate (Estimated)",
    descHi: "जैसे ही आप पहली भुजा (V1-V2) पर 60 ft दर्ज करेंगे, पूरा कैनवास स्केल कैलिब्रेट हो जाएगा और बाकी सभी भुजाओं की अनुमानित नाप (Estimated Lengths) तुरंत दिखने लगेगी।",
    descEn: "Entering the first side (e.g. 60 ft on V1-V2) instantly sets the real survey scale, automatically generating estimated lengths on all remaining sides.",
    tipHi: "स्केल सेट होने के बाद एक-एक करके बाकी भुजाओं की असली फीते वाली नाप दर्ज करें।",
    tipEn: "After scale calibration, enter the exact ground tape distances for each boundary side.",
  },
  {
    id: 3,
    stageTitleHi: "3. विकर्ण (Diagonal) नापें → त्रिभुज (T1 + T2) व 100% सही रकबा",
    stageTitleEn: "3. Add Diagonal (V1-V3) → True Survey Triangulation (T1 + T2)",
    descHi: "'Diagonals' मोड में जाकर V1 से V3 का विकर्ण (85 ft) दर्ज करें। प्लॉट दो त्रिभुजों (T1 व T2) में बंटकर 100% सही गणितीय रकबा (3,620 sq.ft / 1.34 बीघा) लॉक कर देगा।",
    descEn: "Tap 'Diagonals' to connect V1 to V3 with an 85 ft diagonal. The plot divides into Heron's Triangles (T1 + T2) for 100% exact mathematical area without averaging errors.",
    tipHi: "पटवारी फॉर्मूला: बिना विकर्ण के तिरछे प्लॉट का सही रकबा निकालना असंभव होता है।",
    tipEn: "Cadastral Rule: Diagonals eliminate the dangerous average length × width land loss trap.",
  },
  {
    id: 4,
    stageTitleHi: "4. सरकारी नक़्शा PDF रिपोर्ट व AutoCAD DXF एक्सपोर्ट",
    stageTitleEn: "4. Generate Official Survey PDF Report & AutoCAD DXF",
    descHi: "'Export' पर क्लिक करके आधिकारिक सरकारी मानक वाली PDF रिपोर्ट (जिसमें नक़्शा, भुजाएं, विकर्ण, त्रिभुज तालिका व बीघा रकबा होता है) और AutoCAD (.DXF) फाइल डाउनलोड करें।",
    descEn: "Click 'Export' to generate a formal survey PDF sheet with title block, plot diagram, diagonals breakdown table, and 1:1 AutoCAD (.DXF) vector drawing.",
    tipHi: "PDF रिपोर्ट सीधे प्रिंट करके क्लाइंट, कोर्ट या रजिस्ट्री में संलग्न की जा सकती है।",
    tipEn: "Print-ready PDF report formatted for land registry, clients, and official records.",
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
  
  // Animation Sub-Phase inside the active scene (0 to 100 timeline)
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
          // Advance to next scene automatically
          setActiveScene((curr) => (curr + 1) % TUTORIAL_SCENES.length);
          return 0;
        }
        return prev + 1.25;
      });
    }, 80);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, activeScene]);

  if (!isOpen) return null;

  const currentSceneData = TUTORIAL_SCENES[activeScene];

  // Coordinates of the tutorial simulation plot
  const ptV1 = { x: 150, y: 70 };
  const ptV2 = { x: 450, y: 60 };
  const ptV3 = { x: 480, y: 220 };
  const ptV4 = { x: 160, y: 230 };

  // Calculate finger pointer position based on scene and frame
  let fingerPos = { x: 150, y: 70, opacity: 0, tapping: false };
  let nodeCount = 0;
  let isClosed = false;

  if (activeScene === 0) {
    // Scene 1: Step-by-step drawing with finger
    if (frame < 20) {
      // Move to V1 and tap
      const t = frame / 20;
      fingerPos = { x: 80 + (ptV1.x - 80) * t, y: 150 + (ptV1.y - 150) * t, opacity: 1, tapping: frame > 16 };
      nodeCount = frame >= 18 ? 1 : 0;
    } else if (frame < 40) {
      // Move to V2 and tap
      const t = (frame - 20) / 20;
      fingerPos = { x: ptV1.x + (ptV2.x - ptV1.x) * t, y: ptV1.y + (ptV2.y - ptV1.y) * t, opacity: 1, tapping: frame > 36 };
      nodeCount = frame >= 38 ? 2 : 1;
    } else if (frame < 60) {
      // Move to V3 and tap
      const t = (frame - 40) / 20;
      fingerPos = { x: ptV2.x + (ptV3.x - ptV2.x) * t, y: ptV2.y + (ptV3.y - ptV2.y) * t, opacity: 1, tapping: frame > 56 };
      nodeCount = frame >= 58 ? 3 : 2;
    } else if (frame < 80) {
      // Move to V4 and tap
      const t = (frame - 60) / 20;
      fingerPos = { x: ptV3.x + (ptV4.x - ptV3.x) * t, y: ptV3.y + (ptV4.y - ptV3.y) * t, opacity: 1, tapping: frame > 76 };
      nodeCount = frame >= 78 ? 4 : 3;
    } else {
      // Move back to V1 (green pulsing ring) and close
      const t = (frame - 80) / 20;
      fingerPos = { x: ptV4.x + (ptV1.x - ptV4.x) * t, y: ptV4.y + (ptV1.y - ptV4.y) * t, opacity: 1, tapping: frame > 94 };
      nodeCount = 4;
      isClosed = frame >= 95;
    }
  } else {
    nodeCount = 4;
    isClosed = true;
  }

  return (
    <div className="sketch-tutorial-backdrop" onClick={onClose}>
      <div className="sketch-tutorial-modal" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <header className="sketch-tutorial-header">
          <div className="sketch-tutorial-title-group">
            <span className="sketch-tutorial-badge">
              <Sparkles size={13} /> {lang === "hi" ? "लाइव वीडियो ट्यूटोरियल" : "Live Video Simulation"}
            </span>
            <h3>{lang === "hi" ? "Sketch Pad चलाना सीखें (स्टेप-बाय-स्टेप)" : "Learn Sketch Pad Step-by-Step"}</h3>
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

        {/* Video Simulation Canvas Stage */}
        <div className="sketch-tutorial-body">
          <div className="sketch-tutorial-stage">
            <div className="sketch-stage-grid" />

            <svg className="sketch-stage-svg" viewBox="0 0 600 280">
              {/* SCENE 1: DRAWING CORNERS AND CLOSING */}
              {activeScene === 0 && (
                <g>
                  {/* Drawing Lines connecting placed nodes */}
                  {nodeCount >= 2 && <line x1={ptV1.x} y1={ptV1.y} x2={ptV2.x} y2={ptV2.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {nodeCount >= 3 && <line x1={ptV2.x} y1={ptV2.y} x2={ptV3.x} y2={ptV3.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {nodeCount >= 4 && <line x1={ptV3.x} y1={ptV3.y} x2={ptV4.x} y2={ptV4.y} stroke="#2563eb" strokeWidth="2.5" />}
                  {isClosed && <line x1={ptV4.x} y1={ptV4.y} x2={ptV1.x} y2={ptV1.y} stroke="#2563eb" strokeWidth="2.5" />}

                  {/* Shaded Closed Area */}
                  {isClosed && (
                    <polygon
                      points={`${ptV1.x},${ptV1.y} ${ptV2.x},${ptV2.y} ${ptV3.x},${ptV3.y} ${ptV4.x},${ptV4.y}`}
                      fill="rgba(37, 99, 235, 0.15)"
                    />
                  )}

                  {/* Pulsing Green Close Target Ring at V1 */}
                  {nodeCount >= 1 && (
                    <g>
                      <circle cx={ptV1.x} cy={ptV1.y} r="18" fill="none" stroke="#22c55e" strokeWidth="2.5" opacity="0.8">
                        <animate attributeName="r" values="10;22;10" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={ptV1.x} cy={ptV1.y} r="8" fill="#22c55e" />
                      <text x={ptV1.x} y={ptV1.y - 14} fill="#22c55e" fontSize="11" fontWeight="800" textAnchor="middle">
                        {nodeCount < 4 ? "V1" : "Tap to Close (V1)"}
                      </text>
                    </g>
                  )}

                  {/* Node V2 */}
                  {nodeCount >= 2 && (
                    <g>
                      <circle cx={ptV2.x} cy={ptV2.y} r="7" fill="#2563eb" />
                      <text x={ptV2.x} y={ptV2.y - 12} fill="#93c5fd" fontSize="11" fontWeight="800" textAnchor="middle">V2</text>
                    </g>
                  )}

                  {/* Node V3 */}
                  {nodeCount >= 3 && (
                    <g>
                      <circle cx={ptV3.x} cy={ptV3.y} r="7" fill="#2563eb" />
                      <text x={ptV3.x + 14} y={ptV3.y + 6} fill="#93c5fd" fontSize="11" fontWeight="800">V3</text>
                    </g>
                  )}

                  {/* Node V4 */}
                  {nodeCount >= 4 && (
                    <g>
                      <circle cx={ptV4.x} cy={ptV4.y} r="7" fill="#2563eb" />
                      <text x={ptV4.x - 14} y={ptV4.y + 6} fill="#93c5fd" fontSize="11" fontWeight="800" textAnchor="end">V4</text>
                    </g>
                  )}

                  {/* Animated Touch Ripple */}
                  {fingerPos.tapping && (
                    <circle cx={fingerPos.x} cy={fingerPos.y} r="20" fill="none" stroke="#60a5fa" strokeWidth="2.5">
                      <animate attributeName="r" values="5;28" dur="0.4s" repeatCount="1" />
                      <animate attributeName="opacity" values="1;0" dur="0.4s" repeatCount="1" />
                    </circle>
                  )}

                  {/* Virtual Finger Cursor */}
                  {fingerPos.opacity > 0 && (
                    <g transform={`translate(${fingerPos.x}, ${fingerPos.y})`} style={{ transition: "transform 0.08s linear" }}>
                      <circle cx="0" cy="0" r="14" fill="rgba(255, 255, 255, 0.25)" stroke="#ffffff" strokeWidth="2" />
                      <path
                        d="M 0 0 L 14 24 L 6 22 L 2 32 L -4 30 L 0 20 L -8 20 Z"
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}
                </g>
              )}

              {/* SCENE 2: ENTERING 1ST SIDE & AUTO-CALIBRATING ESTIMATED LENGTHS */}
              {activeScene === 1 && (
                <g>
                  <polygon
                    points={`${ptV1.x},${ptV1.y} ${ptV2.x},${ptV2.y} ${ptV3.x},${ptV3.y} ${ptV4.x},${ptV4.y}`}
                    fill="rgba(37, 99, 235, 0.12)"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                  />

                  {/* Side 1 (Locked 60 ft) */}
                  <g transform="translate(300, 52)">
                    <rect x="-42" y="-12" width="84" height="24" rx="12" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                    <text x="0" y="4" fill="#1e3a8a" fontSize="11" fontWeight="800" textAnchor="middle">
                      {frame < 35 ? "Tap to Set" : "60.0 ft (Locked)"}
                    </text>
                  </g>

                  {/* Side 2 (Auto-Estimated -> Locked 50 ft) */}
                  <g transform="translate(475, 140)">
                    <rect
                      x="-42"
                      y="-12"
                      width="84"
                      height="24"
                      rx="12"
                      fill={frame > 60 ? "#ffffff" : "#fef3c7"}
                      stroke={frame > 60 ? "#2563eb" : "#f59e0b"}
                      strokeWidth="2"
                    />
                    <text x="0" y="4" fill={frame > 60 ? "#1e3a8a" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame < 35 ? "..." : frame > 60 ? "50.0 ft (Locked)" : "~ 48 ft (Est.)"}
                    </text>
                  </g>

                  {/* Side 3 (Auto-Estimated -> Locked 70 ft) */}
                  <g transform="translate(320, 236)">
                    <rect
                      x="-42"
                      y="-12"
                      width="84"
                      height="24"
                      rx="12"
                      fill={frame > 75 ? "#ffffff" : "#fef3c7"}
                      stroke={frame > 75 ? "#2563eb" : "#f59e0b"}
                      strokeWidth="2"
                    />
                    <text x="0" y="4" fill={frame > 75 ? "#1e3a8a" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame < 35 ? "..." : frame > 75 ? "70.0 ft (Locked)" : "~ 68 ft (Est.)"}
                    </text>
                  </g>

                  {/* Side 4 (Auto-Estimated -> Locked 55 ft) */}
                  <g transform="translate(145, 150)">
                    <rect
                      x="-42"
                      y="-12"
                      width="84"
                      height="24"
                      rx="12"
                      fill={frame > 90 ? "#ffffff" : "#fef3c7"}
                      stroke={frame > 90 ? "#2563eb" : "#f59e0b"}
                      strokeWidth="2"
                    />
                    <text x="0" y="4" fill={frame > 90 ? "#1e3a8a" : "#b45309"} fontSize="10" fontWeight="800" textAnchor="middle">
                      {frame < 35 ? "..." : frame > 90 ? "55.0 ft (Locked)" : "~ 52 ft (Est.)"}
                    </text>
                  </g>

                  {/* Measurement Popover simulation */}
                  {frame > 15 && frame < 40 && (
                    <g transform="translate(240, 95)">
                      <rect x="0" y="0" width="120" height="42" rx="10" fill="#ffffff" stroke="#2563eb" strokeWidth="2" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.3))" />
                      <text x="10" y="16" fill="#64748b" fontSize="9" fontWeight="bold">Input Side Length:</text>
                      <text x="10" y="32" fill="#0f172a" fontSize="13" fontWeight="800">60 ft</text>
                      <rect x="75" y="18" width="38" height="18" rx="5" fill="#22c55e" />
                      <text x="94" y="30" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">Save</text>
                    </g>
                  )}
                </g>
              )}

              {/* SCENE 3: DIAGONALS & TRIANGULATION LOCK */}
              {activeScene === 2 && (
                <g>
                  {/* Triangle 1 (T1) */}
                  <polygon
                    points={`${ptV1.x},${ptV1.y} ${ptV2.x},${ptV2.y} ${ptV3.x},${ptV3.y}`}
                    fill="rgba(37, 99, 235, 0.28)"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                  />
                  <g transform="translate(340, 110)">
                    <rect x="-55" y="-14" width="110" height="28" rx="8" fill="#1e3a8a" opacity="0.9" />
                    <text x="0" y="4" fill="#93c5fd" fontSize="11" fontWeight="800" textAnchor="middle">
                      Triangle 1: 1,480 sq.ft
                    </text>
                  </g>

                  {/* Triangle 2 (T2) */}
                  <polygon
                    points={`${ptV1.x},${ptV1.y} ${ptV3.x},${ptV3.y} ${ptV4.x},${ptV4.y}`}
                    fill="rgba(34, 197, 94, 0.28)"
                    stroke="#22c55e"
                    strokeWidth="2.5"
                  />
                  <g transform="translate(260, 175)">
                    <rect x="-55" y="-14" width="110" height="28" rx="8" fill="#14532d" opacity="0.9" />
                    <text x="0" y="4" fill="#86efac" fontSize="11" fontWeight="800" textAnchor="middle">
                      Triangle 2: 2,140 sq.ft
                    </text>
                  </g>

                  {/* Locked Survey Diagonal V1 to V3 */}
                  <line
                    x1={ptV1.x}
                    y1={ptV1.y}
                    x2={ptV3.x}
                    y2={ptV3.y}
                    stroke="#f59e0b"
                    strokeWidth="3.5"
                    strokeDasharray="6 4"
                  />
                  <g transform="translate(315, 145)">
                    <rect x="-50" y="-12" width="100" height="24" rx="12" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
                    <text x="0" y="4" fill="#92400e" fontSize="11" fontWeight="800" textAnchor="middle">
                      Diagonal: 85.0 ft
                    </text>
                  </g>

                  {/* Live Area Summary Badge Floating */}
                  <g transform="translate(300, 20)">
                    <rect x="-95" y="0" width="190" height="30" rx="15" fill="#22c55e" filter="drop-shadow(0 4px 12px rgba(34, 197, 94, 0.4))" />
                    <text x="0" y="19" fill="#ffffff" fontSize="12" fontWeight="800" textAnchor="middle">
                      Total Area: 3,620 sq.ft (1.34 Bigha)
                    </text>
                  </g>
                </g>
              )}

              {/* SCENE 4: OFFICIAL SURVEY PDF & CAD EXPORT */}
              {activeScene === 3 && (
                <g>
                  {/* PDF Document Sheet Representation */}
                  <g transform="translate(170, 15)">
                    <rect x="0" y="0" width="260" height="250" rx="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" filter="drop-shadow(0 10px 25px rgba(0,0,0,0.4))" />
                    
                    {/* Title Header */}
                    <rect x="15" y="15" width="230" height="28" rx="6" fill="#1e3a8a" />
                    <text x="130" y="33" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
                      PlotScale Official Land Survey Report
                    </text>

                    {/* Cadastral Plot Diagram */}
                    <polygon points="40,80 200,75 215,140 50,145" fill="rgba(37, 99, 235, 0.12)" stroke="#2563eb" strokeWidth="1.5" />
                    <line x1="40" y1="80" x2="215" y2="140" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />

                    {/* Triangles Breakdown Table */}
                    <rect x="15" y="160" width="230" height="75" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                    <text x="25" y="178" fill="#0f172a" fontSize="10" fontWeight="bold">Plot: Khasra No. 104/2</text>
                    <text x="25" y="194" fill="#15803d" fontSize="11" fontWeight="800">Total Area: 3,620 sq.ft (1.34 Bigha)</text>
                    <text x="25" y="210" fill="#64748b" fontSize="9">T1: 1,480 sq.ft | T2: 2,140 sq.ft</text>
                    <text x="25" y="224" fill="#2563eb" fontSize="9" fontWeight="bold">AutoCAD DXF Vector (1:1 Accurate)</text>

                    {/* Official Stamp */}
                    <circle cx="210" cy="200" r="18" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" />
                    <text x="210" y="204" fill="#15803d" fontSize="8" fontWeight="bold" textAnchor="middle">VERIFIED</text>
                  </g>
                </g>
              )}
            </svg>

            {/* Play / Pause Toggle Button */}
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
                <span>{lang === "hi" ? "कैनवास में टेस्ट करें" : "Load Sample in Canvas"}</span>
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
