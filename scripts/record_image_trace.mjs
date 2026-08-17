import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const userVideosDir = "C:\\Users\\SOHRAB\\Videos\\Screen Recordings";
const artifactsDir = "C:\\Users\\SOHRAB\\.gemini\\antigravity-ide\\brain\\0887571e-9e6a-4ced-acc3-e36de8c37b83";
const sampleImageFile = "C:\\Users\\SOHRAB\\.gemini\\antigravity-ide\\brain\\0887571e-9e6a-4ced-acc3-e36de8c37b83\\.user_uploaded\\media_1786755348953.png";

async function setupGuestSession(page) {
  console.log("🔑 Initializing offline guest session...");
  await page.goto("http://localhost:5174/guest", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const continueBtn = page.locator("button:has-text('Continue offline')");
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
    await page.waitForTimeout(1500);
  }
}

async function recordImageTrace() {
  console.log("\n=======================================================");
  console.log("🎬 RECORDING: IMAGE TRACE FULL FEATURE DEMO (35s+)");
  console.log("=======================================================");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: artifactsDir, size: { width: 1280, height: 720 } }
  });

  const page = await context.newPage();
  await setupGuestSession(page);

  console.log("👉 Opening Image Trace (http://localhost:5174/image-trace)...");
  await page.goto("http://localhost:5174/image-trace", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // A. Upload Cadastral Map Image File
  console.log("  [Step 1] Uploading Cadastral Map Image...");
  const fileInput = page.locator("input[type='file']").first();
  if ((await fileInput.count()) > 0 && fs.existsSync(sampleImageFile)) {
    await fileInput.setInputFiles(sampleImageFile);
    await page.waitForTimeout(4000);
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

  // C. Interactive 1-Click Boundary Detection via mouse coordinates
  console.log("  [Step 3] Clicking Khasra plots for instant vector trace & area...");
  await page.mouse.click(450, 300);
  await page.waitForTimeout(2500);
  await page.mouse.click(600, 350);
  await page.waitForTimeout(2500);

  // D. Tool Selection: Ruler / Measure
  console.log("  [Step 4] Using Tools...");
  const rulerBtn = page.locator("button[title*='Ruler'], button:has-text('Ruler')").first();
  if (await rulerBtn.isVisible()) {
    await rulerBtn.click();
    await page.waitForTimeout(2000);
  }

  // E. View Mode Toggle
  console.log("  [Step 5] Toggling view modes & inspector...");
  await page.mouse.move(500, 300);
  await page.waitForTimeout(2500);

  // F. Export Vector Sheet
  console.log("  [Step 6] Opening Export menu...");
  const exportBtn = page.locator("button:has-text('Export'), button[title*='Export']").first();
  if (await exportBtn.isVisible()) {
    await exportBtn.click();
    await page.waitForTimeout(3000);
  }

  await page.waitForTimeout(3000);
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

recordImageTrace().catch(console.error);
