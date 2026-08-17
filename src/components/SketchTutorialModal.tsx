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
} from "lucide-react";

export interface TutorialStep {
  id: number;
  icon: typeof PencilRuler;
  titleHi: string;
  titleEn: string;
  descHi: string;
  descEn: string;
  tipHi: string;
  tipEn: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    icon: PencilRuler,
    titleHi: "1. प्लॉट के कोने (Corners) बनाएं और बंद करें",
    titleEn: "1. Tap Canvas to Add Corners & Close Plot",
    descHi: "कैनवास पर कहीं भी टैप करके प्लॉट के कोने (V1, V2, V3, V4...) बनाएं। प्लॉट पूरा होने पर पहले हरे कोने (V1) पर टैप करके बाउंड्री को लॉक व क्लोज़ करें।",
    descEn: "Tap anywhere on the canvas to place plot corner nodes (V1, V2, V3, V4...). To complete the shape, tap the pulsing green ring on corner V1 to close the boundary.",
    tipHi: "टिप: आप 3 कोनों से लेकर 12+ कोनों वाले किसी भी आकार (त्रिभुज, चौकोर, पंचकोण) का खेत/प्लॉट बना सकते हैं।",
    tipEn: "Pro-Tip: You can draw any land parcel shape from 3 corners up to 12+ complex irregular cadastral vertices.",
  },
  {
    id: 2,
    icon: GitCommit,
    titleHi: "2. जमीन की असली भुजाएं और नाप दर्ज करें",
    titleEn: "2. Enter Exact Ground Boundary Measurements",
    descHi: "प्लॉट की किसी भी भुजा (Side) पर क्लिक करें और फीते से नापी गई वास्तविक लंबाई (जैसे 65.5 ft या 20 m) टाइप करके 'Save' दबाएं।",
    descEn: "Click on any outer boundary side to open the measurement popover. Type the exact ground tape distance (e.g. 65.5 ft or 20 m) and click 'Save'.",
    tipHi: "टिप: यूनिट्स को कभी भी ऊपर दायें कोने से Feet, Meter या Yards (गज) में बदला जा सकता है।",
    tipEn: "Pro-Tip: Switch between Survey Feet, Meters, or Yards (Gaj) anytime from the top-right unit selector.",
  },
  {
    id: 3,
    icon: Triangle,
    titleHi: "3. विकर्ण (Diagonals) जोड़ें और 100% सटीक रकबा पाएं",
    titleEn: "3. Add Diagonals & Build 100% True Triangles",
    descHi: "तिरछे और आड़ा-टेढ़ा (Irregular) प्लॉट में आमने-सामने का औसत निकालने से रकबे में भारी नुकसान होता है। 'Diagonals' बटन दबाकर विकर्ण नापें, जिससे प्लॉट त्रिभुजों (T1, T2) में बंटकर 100% सही क्षेत्रफल देता है।",
    descEn: "Traditional length × width averaging causes massive land area errors on irregular land. Tap 'Diagonals' to connect survey diagonals and unlock exact Heron's triangulation (T1, T2).",
    tipHi: "पटवारी नियम: 4-भुजा वाले प्लॉट में केवल 1 विकर्ण और 5-भुजा वाले में 2 विकर्ण नापना अनिवार्य होता है।",
    tipEn: "Survey Law: An irregular 4-sided plot needs only 1 diagonal; a 5-sided plot needs 2 diagonals to lock its exact geometric area.",
  },
  {
    id: 4,
    icon: Move,
    titleHi: "4. रोटरी ग्रिप से कोने खींचें और कोण देखें",
    titleEn: "4. Fine-Tune Corners with Rotary Grip & Angle Inspect",
    descHi: "किसी भी कोने (Vertex) पर टैप करने पर एक ड्रैग हैंडल प्रकट होता है। उसे खींचकर आप प्लॉट का झुकाव और कोनों के कोण (Degrees) रीयल-टाइम में एडजस्ट कर सकते हैं।",
    descEn: "Tap any corner node to reveal the interactive Offset Drag Handle. Drag it smoothly to adjust the corner swing and inspect internal degrees in real-time.",
    tipHi: "टिप: कोने पर डबल-टैप करके आप कोण (Degrees) को सीधे टाइप भी कर सकते हैं।",
    tipEn: "Pro-Tip: Double-tap any corner to directly input exact field compass degrees.",
  },
  {
    id: 5,
    icon: FileSpreadsheet,
    titleHi: "5. सरकारी नक़्शा PDF रिपोर्ट व AutoCAD DXF एक्सपोर्ट",
    titleEn: "5. Export Official Survey PDF & AutoCAD DXF",
    descHi: "काम पूरा होने पर 'Export' बटन दबाएं। आप एक क्लिक में आधिकारिक PDF नक़्शा रिपोर्ट, AutoCAD (.DXF), SVG ड्रॉइंग और Excel CSV डेटा डाउनलोड कर सकते हैं।",
    descEn: "Once your survey drawing is ready, tap 'Export' to generate an official PDF Survey Report with title block, AutoCAD (.DXF) 1:1 vector drawings, and Excel CSV coordinates.",
    tipHi: "टिप: PDF रिपोर्ट में पूरे प्लॉट का नक्शा, विकर्ण, त्रिभुज तालिका और बीघा/बिस्वा/वर्गफुट में कुल रकबा शामिल होता है।",
    tipEn: "Pro-Tip: The PDF includes the complete plot diagram, diagonal breakdown table, and area summaries in Bigha, Biswa, Gaj, and Sq.Ft.",
  },
];

interface SketchTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSamplePlot?: () => void;
}

export function SketchTutorialModal({ isOpen, onClose, onLoadSamplePlot }: SketchTutorialModalProps) {
  const [lang, setLang] = useState<"hi" | "en">("hi");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [animProgress, setAnimProgress] = useState(0);

  // Auto-play timeline timer
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const interval = setInterval(() => {
      setAnimProgress((prev) => {
        if (prev >= 100) {
          setActiveStepIndex((curr) => (curr + 1) % TUTORIAL_STEPS.length);
          return 0;
        }
        return prev + 2; // ~5 seconds per step
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isPlaying]);

  if (!isOpen) return null;

  const currentStep = TUTORIAL_STEPS[activeStepIndex];

  const handleNext = () => {
    setActiveStepIndex((curr) => Math.min(TUTORIAL_STEPS.length - 1, curr + 1));
    setAnimProgress(0);
  };

  const handlePrev = () => {
    setActiveStepIndex((curr) => Math.max(0, curr - 1));
    setAnimProgress(0);
  };

  return (
    <div className="sketch-tutorial-backdrop" onClick={onClose}>
      <div className="sketch-tutorial-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="sketch-tutorial-header">
          <div className="sketch-tutorial-title-group">
            <span className="sketch-tutorial-badge">
              <Sparkles size={13} /> {lang === "hi" ? "वीडियो गाइड" : "Video Guide"}
            </span>
            <h3>{lang === "hi" ? "Sketch Pad चलाना सीखें" : "Master Sketch Pad in 2 Minutes"}</h3>
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

        {/* Body */}
        <div className="sketch-tutorial-body">
          {/* Animated Interactive Stage */}
          <div className="sketch-tutorial-stage">
            <div className="sketch-stage-grid" />

            <svg className="sketch-stage-svg" viewBox="0 0 600 280">
              {/* Step 1 Animation: Node Drawing */}
              {activeStepIndex === 0 && (
                <g>
                  {/* Nodes and Polyline */}
                  <polygon
                    points="140,80 440,70 480,210 160,220"
                    fill="rgba(37, 99, 235, 0.15)"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                  />
                  {/* Pulsing Start Node V1 */}
                  <circle cx="140" cy="80" r="16" fill="none" stroke="#22c55e" strokeWidth="2.5" opacity="0.8">
                    <animate attributeName="r" values="8;20;8" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="140" cy="80" r="7" fill="#22c55e" />
                  <text x="140" y="55" fill="#22c55e" fontSize="12" fontWeight="bold" textAnchor="middle">V1 (Tap to Close)</text>

                  <circle cx="440" cy="70" r="7" fill="#3b82f6" />
                  <text x="440" y="50" fill="#93c5fd" fontSize="12" fontWeight="bold" textAnchor="middle">V2</text>

                  <circle cx="480" cy="210" r="7" fill="#3b82f6" />
                  <text x="505" y="220" fill="#93c5fd" fontSize="12" fontWeight="bold" textAnchor="start">V3</text>

                  <circle cx="160" cy="220" r="7" fill="#3b82f6" />
                  <text x="135" y="235" fill="#93c5fd" fontSize="12" fontWeight="bold" textAnchor="end">V4</text>
                </g>
              )}

              {/* Step 2 Animation: Dimension Labels */}
              {activeStepIndex === 1 && (
                <g>
                  <polygon
                    points="140,80 440,70 480,210 160,220"
                    fill="rgba(37, 99, 235, 0.12)"
                    stroke="#3b82f6"
                    strokeWidth="3"
                  />
                  {/* Dimension Badges */}
                  <g transform="translate(290, 65)">
                    <rect x="-35" y="-12" width="70" height="24" rx="12" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                    <text x="0" y="4" fill="#1e3a8a" fontSize="11" fontWeight="800" textAnchor="middle">60.0 ft</text>
                  </g>
                  <g transform="translate(470, 140)">
                    <rect x="-35" y="-12" width="70" height="24" rx="12" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                    <text x="0" y="4" fill="#1e3a8a" fontSize="11" fontWeight="800" textAnchor="middle">45.0 ft</text>
                  </g>
                  <g transform="translate(320, 225)">
                    <rect x="-35" y="-12" width="70" height="24" rx="12" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                    <text x="0" y="4" fill="#1e3a8a" fontSize="11" fontWeight="800" textAnchor="middle">65.0 ft</text>
                  </g>
                  <g transform="translate(135, 150)">
                    <rect x="-35" y="-12" width="70" height="24" rx="12" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                    <text x="0" y="4" fill="#1e3a8a" fontSize="11" fontWeight="800" textAnchor="middle">50.0 ft</text>
                  </g>
                </g>
              )}

              {/* Step 3 Animation: Triangulation Diagonals */}
              {activeStepIndex === 2 && (
                <g>
                  {/* Triangle 1 */}
                  <polygon points="140,80 440,70 160,220" fill="rgba(37, 99, 235, 0.25)" stroke="#3b82f6" strokeWidth="2.5" />
                  <text x="240" y="125" fill="#60a5fa" fontSize="14" fontWeight="800" textAnchor="middle">Triangle 1 (T1)</text>

                  {/* Triangle 2 */}
                  <polygon points="440,70 480,210 160,220" fill="rgba(34, 197, 94, 0.25)" stroke="#22c55e" strokeWidth="2.5" />
                  <text x="360" y="175" fill="#4ade80" fontSize="14" fontWeight="800" textAnchor="middle">Triangle 2 (T2)</text>

                  {/* Dotted Diagonal */}
                  <line x1="440" y1="70" x2="160" y2="220" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 4" />
                  <g transform="translate(300, 140)">
                    <rect x="-42" y="-12" width="84" height="24" rx="12" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
                    <text x="0" y="4" fill="#92400e" fontSize="11" fontWeight="800" textAnchor="middle">Diag: 75.2 ft</text>
                  </g>
                </g>
              )}

              {/* Step 4 Animation: Rotary Grip Adjustment */}
              {activeStepIndex === 3 && (
                <g>
                  <polygon points="140,80 440,70 480,210 160,220" fill="rgba(37, 99, 235, 0.15)" stroke="#3b82f6" strokeWidth="2.5" />
                  {/* Drag Grip Handle at V2 */}
                  <line x1="440" y1="70" x2="470" y2="35" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
                  <circle cx="470" cy="35" r="14" fill="#f59e0b" stroke="#ffffff" strokeWidth="3">
                    <animate attributeName="r" values="12;16;12" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <text x="470" y="18" fill="#fbbf24" fontSize="11" fontWeight="bold" textAnchor="middle">Drag Grip</text>

                  {/* Corner Angle */}
                  <path d="M 410,73 A 30 30 0 0 0 435,100" fill="none" stroke="#22c55e" strokeWidth="2" />
                  <text x="405" y="105" fill="#4ade80" fontSize="11" fontWeight="bold">92.4°</text>
                </g>
              )}

              {/* Step 5 Animation: Official Survey PDF Report */}
              {activeStepIndex === 4 && (
                <g transform="translate(180, 20)">
                  <rect x="0" y="0" width="240" height="240" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
                  <rect x="15" y="15" width="210" height="25" rx="6" fill="#eff6ff" />
                  <text x="120" y="32" fill="#1e3a8a" fontSize="11" fontWeight="800" textAnchor="middle">PlotScale Survey Report</text>
                  
                  {/* Mini Plot Diagram */}
                  <polygon points="40,80 190,75 205,140 50,145" fill="rgba(37, 99, 235, 0.1)" stroke="#2563eb" strokeWidth="1.5" />
                  <line x1="190" y1="75" x2="50" y2="145" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />

                  {/* Area Details Box */}
                  <rect x="15" y="165" width="210" height="60" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                  <text x="25" y="185" fill="#0f172a" fontSize="11" fontWeight="bold">Total: 2,750 sq.ft</text>
                  <text x="25" y="202" fill="#15803d" fontSize="10" fontWeight="bold">Bigha: 1.02 Bigha</text>
                  <text x="135" y="185" fill="#2563eb" fontSize="10" fontWeight="bold">DXF Ready (1:1)</text>

                  {/* Official Stamp */}
                  <circle cx="190" cy="200" r="14" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" />
                  <text x="190" y="203" fill="#15803d" fontSize="8" fontWeight="bold" textAnchor="middle">VERIFIED</text>
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

          {/* Step Content */}
          <div className="sketch-tutorial-content">
            <div className="sketch-tutorial-step-title">
              <span className="sketch-step-pill">
                Step {activeStepIndex + 1} of {TUTORIAL_STEPS.length}
              </span>
              <h4>{lang === "hi" ? currentStep.titleHi : currentStep.titleEn}</h4>
            </div>

            <p className="sketch-tutorial-desc">
              {lang === "hi" ? currentStep.descHi : currentStep.descEn}
            </p>

            <div className="sketch-tutorial-tip-box">
              <Lightbulb size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>{lang === "hi" ? "सर्वेयर गाइड: " : "Surveyor Tip: "}</strong>
                {lang === "hi" ? currentStep.tipHi : currentStep.tipEn}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <footer className="sketch-tutorial-footer">
          <div className="sketch-tutorial-progress-dots">
            {TUTORIAL_STEPS.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                className={`sketch-dot-btn ${activeStepIndex === idx ? "is-active" : ""}`}
                onClick={() => { setActiveStepIndex(idx); setAnimProgress(0); }}
                title={`Step ${idx + 1}`}
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
              onClick={handlePrev}
              disabled={activeStepIndex === 0}
            >
              <ChevronLeft size={16} />
              <span>{lang === "hi" ? "पीछे" : "Prev"}</span>
            </button>

            <button
              type="button"
              className="sketch-btn-tutorial-next"
              onClick={activeStepIndex === TUTORIAL_STEPS.length - 1 ? onClose : handleNext}
            >
              <span>
                {activeStepIndex === TUTORIAL_STEPS.length - 1
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
