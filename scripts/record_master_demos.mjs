import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const userVideosDir = "C:\\Users\\SOHRAB\\Videos\\Screen Recordings";
const artifactsDir = "C:\\Users\\SOHRAB\\.gemini\\antigravity-ide\\brain\\0887571e-9e6a-4ced-acc3-e36de8c37b83";

async function setupGuestSession(page) {
  console.log("🔑 Initializing offline guest session...");
  await page.goto("http://localhost:5174/guest", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const continueBtn = page.locator("button:has-text('Continue offline')");
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
    await page.waitForTimeout(1500);
  }
}

// 1. MASTER RECORDING: SKETCH PAD (40-45 SECONDS DEEP DEMO)
async function recordSketchPad() {
  console.log("\n=======================================================");
  console.log("🎬 [1/3] RECORDING: SKETCH PAD FULL FEATURE DEMO (40s+)");
  console.log("=======================================================");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: artifactsDir, size: { width: 1280, height: 720 } }
  });

  const page = await context.newPage();
  await setupGuestSession(page);

  console.log("👉 Opening Sketch Pad (http://localhost:5174/sketch)...");
  await page.goto("http://localhost:5174/sketch", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // A. In-App Video Tutorial Guide Modal
  console.log("  [Step 1] Opening Tutorial Guide modal & language toggle...");
  const tutorialBtn = page.locator(".sketch-tutorial-pill-btn");
  if (await tutorialBtn.isVisible()) {
    await tutorialBtn.click();
    await page.waitForTimeout(2500);

    // Switch to English
    const enBtn = page.locator(".sketch-lang-btn:has-text('English')");
    if (await enBtn.isVisible()) {
      await enBtn.click();
      await page.waitForTimeout(2000);
    }

    // Switch back to Hindi
    const hiBtn = page.locator(".sketch-lang-btn:has-text('हिंदी')");
    if (await hiBtn.isVisible()) {
      await hiBtn.click();
      await page.waitForTimeout(2000);
    }

    // Cycle through scenes
    const nextBtn = page.locator(".sketch-btn-tutorial-next");
    if (await nextBtn.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await nextBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Click "कैनवास में लोड करें"
    const loadSampleBtn = page.locator(".sketch-btn-try-canvas");
    if (await loadSampleBtn.isVisible()) {
      console.log("  [Step 2] Loading 6-Corner cadastral sample into real canvas...");
      await loadSampleBtn.click();
      await page.waitForTimeout(2500);
    }
  }

  // B. Live Canvas Interaction: Zoom & Pan
  console.log("  [Step 3] Zoom In, Zoom Out, and Viewport controls...");
  const zoomIn = page.locator("button:has-text('+')").first();
  if (await zoomIn.isVisible()) {
    await zoomIn.click();
    await page.waitForTimeout(1200);
    await zoomIn.click();
    await page.waitForTimeout(1500);
  }

  const zoomOut = page.locator("button:has-text('-')").first();
  if (await zoomOut.isVisible()) {
    await zoomOut.click();
    await page.waitForTimeout(1500);
  }

  // C. Canvas Hovering across vertices
  console.log("  [Step 4] Hovering across vertices on canvas...");
  await page.mouse.move(500, 300);
  await page.waitForTimeout(1500);
  await page.mouse.move(650, 450);
  await page.waitForTimeout(1500);

  // D. Diagonals Mode & Floating Action Dock
  console.log("  [Step 5] Opening Diagonals Action Dock (Add, Less, Finish)...");
  const diagBtn = page.locator("button:has-text('Diagonals')");
  if (await diagBtn.isVisible()) {
    await diagBtn.click();
    await page.waitForTimeout(2500);

    const finishBtn = page.locator("button:has-text('Finish')");
    if (await finishBtn.isVisible()) {
      await finishBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  // E. Triangles Breakdown List Dock
  console.log("  [Step 6] Opening Triangles (4) Breakdown Dock...");
  const triBtn = page.locator("button:has-text('Triangles')");
  if (await triBtn.isVisible()) {
    await triBtn.click();
    await page.waitForTimeout(3000);
    const closeDrawer = page.locator("button[title*='Close'], .sketch-drawer-close").first();
    if (await closeDrawer.isVisible()) {
      await closeDrawer.click();
      await page.waitForTimeout(1500);
    }
  }

  // F. Export Official Survey Report
  console.log("  [Step 7] Opening Export modal & generating 3-Page Survey PDF...");
  const exportBtn = page.locator("button:has-text('Export')");
  if (await exportBtn.isVisible()) {
    await exportBtn.click();
    await page.waitForTimeout(2500);

    const pdfCard = page.locator(".sketch-export-card:has-text('PDF Plot Sheet')");
    if (await pdfCard.isVisible()) {
      await pdfCard.click();
      await page.waitForTimeout(4000);
    }
  }

  await page.waitForTimeout(3000);
  await page.close();

  const video = page.video();
  if (video) {
    const videoPath = await video.path();
    await context.close();
    await browser.close();
    const dest = path.join(userVideosDir, "PlotScale_SketchPad_Live_Tutorial_Demo.webm");
    fs.copyFileSync(videoPath, dest);
    console.log(`✅ [SUCCESS] Sketch Pad Full Demo saved: ${dest}`);
  } else {
    await context.close();
    await browser.close();
  }
}

// 2. MASTER RECORDING: CAD MEASUREMENT MODULE (35-40 SECONDS)
async function recordCadMeasure() {
  console.log("\n=======================================================");
  console.log("🎬 [2/3] RECORDING: CAD MEASUREMENT FULL DEMO (35s+)");
  console.log("=======================================================");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: artifactsDir, size: { width: 1280, height: 720 } }
  });

  const page = await context.newPage();
  await setupGuestSession(page);

  console.log("👉 Opening CAD Measurement (http://localhost:5174/cad-measure)...");
  await page.goto("http://localhost:5174/cad-measure", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // A. Load Sample CAD Drawing
  console.log("  [Step 1] Loading Sample DWG / DXF Cadastral Drawing...");
  const sampleBtn = page.locator("button:has-text('Sample'), button:has-text('Load Sample')").first();
  if (await sampleBtn.isVisible()) {
    await sampleBtn.click();
    await page.waitForTimeout(3500);
  }

  // B. Zoom & Pan in CAD Canvas
  console.log("  [Step 2] Zooming and panning CAD Drawing...");
  const zoomInBtn = page.locator("button:has-text('+')").first();
  if (await zoomInBtn.isVisible()) {
    await zoomInBtn.click();
    await page.waitForTimeout(1500);
    await zoomInBtn.click();
    await page.waitForTimeout(1500);
  }

  // C. Open Layer Manager Drawer
  console.log("  [Step 3] Opening CAD Layer Manager and toggling layers...");
  const layersBtn = page.locator("button:has-text('Layers')");
  if (await layersBtn.isVisible()) {
    await layersBtn.click();
    await page.waitForTimeout(2500);
    const layerCheckboxes = page.locator("input[type='checkbox']");
    if ((await layerCheckboxes.count()) > 1) {
      await layerCheckboxes.nth(1).click();
      await page.waitForTimeout(1500);
      await layerCheckboxes.nth(1).click();
      await page.waitForTimeout(1500);
    }
  }

  // D. Tool Selection: Tape Measure
  console.log("  [Step 4] Activating Tape Measure Tool & measuring distances...");
  const tapeBtn = page.locator("button:has-text('Measure'), button:has-text('Tape')").first();
  if (await tapeBtn.isVisible()) {
    await tapeBtn.click();
    await page.waitForTimeout(2000);
    const canvas = page.locator("canvas, svg").first();
    if (await canvas.isVisible()) {
      await canvas.click({ position: { x: 300, y: 250 } });
      await page.waitForTimeout(1200);
      await canvas.click({ position: { x: 450, y: 250 } });
      await page.waitForTimeout(2500);
    }
  }

  // E. Tool Selection: Parcel Pick (1-Click Area)
  console.log("  [Step 5] Using Parcel Pick for 1-Click CAD Area Detection...");
  const pickBtn = page.locator("button:has-text('Pick'), button:has-text('Select')").first();
  if (await pickBtn.isVisible()) {
    await pickBtn.click();
    await page.waitForTimeout(2000);
    const canvas = page.locator("canvas, svg").first();
    if (await canvas.isVisible()) {
      await canvas.click({ position: { x: 400, y: 300 } });
      await page.waitForTimeout(2500);
    }
  }

  // F. Export CAD Summary
  console.log("  [Step 6] Exporting CAD Survey Measurements...");
  const exportBtn = page.locator("button:has-text('Export')").first();
  if (await exportBtn.isVisible()) {
    await exportBtn.click();
    await page.waitForTimeout(3000);
  }

  await page.waitForTimeout(2000);
  await page.close();

  const video = page.video();
  if (video) {
    const videoPath = await video.path();
    await context.close();
    await browser.close();
    const dest = path.join(userVideosDir, "PlotScale_CadMeasure_Live_Demo.webm");
    fs.copyFileSync(videoPath, dest);
    console.log(`✅ [SUCCESS] CAD Measure Full Demo saved: ${dest}`);
  } else {
    await context.close();
    await browser.close();
  }
}

// 3. MASTER RECORDING: IMAGE TRACE MODULE (35-40 SECONDS)
async function recordImageTrace() {
  console.log("\n=======================================================");
  console.log("🎬 [3/3] RECORDING: IMAGE TRACE FULL DEMO (35s+)");
  console.log("=======================================================");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: artifactsDir, size: { width: 1280, height: 720 } }
  });

  const page = await context.newPage();
  await setupGuestSession(page);

  console.log("👉 Opening Image Trace (http://localhost:5174/image-trace)...");
  await page.goto("http://localhost:5174/image-trace", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // A. Load Sample Map
  console.log("  [Step 1] Loading Sample Village Cadastral Map...");
  const sampleMapBtn = page.locator("button:has-text('Sample'), button:has-text('Load Sample')").first();
  if (await sampleMapBtn.isVisible()) {
    await sampleMapBtn.click();
    await page.waitForTimeout(3500);
  }

  // B. Zoom & Pan Map
  console.log("  [Step 2] Navigating & Zooming Scanned Map Sheet...");
  const zoomInBtn = page.locator("button:has-text('+')").first();
  if (await zoomInBtn.isVisible()) {
    await zoomInBtn.click();
    await page.waitForTimeout(1500);
    await zoomInBtn.click();
    await page.waitForTimeout(1500);
  }

  // C. Interactive 1-Click Boundary Detection
  console.log("  [Step 3] Clicking Khasra plots for instant vector trace & area...");
  const canvas = page.locator("canvas, svg").first();
  if (await canvas.isVisible()) {
    await canvas.click({ position: { x: 350, y: 250 } });
    await page.waitForTimeout(2500);
    await canvas.click({ position: { x: 500, y: 320 } });
    await page.waitForTimeout(2500);
  }

  // D. Adjust Contrast / Edge Sliders
  console.log("  [Step 4] Adjusting Detection Threshold & Contrast Sliders...");
  const sliders = page.locator("input[type='range']");
  if ((await sliders.count()) > 0) {
    await sliders.first().fill("60");
    await page.waitForTimeout(2000);
  }

  // E. Toggle View Mode
  console.log("  [Step 5] Toggling between Vector Overlay and Clean Sheet...");
  const viewToggle = page.locator("button:has-text('Overlay'), button:has-text('Vector')").first();
  if (await viewToggle.isVisible()) {
    await viewToggle.click();
    await page.waitForTimeout(2000);
  }

  // F. Export Vector Sheet
  console.log("  [Step 6] Exporting Vector Drawing...");
  const exportBtn = page.locator("button:has-text('Export')").first();
  if (await exportBtn.isVisible()) {
    await exportBtn.click();
    await page.waitForTimeout(3000);
  }

  await page.waitForTimeout(2000);
  await page.close();

  const video = page.video();
  if (video) {
    const videoPath = await video.path();
    await context.close();
    await browser.close();
    const dest = path.join(userVideosDir, "PlotScale_ImageTrace_Live_Demo.webm");
    fs.copyFileSync(videoPath, dest);
    console.log(`✅ [SUCCESS] Image Trace Full Demo saved: ${dest}`);
  } else {
    await context.close();
    await browser.close();
  }
}

async function runMasterRecordings() {
  console.log("🚀 Starting Full 35-45s High-Definition Screen Recording Suite...");
  await recordSketchPad();
  await recordCadMeasure();
  await recordImageTrace();
  console.log("\n🎉 ALL MASTER VIDEO RECORDINGS COMPLETED AND SAVED TO USER'S VIDEOS FOLDER!");
}

runMasterRecordings().catch(console.error);
