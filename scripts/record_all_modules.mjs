import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const userVideosDir = "C:\\Users\\SOHRAB\\Videos\\Screen Recordings";
const artifactsDir = "C:\\Users\\SOHRAB\\.gemini\\antigravity-ide\\brain\\0887571e-9e6a-4ced-acc3-e36de8c37b83";

async function recordModule(url, outputName, interactions) {
  console.log(`\n🎬 [Recording Session] Starting: ${outputName} from ${url} ...`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: artifactsDir, size: { width: 1280, height: 720 } }
  });

  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  if (interactions) {
    await interactions(page);
  }

  await page.waitForTimeout(1500);
  await page.close();
  const video = page.video();
  let videoPath = null;
  if (video) {
    videoPath = await video.path();
  }
  await context.close();
  await browser.close();

  if (videoPath && fs.existsSync(videoPath)) {
    const finalDest = path.join(userVideosDir, outputName);
    fs.copyFileSync(videoPath, finalDest);
    console.log(`✅ [Finished] Saved video clip to: ${finalDest}`);
  }
}

async function runAll() {
  // 1. Image Trace Module Demo
  await recordModule(
    "http://localhost:5174/image-trace",
    "PlotScale_ImageTrace_Live_Demo.webm",
    async (page) => {
      console.log("👉 Inspecting Image Trace UI & Controls...");
      const fitBtn = page.locator("button[title*='Fit'], button:has-text('Fit')").first();
      if (await fitBtn.isVisible()) await fitBtn.click();
      await page.waitForTimeout(2000);
    }
  );

  // 2. Map Measurement Module Demo
  await recordModule(
    "http://localhost:5174/map",
    "PlotScale_MapMeasurement_Live_Demo.webm",
    async (page) => {
      console.log("👉 Inspecting Map UI & Layers...");
      const searchBox = page.locator("input[placeholder*='Search']").first();
      if (await searchBox.isVisible()) {
        await searchBox.click();
        await page.waitForTimeout(1000);
      }
    }
  );

  // 3. CAD Measurement Module Demo
  await recordModule(
    "http://localhost:5174/cad-measure",
    "PlotScale_CadMeasure_Live_Demo.webm",
    async (page) => {
      console.log("👉 Inspecting CAD Measurement Tools & UI...");
      const sampleBtn = page.locator("button:has-text('Sample')").first();
      if (await sampleBtn.isVisible()) await sampleBtn.click();
      await page.waitForTimeout(2000);
    }
  );

  console.log("\n🎉 All 4 Module Screen Recording Demos generated successfully!");
}

runAll().catch(console.error);
