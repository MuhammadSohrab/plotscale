import "./helpTutorial.css";

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  PencilRuler,
  FileCode2,
  Image,
  MapPinned,
  Calculator,
  Lightbulb,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Triangle,
  Move,
  FileSpreadsheet,
  Download,
  BookOpen,
  HelpCircle,
} from "lucide-react";

type ModuleKey = "sketch" | "cad" | "image" | "map" | "calculator";

interface StepItem {
  stepNum: number;
  titleHi: string;
  titleEn: string;
  descHi: string;
  descEn: string;
  tipHi: string;
  tipEn: string;
  visualType: string;
}

interface ModuleGuide {
  id: ModuleKey;
  icon: typeof PencilRuler;
  titleHi: string;
  titleEn: string;
  subtitleHi: string;
  subtitleEn: string;
  route: string;
  steps: StepItem[];
}

const MODULE_GUIDES: ModuleGuide[] = [
  {
    id: "sketch",
    icon: PencilRuler,
    titleHi: "Sketch Pad (स्केच पैड)",
    titleEn: "Sketch Pad CAD Builder",
    subtitleHi: "कोने बनाना, भुजाओं की नाप, विकर्ण (Diagonals) और सरकारी 3-पेज PDF व DXF एक्सपोर्ट",
    subtitleEn: "Draw polygonal corners, calibrate base line scale, add diagonals and export official 3-page survey reports.",
    route: "/sketch",
    steps: [
      {
        stepNum: 1,
        titleHi: "1. कोने (P1 से P6) बनाना व हरे रिंग पर टैप कर क्लोज़ करना",
        titleEn: "1. Draw Corner Vertices & Tap Green Ring to Close",
        descHi: "स्क्रीन पर उंगली या माउस से 3 से 10+ कोने बनाएं। अंतिम कोना बनाने के बाद पहले कोने (P1) पर दिख रहे हरे पल्सिंग सर्कल पर टैप करके बंद बाउंड्री लॉक करें।",
        descEn: "Click or tap on the canvas to place corner points (P1..P6). Tap the pulsing green circle on P1 to lock and close the parcel boundary.",
        tipHi: "ऊपर बने Undo (Ctrl+Z) और Redo से आप कोई भी गलत कोना तुरंत सुधार सकते हैं।",
        tipEn: "Use Undo (Ctrl+Z) and Redo buttons to effortlessly fix any misplaced node.",
        visualType: "sketch-nodes",
      },
      {
        stepNum: 2,
        titleHi: "2. पहली भुजा की नाप (24 ft) → ऑटो-स्केल व लाइनों का खिंचना (Dynamic Stretch)",
        titleEn: "2. Set Base Line (24 ft) → Real-Time Boundary Stretching",
        descHi: "पहली भुजा (P1-P2) पर 24 ft दर्ज करते ही पूरा कैनवास स्केल कैलिब्रेट हो जाता है और बाकी सभी भुजाओं की अनुमानित नाप (Estimated Lengths) दिखने लगती है।",
        descEn: "Entering 24 ft on P1-P2 sets the real survey scale, dynamically resizing and stretching boundaries to match physical proportions.",
        tipHi: "स्केल सेट होने के बाद बाकी भुजाओं की असली फीते वाली नाप (35, 18, 26, 43, 56 ft) लॉक करें।",
        tipEn: "After baseline scale is set, enter the exact tape measurements for all remaining boundary sides.",
        visualType: "sketch-scale",
      },
      {
        stepNum: 3,
        titleHi: "3. रोटरी ग्रिप हैंडल (Offset Drag) और कोनों के कोण (Degrees)",
        titleEn: "3. Rotary Offset Drag Handle & Corner Degrees Inspector",
        descHi: "किसी भी कोने पर टैप करके Offset Drag Handle को खींचें जिससे कोने का झुकाव बदलता है। कोने पर डबल-टैप करके सीधे कम्पास डिग्री (कोण) भी दर्ज कर सकते हैं।",
        descEn: "Tap any corner node to reveal the Rotary Drag Grip. Drag it to adjust corner orientation or double-tap to input precise degree angles.",
        tipHi: "चारों कोनों के कोण (जैसे 89.5°, 90.2°) देखने से पता चलता है कि प्लॉट गुनिया में है या तिरछा।",
        tipEn: "Corner angles verify if boundaries meet at 90° right angles or are irregular.",
        visualType: "sketch-rotary",
      },
      {
        stepNum: 4,
        titleHi: "4. Diagonals डॉक (Add ➕, Less ➖, Finish ✔️) व सही 2D त्रिभुज लॉक",
        titleEn: "4. Diagonals Setup Dock (Add, Less, Finish) & Rigid Triangulation",
        descHi: "'Diagonals' मोड में जाकर Base V3 से V1 (40ft), V6 (33ft) व V5 (35.5ft) जोड़ें। प्लॉट तुरंत 4 त्रिभुजों में बंटकर 100% सही रकबा (1,864.47 sq.ft) लॉक कर देगा।",
        descEn: "In Diagonals mode, select Base V3 and connect to V1 (40 ft), V6 (33 ft), and V5 (35.5 ft). The plot divides into 4 exact triangles with 0% distortion.",
        tipHi: "पटवारी नियम: बिना विकर्ण के तिरछे प्लॉट का सही रकबा निकालना गणितीय रूप से असंभव है।",
        tipEn: "Survey Law: Triangulation via diagonals prevents the dangerous average length x width error.",
        visualType: "sketch-diagonals",
      },
      {
        stepNum: 5,
        titleHi: "5. Triangles डॉक (T1 to T4) और रकबा यूनिट कन्वर्टर (Bigha, Biswa, Gaj)",
        titleEn: "5. Triangles Breakdown List & Area Unit Switcher",
        descHi: "'Triangles (4)' पर क्लिक करके हर त्रिभुज का अलग-अलग क्षेत्रफल और भुजाएं देखें। नीचे एरिया चिप से वर्गफुट, वर्गमीटर, बीघा, बिस्वा, कट्टा व एकड़ में कुल रकबा देखें।",
        descEn: "Open 'Triangles (4)' to review each sub-triangle's area. Toggle the Area Chip to view the land size in Sq.ft, Sq.m, Bigha, Biswa, Gaj, and Acres.",
        tipHi: "त्रिभुज कार्ड पर माउस ले जाने से कैनवास पर वही त्रिभुज हाइलाइट हो जाता है।",
        tipEn: "Hovering over any triangle card highlights that specific survey triangle on the canvas.",
        visualType: "sketch-triangles",
      },
      {
        stepNum: 6,
        titleHi: "6. सरकारी 3-पेज PDF नक़्शा रिपोर्ट व AutoCAD DXF एक्सपोर्ट",
        titleEn: "6. Official 3-Page Survey PDF Sheet & AutoCAD DXF Export",
        descHi: "'Export' से 3 पेजों की सरकारी मानक वाली PDF रिपोर्ट (जिसमें नक़्शा, भुजाएं, विकर्ण, त्रिभुज तालिका व बीघा रकबा होता है) और AutoCAD (.DXF) फाइल डाउनलोड करें।",
        descEn: "Click 'Export' to generate a formal 3-page survey PDF report with title block, full-page plot drawing, diagonal tables, and 1:1 AutoCAD (.DXF) vectors.",
        tipHi: "PDF रिपोर्ट सीधे प्रिंट करके क्लाइंट, कोर्ट या रजिस्ट्री में संलग्न की जा सकती है।",
        tipEn: "Print-ready PDF report formatted for land registry, clients, and official records.",
        visualType: "sketch-export",
      },
    ],
  },
  {
    id: "cad",
    icon: FileCode2,
    titleHi: "CAD Measurement (ऑटोकैड नाप-तौल)",
    titleEn: "AutoCAD Measurement Module",
    subtitleHi: "AutoCAD .dwg / .dxf फाइल खोलना, लेयर्स मैनेज करना और 1-क्लिक में प्लॉट का रकबा नापना",
    subtitleEn: "Open AutoCAD .dwg / .dxf drawings, manage layers, and measure closed parcels with 1-click area detection.",
    route: "/cad-measure",
    steps: [
      {
        stepNum: 1,
        titleHi: "1. AutoCAD (.DWG / .DXF) फाइल अपलोड करना",
        titleEn: "1. Upload AutoCAD (.DWG / .DXF) File",
        descHi: "अपने कंप्यूटर से कोई भी आर्किटेक्चरल या लेआउट .dwg / .dxf फाइल अपलोड करें या 'Sample DWG' बटन दबाकर तुरंत टेस्ट करें।",
        descEn: "Upload any AutoCAD .dwg or .dxf vector file from your computer or click 'Sample DWG' to load a demo cadastral drawing.",
        tipHi: "LibreDWG WebAssembly इंजन सीधे आपके ब्राउज़र में बिना किसी सर्वर के फाइल डिकोड करता है।",
        tipEn: "Our client-side WASM engine decodes binary DWG files locally on your device with 100% privacy.",
        visualType: "cad-upload",
      },
      {
        stepNum: 2,
        titleHi: "2. लेयर मैनेजर (Layer Visibility Controls)",
        titleEn: "2. Layer Manager & Visibility Toggle",
        descHi: "'Layers' बटन पर क्लिक करके गैर-ज़रूरी लेयर्स (जैसे ग्रिड, डाइमेंशन्स, टेक्स्ट) को ऑन/ऑफ करें ताकि केवल जमीन की बाउंड्री साफ दिखाई दे।",
        descEn: "Open the Layers Manager drawer to isolate boundary lines by toggling off text, dimensions, and background grids.",
        tipHi: "लेयर का रंग और नाम देखकर आप सही बाउंड्री लेयर पहचान सकते हैं।",
        tipEn: "Check layer colors to easily identify property boundary lines from road networks.",
        visualType: "cad-layers",
      },
      {
        stepNum: 3,
        titleHi: "3. 1-क्लिक पार्सल पिक टूल (Parcel Pick Tool)",
        titleEn: "3. 1-Click Parcel Pick & Instant Area Calculation",
        descHi: "'Pick Parcel' टूल एक्टिवेट करके ड्राइंग के किसी भी बंद प्लॉट पर क्लिक करें। सिस्टम तुरंत प्लॉट की सीमा पहचान कर वर्गफुट, वर्गमीटर, गज व बीघा में रकबा निकाल देता है।",
        descEn: "Activate the 'Pick Parcel' tool and click inside any closed polygon to automatically detect vertices and calculate 1:1 ground area.",
        tipHi: "ऑटो-स्नैप इंजन कोनों पर मैग्नेटिक स्नैप करके सटीक नाप सुनिश्चित करता है।",
        tipEn: "The Object Snap (O-Snap) engine locks onto exact vertex coordinates.",
        visualType: "cad-pick",
      },
      {
        stepNum: 4,
        titleHi: "4. फीता नाप टूल (Tape Measure Distance)",
        titleEn: "4. Precision Tape Measure Tool",
        descHi: "'Tape Measure' टूल चुनकर ड्राइंग के किन्हीं भी दो कोनों या रोड लाइनों के बीच क्लिक करें। दोनों बिंदुओं के बीच की सटीक दूरी स्क्रीन पर दिखेगी।",
        descEn: "Select the Tape Measure tool and click any two points to instantly measure linear distance and road frontage.",
        tipHi: "यह टूल रास्ते की चौड़ाई या फ्रंट नापने के लिए सबसे उपयोगी है।",
        tipEn: "Ideal for verifying road widths, setbacks, and boundary frontage.",
        visualType: "cad-tape",
      },
    ],
  },
  {
    id: "image",
    icon: Image,
    titleHi: "Image Trace (नक्शा व इमेज ट्रेस)",
    titleEn: "Image & Map Trace Vectorizer",
    subtitleHi: "गाँव का अक्स शजरा, फोटो या PDF नक्शा लोड करके 1-क्लिक में खसरा ट्रेस करना",
    subtitleEn: "Vectorize scanned cadastral village maps (Shajra) and multi-page PDFs with 1-click boundary tracing.",
    route: "/image-trace",
    steps: [
      {
        stepNum: 1,
        titleHi: "1. अक्स शजरा (Village Map) या Multi-Page PDF अपलोड करना",
        titleEn: "1. Upload Village Shajra or Multi-Page PDF",
        descHi: "गाँव के शजरे की फोटो, स्कैन या मल्टी-पेज PDF अपलोड करें। मल्टी-पेज PDF में से आप मनचाहा पेज प्रीव्यू करके चुन सकते हैं।",
        descEn: "Upload high-res cadastral photos, scans, or multi-page PDFs. Use the built-in Page Selector modal to preview and pick specific sheets.",
        tipHi: "हाई-रेज़ोल्यूशन इमेज अपलोड करने से खसरे की रेखाएं ज्यादा साफ डिटेक्ट होती हैं।",
        tipEn: "Higher resolution scans yield crisp automatic contour detection.",
        visualType: "image-upload",
      },
      {
        stepNum: 2,
        titleHi: "2. 1-क्लिक खसरा ट्रेस (Instant Parcel Vectorization)",
        titleEn: "2. 1-Click Khasra Plot Vector Trace",
        descHi: "कैनवास पर किसी भी खसरा नंबर के अंदर क्लिक करें। एआई-बेस्ड कंटूर इंजन तुरंत काली स्याही वाली बाउंड्री को नीली वेक्टर लाइन में बदल देगा।",
        descEn: "Click inside any Khasra boundary. The vector engine traces the black ink lines into clean geometric vector boundaries.",
        tipHi: "कंट्रास्ट या थ्रेशोल्ड स्लाइडर से पुरानी या धुंधली स्याही को भी साफ किया जा सकता है।",
        tipEn: "Use the Threshold and Contrast sliders to clean up faint or faded ink lines.",
        visualType: "image-trace",
      },
      {
        stepNum: 3,
        titleHi: "3. स्केल कैलिब्रेशन (जमीन की सही नाप सेट करना)",
        titleEn: "3. Scale Calibration via Reference Line",
        descHi: "नक्शे पर किसी भी ज्ञात रेखा (जैसे 100 जरीब या 66 फीट) पर दो बिंदु लगाकर उसकी वास्तविक दूरी दर्ज करें। पूरा नक्शा उस पैमाने पर सेट हो जाएगा।",
        descEn: "Place two markers along a known reference line (e.g. 100 Gunter chain / 66 ft) and enter its ground distance to calibrate the whole sheet.",
        tipHi: "कैलिब्रेशन के बाद हर खसरे का बीघा और वर्गफुट रकबा 100% सही निकलता है।",
        tipEn: "Once calibrated, all traced plots automatically compute exact legal land areas.",
        visualType: "image-scale",
      },
    ],
  },
  {
    id: "map",
    icon: MapPinned,
    titleHi: "Map Measurement (सैटेलाइट मैप सर्वे)",
    titleEn: "Satellite GPS Map Surveying",
    subtitleHi: "गूगल सैटेलाइट मैप पर जमीन मार्क करना, रास्ता (Entrance) सेट करना व GPS बाउंड्री",
    subtitleEn: "Survey land parcels directly on satellite maps with GPS coordinate pins and entrance gates.",
    route: "/calculator?mode=map_mode",
    steps: [
      {
        stepNum: 1,
        titleHi: "1. लोकेशन सर्च व सैटेलाइट व्यू सेट करना",
        titleEn: "1. Search Location & Toggle Satellite View",
        descHi: "सर्च बार में गाँव, खसरा नंबर या शहर का नाम टाइप करके सीधे अपनी जमीन पर पहुँचें और Satellite मोड ऑन करें।",
        descEn: "Type your village, city, or coordinate in the search bar to zoom directly to your land parcel on high-res satellite imagery.",
        tipHi: "GPS बटन दबाकर आप अपने वर्तमान लोकेशन पर भी तुरंत पहुँच सकते हैं।",
        tipEn: "Tap the GPS button to instantly center the map on your live field location.",
        visualType: "map-search",
      },
      {
        stepNum: 2,
        titleHi: "2. खेत के चारों कोनों पर पिन लगाना",
        titleEn: "2. Drop Pins on Field Boundaries",
        descHi: "खेत की मेड़ों (Boundaries) पर 4 या अधिक पिन लगाएं। बाउंड्री जुड़ते ही कुल क्षेत्रफल और परिमाप (Perimeter) दिखने लगेगा।",
        descEn: "Drop pins on the corners of the plot. The polygon connects to display real-time land area and perimeter distances.",
        tipHi: "पिन को ड्रैग करके आप बाउंड्री को मेड़ के बिल्कुल सटीक ऊपर सेट कर सकते हैं।",
        tipEn: "Drag any pin to fine-tune boundary alignment with natural tree lines or bunds.",
        visualType: "map-pins",
      },
      {
        stepNum: 3,
        titleHi: "3. रास्ता (Entrance Gate) सेट करना व KML/PDF एक्सपोर्ट",
        titleEn: "3. Set Entrance Gate & Export KML / GeoJSON",
        descHi: "मुख्य सड़क से खेत के प्रवेश द्वार पर 'Gate' पिन सेट करें। सर्वे पूरा होने पर Google Earth KML या PDF रिपोर्ट डाउनलोड करें।",
        descEn: "Set an Entrance Gate marker along the access road. Export your survey as a Google Earth KML, GeoJSON, or PDF map sheet.",
        tipHi: "KML फाइल को सीधे Google Earth में खोलकर 3D में देखा जा सकता है।",
        tipEn: "KML files open seamlessly in Google Earth for 3D terrain inspection.",
        visualType: "map-export",
      },
    ],
  },
  {
    id: "calculator",
    icon: Calculator,
    titleHi: "Area Calculator & Formulas (रकबा गणित व सूत्र)",
    titleEn: "Heron's Triangulation & Bigha Formulas",
    subtitleHi: "हीरोन का त्रिकोण सूत्र, औसत नाप के नुकसान, और राज्य-वार बीघा/बिस्वा/कट्टा कनवर्टर",
    subtitleEn: "Heron's formula, why boundary averaging loses land, and state-wise Bigha conversion standards.",
    route: "/calculator",
    steps: [
      {
        stepNum: 1,
        titleHi: "1. औसत नाप [(L1+L2)/2 × (W1+W2)/2] का धोखा",
        titleEn: "1. The Dangerous Land Averaging Trap",
        descHi: "तिरछे खेत में आमने-सामने की भुजाओं को जोड़कर आधा करने से रकबा गलत निकलता है और किसान/खरीदार को 5% से 15% जमीन का नुकसान हो जाता है।",
        descEn: "Using simple average length × average width on irregular land causes severe mathematical overestimation or underestimation (5-15% area error).",
        tipHi: "PlotScale हमेशा 100% सटीक हीरोन त्रिकोण विधि (Heron's Triangulation) का उपयोग करता है।",
        tipEn: "PlotScale strictly uses Heron's Triangulation to eliminate land disputes.",
        visualType: "calc-heron",
      },
      {
        stepNum: 2,
        titleHi: "2. हीरोन का सूत्र (Heron's Formula)",
        titleEn: "2. Mathematical Heron's Formula",
        descHi: "त्रिभुज की तीन भुजाएं a, b, c होने पर अर्ध-परिमाप s = (a+b+c)/2 होता है। क्षेत्रफल = √[s(s-a)(s-b)(s-c)]।",
        descEn: "For a triangle with sides a, b, c: Semi-perimeter s = (a+b+c)/2. Area = √[s(s-a)(s-b)(s-c)].",
        tipHi: "प्लॉट को जितने ज्यादा त्रिभुजों में बांटेंगे, रकबा उतना ही 100% सटीक होगा।",
        tipEn: "Dividing complex polygons into triangles guarantees zero mathematical deviation.",
        visualType: "calc-formula",
      },
      {
        stepNum: 3,
        titleHi: "3. राज्य-वार बीघा मानक (State-Wise Bigha Standards)",
        titleEn: "3. State-Wise Bigha Conversion Standards",
        descHi: "उत्तर प्रदेश (27,000 sq.ft पक्का / 9,000 sq.ft कच्चा), राजस्थान (27,225 sq.ft), बिहार (27,220 sq.ft), मध्य प्रदेश (12,000 / 27,225 sq.ft) आदि में बीघा अलग होता है।",
        descEn: "Bigha varies across regions: UP (27,000 sq.ft Pakka / 9,000 sq.ft Kacha), Rajasthan (27,225 sq.ft), Bihar (27,220 sq.ft), MP (12,000 to 27,225 sq.ft).",
        tipHi: "PlotScale में आप अपनी स्थानीय तहसील के अनुसार कस्टम बीघा भी सेट कर सकते हैं।",
        tipEn: "You can customize your exact local tehsil Bigha definition in Unit Settings.",
        visualType: "calc-bigha",
      },
    ],
  },
];

const FAQS = [
  {
    qHi: "क्या PlotScale का उपयोग करने के लिए इंटरनेट की आवश्यकता है?",
    qEn: "Does PlotScale require an active internet connection?",
    aHi: "नहीं! PlotScale का Sketch Pad, CAD Measurement और Area Calculator 100% ऑफलाइन काम करता है। आपका डेटा आपके ही डिवाइस में IndexedDB में सुरक्षित रहता है।",
    aEn: "No! Sketch Pad, CAD Measurement, and Area Calculator work 100% offline. All plot data is stored securely on your local device.",
  },
  {
    qHi: "तिरछे प्लॉट का रकबा निकालने के लिए विकर्ण (Diagonal) क्यों ज़रूरी है?",
    qEn: "Why is a diagonal strictly required for irregular land measurement?",
    aHi: "चार भुजाओं वाला कोई भी चौकोर प्लॉट बिना विकर्ण के 'फ्लेक्सिबल' (लचीला) होता है। विकर्ण डालने से वह दो स्थिर त्रिभुजों (T1 व T2) में बंट जाता है जिससे रकबा 100% फिक्स हो जाता है।",
    aEn: "A four-sided irregular polygon has infinite possible areas without a diagonal. A diagonal locks the angles into two rigid geometric triangles (T1 & T2).",
  },
  {
    qHi: "AutoCAD DXF फाइल को कंप्यूटर में कैसे खोलें?",
    qEn: "How to open exported AutoCAD DXF files on a computer?",
    aHi: "Sketch Pad या CAD Measure से डाउनलोड की गई .DXF फाइल को आप सीधे AutoCAD, Civil 3D, LibreCAD, DWG TrueView या किसी भी CAD सॉफ्टवेयर में 1:1 स्केल पर खोल सकते हैं।",
    aEn: "Exported .DXF files open natively in AutoCAD, Civil 3D, LibreCAD, or any standard CAD viewer at exact 1:1 real-world dimensions.",
  },
  {
    qHi: "सरकारी 3-पेज PDF रिपोर्ट में क्या-क्या शामिल होता है?",
    qEn: "What is included in the Official 3-Page Survey PDF Report?",
    aHi: "पेज 1 पर खसरा विवरण और त्रिभुज तालिका, पेज 2 पर फुल-पेज प्रोपोर्शनल नक़्शा (क्रॉसहेयर और भुजाओं के लेबल सहित), और पेज 3 पर सभी भुजाओं व विकर्णों की नाप-जोख तालिका होती है।",
    aEn: "Page 1: Title block, Area, and Triangles Breakdown Table. Page 2: High-resolution full-page proportional survey map. Page 3: Boundary dimensions and diagonals inventory.",
  },
];

export function HelpTutorialPage() {
  const [lang, setLang] = useState<"hi" | "en">("hi");
  const [activeModule, setActiveModule] = useState<ModuleKey>("sketch");
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const currentGuide = useMemo(() => {
    return MODULE_GUIDES.find((m) => m.id === activeModule) || MODULE_GUIDES[0];
  }, [activeModule]);

  const filteredSteps = useMemo(() => {
    if (!searchQuery.trim()) return currentGuide.steps;
    const q = searchQuery.toLowerCase();
    return currentGuide.steps.filter((s) => {
      return (
        s.titleHi.toLowerCase().includes(q) ||
        s.titleEn.toLowerCase().includes(q) ||
        s.descHi.toLowerCase().includes(q) ||
        s.descEn.toLowerCase().includes(q) ||
        s.tipHi.toLowerCase().includes(q) ||
        s.tipEn.toLowerCase().includes(q)
      );
    });
  }, [currentGuide, searchQuery]);

  return (
    <div className="help-page-container">
      {/* Top Header */}
      <header className="help-header">
        <div className="help-header-inner">
          <div className="help-brand-group">
            <Link to="/dashboard" className="help-back-btn">
              <ArrowLeft size={16} />
              <span>{lang === "hi" ? "डैशबोर्ड" : "Dashboard"}</span>
            </Link>
            <div className="help-brand-title">
              <h1>{lang === "hi" ? "PlotScale हेल्प एवं ट्यूटोरियल सेंटर" : "PlotScale Help & Knowledge Base"}</h1>
              <p>{lang === "hi" ? "सर्वेक्षण, नक्शा, ऑटोकैड एवं रकबा मापन की सम्पूर्ण गाइड" : "Master land surveying, cadastral maps, CAD & calculations"}</p>
            </div>
          </div>

          <div className="help-header-actions">
            <div className="help-lang-toggle">
              <button
                type="button"
                className={`help-lang-btn ${lang === "hi" ? "is-active" : ""}`}
                onClick={() => setLang("hi")}
              >
                🇮🇳 हिंदी
              </button>
              <button
                type="button"
                className={`help-lang-btn ${lang === "en" ? "is-active" : ""}`}
                onClick={() => setLang("en")}
              >
                🌐 English
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Search Section */}
      <section className="help-hero-banner">
        <span className="help-hero-badge">
          <Sparkles size={14} /> {lang === "hi" ? "ऑफिशियल गाइड एवं ट्यूटोरियल" : "Official Guide & Tutorials"}
        </span>
        <h2 className="help-hero-title">
          {lang === "hi" ? "आप क्या सीखना चाहते हैं?" : "What would you like to learn?"}
        </h2>
        <p className="help-hero-subtitle">
          {lang === "hi"
            ? "PlotScale के सभी 5 टूल्स (Sketch Pad, CAD Measure, Image Trace, Satellite Map, Area Calculator) को स्टेप-बाय-स्टेप समझें।"
            : "Explore comprehensive visual step-by-step guides for all 5 surveying engines with interactive blueprints."}
        </p>

        <div className="help-search-container">
          <Search size={18} className="help-search-icon" />
          <input
            type="text"
            className="help-search-input"
            placeholder={
              lang === "hi"
                ? "खोजें: विकर्ण कैसे डालें, CAD फाइल कैसे खोलें, बीघा फॉर्मूला..."
                : "Search: how to add diagonals, open DWG files, bigha calculation..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Module Selector Tabs */}
      <nav className="help-module-tabs" aria-label="Help Modules">
        {MODULE_GUIDES.map((mod) => {
          const Icon = mod.icon;
          const isActive = mod.id === activeModule;
          return (
            <button
              key={mod.id}
              type="button"
              className={`help-tab-btn ${isActive ? "is-active" : ""}`}
              onClick={() => {
                setActiveModule(mod.id);
                setSearchQuery("");
              }}
            >
              <Icon size={16} />
              <span>{lang === "hi" ? mod.titleHi : mod.titleEn}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Guide Content */}
      <main className="help-main-content">
        <div className="help-guide-header">
          <div className="help-guide-title-box">
            <h2>{lang === "hi" ? currentGuide.titleHi : currentGuide.titleEn}</h2>
            <p>{lang === "hi" ? currentGuide.subtitleHi : currentGuide.subtitleEn}</p>
          </div>
          <Link to={currentGuide.route} className="help-btn-try-tool">
            <span>{lang === "hi" ? "यह टूल खोलें और लाइव टेस्ट करें" : "Open Tool & Try Live"}</span>
            <ExternalLink size={16} />
          </Link>
        </div>

        {/* Step-by-Step Blueprint Cards */}
        <div className="help-steps-grid">
          {filteredSteps.map((step) => (
            <article key={step.stepNum} className="help-step-card">
              <div className="help-step-info">
                <span className="help-step-pill">
                  {lang === "hi" ? `स्टेप ${step.stepNum}` : `Step ${step.stepNum}`}
                </span>
                <h3>{lang === "hi" ? step.titleHi : step.titleEn}</h3>
                <p>{lang === "hi" ? step.descHi : step.descEn}</p>
                <div className="help-step-tip">
                  <Lightbulb size={16} />
                  <div>
                    <strong>{lang === "hi" ? "सर्वेयर टिप: " : "Surveyor Tip: "}</strong>
                    {lang === "hi" ? step.tipHi : step.tipEn}
                  </div>
                </div>
              </div>

              {/* Visual Blueprint Diagram for each step */}
              <div className="help-step-visual">
                <svg viewBox="0 0 400 200">
                  {/* Grid Lines */}
                  <defs>
                    <pattern id="helpGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#helpGrid)" rx="8" />

                  {/* Step Specific Visuals */}
                  {step.visualType === "sketch-nodes" && (
                    <g>
                      <line x1="80" y1="50" x2="220" y2="40" stroke="#2563eb" strokeWidth="2.5" />
                      <line x1="220" y1="40" x2="230" y2="120" stroke="#2563eb" strokeWidth="2.5" />
                      <line x1="230" y1="120" x2="320" y2="130" stroke="#2563eb" strokeWidth="2.5" />
                      <line x1="320" y1="130" x2="300" y2="180" stroke="#2563eb" strokeWidth="2.5" />
                      <line x1="300" y1="180" x2="90" y2="175" stroke="#2563eb" strokeWidth="2.5" />
                      <line x1="90" y1="175" x2="80" y2="50" stroke="#2563eb" strokeWidth="2.5" />
                      <polygon points="80,50 220,40 230,120 320,130 300,180 90,175" fill="rgba(37, 99, 235, 0.15)" />
                      {/* Pulsing ring on P1 */}
                      <circle cx="80" cy="50" r="14" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.8" />
                      <circle cx="80" cy="50" r="6" fill="#22c55e" />
                      <text x="80" y="32" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">P1 (Close Ring)</text>
                      <circle cx="220" cy="40" r="5" fill="#2563eb" />
                      <circle cx="230" cy="120" r="5" fill="#2563eb" />
                      <circle cx="320" cy="130" r="5" fill="#2563eb" />
                      <circle cx="300" cy="180" r="5" fill="#2563eb" />
                      <circle cx="90" cy="175" r="5" fill="#2563eb" />
                    </g>
                  )}

                  {step.visualType === "sketch-scale" && (
                    <g>
                      <polygon points="80,50 220,40 230,120 320,130 300,180 90,175" fill="rgba(37, 99, 235, 0.12)" stroke="#2563eb" strokeWidth="2" />
                      {/* Base Line Pill */}
                      <g transform="translate(150, 35)">
                        <rect x="-35" y="-10" width="70" height="20" rx="10" fill="#ffffff" stroke="#22c55e" strokeWidth="2" />
                        <text x="0" y="4" fill="#15803d" fontSize="9" fontWeight="bold" textAnchor="middle">24 ft 🔒 (Base)</text>
                      </g>
                      <g transform="translate(245, 80)">
                        <rect x="-35" y="-10" width="70" height="20" rx="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
                        <text x="0" y="4" fill="#b45309" fontSize="9" fontWeight="bold" textAnchor="middle">~ 35 ft (Est.)</text>
                      </g>
                      <g transform="translate(195, 185)">
                        <rect x="-35" y="-10" width="70" height="20" rx="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
                        <text x="0" y="4" fill="#b45309" fontSize="9" fontWeight="bold" textAnchor="middle">~ 43 ft (Est.)</text>
                      </g>
                    </g>
                  )}

                  {step.visualType === "sketch-rotary" && (
                    <g>
                      <polygon points="80,50 220,40 230,120 320,130 300,180 90,175" fill="rgba(37, 99, 235, 0.15)" stroke="#2563eb" strokeWidth="2" />
                      {/* Rotary Handle */}
                      <line x1="230" y1="120" x2="265" y2="90" stroke="#22c55e" strokeWidth="2" strokeDasharray="3 3" />
                      <circle cx="265" cy="90" r="14" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
                      <text x="265" y="70" fill="#4ade80" fontSize="9" fontWeight="bold" textAnchor="middle">Drag Handle</text>
                      {/* Corner Angle */}
                      <rect x="70" y="55" width="40" height="16" rx="4" fill="#fef3c7" stroke="#d97706" />
                      <text x="90" y="67" fill="#92400e" fontSize="9" fontWeight="bold" textAnchor="middle">256.4°</text>
                    </g>
                  )}

                  {step.visualType === "sketch-diagonals" && (
                    <g>
                      {/* 4 Triangles */}
                      <polygon points="80,50 220,40 230,120" fill="rgba(37, 99, 235, 0.28)" stroke="#3b82f6" strokeWidth="1.5" />
                      <polygon points="80,50 230,120 90,175" fill="rgba(34, 197, 94, 0.28)" stroke="#22c55e" strokeWidth="1.5" />
                      <polygon points="230,120 320,130 300,180" fill="rgba(234, 179, 8, 0.28)" stroke="#eab308" strokeWidth="1.5" />
                      <polygon points="230,120 300,180 90,175" fill="rgba(168, 85, 247, 0.28)" stroke="#a855f7" strokeWidth="1.5" />
                      {/* 3 Diagonals */}
                      <line x1="230" y1="120" x2="80" y2="50" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />
                      <line x1="230" y1="120" x2="90" y2="175" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />
                      <line x1="230" y1="120" x2="300" y2="180" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />
                      <circle cx="230" cy="120" r="7" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                      <text x="245" y="125" fill="#f59e0b" fontSize="9" fontWeight="bold">Pivot V3</text>
                    </g>
                  )}

                  {step.visualType === "sketch-triangles" && (
                    <g transform="translate(40, 20)">
                      <rect x="0" y="0" width="150" height="150" rx="10" fill="#1e293b" stroke="#334155" />
                      <rect x="10" y="10" width="130" height="28" rx="6" fill="#eff6ff" stroke="#bfdbfe" />
                      <text x="20" y="27" fill="#1e40af" fontSize="9" fontWeight="bold">T1: 418.00 sq.ft (22%)</text>
                      <rect x="10" y="44" width="130" height="28" rx="6" fill="#f0fdf4" stroke="#bbf7d0" />
                      <text x="20" y="61" fill="#166534" fontSize="9" fontWeight="bold">T2: 656.00 sq.ft (35%)</text>
                      <rect x="10" y="78" width="130" height="28" rx="6" fill="#fefce8" stroke="#fef08a" />
                      <text x="20" y="95" fill="#854d0e" fontSize="9" fontWeight="bold">T3: 221.00 sq.ft (12%)</text>
                      <rect x="10" y="112" width="130" height="28" rx="6" fill="#faf5ff" stroke="#e9d5ff" />
                      <text x="20" y="129" fill="#6b21a8" fontSize="9" fontWeight="bold">T4: 569.00 sq.ft (31%)</text>

                      {/* Area Badge on Right */}
                      <g transform="translate(170, 45)">
                        <rect x="0" y="0" width="140" height="60" rx="10" fill="#22c55e" />
                        <text x="70" y="26" fill="#ffffff" fontSize="12" fontWeight="800" textAnchor="middle">1,864.47 sq.ft</text>
                        <text x="70" y="45" fill="#f0fdf4" fontSize="10" textAnchor="middle">1.34 Bigha / 173.2 m²</text>
                      </g>
                    </g>
                  )}

                  {step.visualType === "sketch-export" && (
                    <g transform="translate(100, 15)">
                      <rect x="0" y="0" width="200" height="170" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.3))" />
                      <rect x="15" y="12" width="170" height="20" rx="4" fill="#1e3a8a" />
                      <text x="100" y="26" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">Official Land Survey Report</text>
                      <polygon points="40,50 160,45 170,95 50,100" fill="rgba(37, 99, 235, 0.1)" stroke="#2563eb" strokeWidth="1" />
                      <rect x="15" y="110" width="170" height="45" rx="4" fill="#f8fafc" stroke="#e2e8f0" />
                      <text x="25" y="125" fill="#0f172a" fontSize="7" fontWeight="bold">Plot: Khasra No. 104/2</text>
                      <text x="25" y="138" fill="#15803d" fontSize="8" fontWeight="bold">Area: 1,864.47 sq.ft (1.34 Bigha)</text>
                      <circle cx="160" cy="132" r="14" fill="#dcfce7" stroke="#16a34a" />
                      <text x="160" y="135" fill="#15803d" fontSize="6" fontWeight="bold" textAnchor="middle">VERIFIED</text>
                    </g>
                  )}

                  {/* Fallback Diagram */}
                  {!["sketch-nodes", "sketch-scale", "sketch-rotary", "sketch-diagonals", "sketch-triangles", "sketch-export"].includes(step.visualType) && (
                    <g transform="translate(80, 40)">
                      <rect x="0" y="0" width="240" height="120" rx="10" fill="#1e293b" stroke="#3b82f6" strokeWidth="1.5" />
                      <text x="120" y="55" fill="#60a5fa" fontSize="13" fontWeight="bold" textAnchor="middle">PlotScale Precision Engine</text>
                      <text x="120" y="80" fill="#94a3b8" fontSize="10" textAnchor="middle">1:1 Cadastral Scale & Zero Error</text>
                    </g>
                  )}
                </svg>
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* FAQ Accordion Section */}
      <section className="help-faq-section">
        <div className="help-faq-header">
          <h2>{lang === "hi" ? "अक्सर पूछे जाने वाले सवाल (FAQs)" : "Frequently Asked Questions"}</h2>
          <p>{lang === "hi" ? "सर्वेक्षण, कानूनी पैमाइश और प्लॉट नापने से जुड़े मुख्य सवाल" : "Key questions regarding cadastral survey accuracy and legal measurements"}</p>
        </div>

        <div className="help-faq-list">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className={`help-faq-item ${isOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="help-faq-question"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                >
                  <span>{lang === "hi" ? faq.qHi : faq.qEn}</span>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {isOpen && (
                  <div className="help-faq-answer">
                    <p>{lang === "hi" ? faq.aHi : faq.aEn}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
export default HelpTutorialPage;
