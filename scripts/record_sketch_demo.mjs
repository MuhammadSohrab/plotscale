import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function recordSketchDemo() {
  const artifactsDir = "C:\\Users\\SOHRAB\\.gemini\\antigravity-ide\\brain\\0887571e-9e6a-4ced-acc3-e36de8c37b83";
  const userVideosDir = "C:\\Users\\SOHRAB\\Videos\\Screen Recordings";

  console.log("🚀 Launching Playwright Chromium with video recorder...");
  const browser = await chromium.launch({
    headless: false,
    channel: "chromium"
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: artifactsDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  console.log("🌐 Navigating to http://localhost:5174/sketch ...");
  await page.goto("http://localhost:5174/sketch", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 1. Click on the pulsating 'Tutorial (गाइड)' button to demonstrate the in-app interactive video guide
  console.log("🎬 Opening Tutorial Guide...");
  const tutorialBtn = page.locator(".sketch-tutorial-pill-btn");
  if (await tutorialBtn.isVisible()) {
    await tutorialBtn.click();
    await page.waitForTimeout(2500);

    // Switch between English and Hindi
    const enBtn = page.locator(".sketch-lang-btn:has-text('English')");
    if (await enBtn.isVisible()) await enBtn.click();
    await page.waitForTimeout(2000);

    const hiBtn = page.locator(".sketch-lang-btn:has-text('हिंदी')");
    if (await hiBtn.isVisible()) await hiBtn.click();
    await page.waitForTimeout(2000);

    // Click Next through the scenes
    const nextBtn = page.locator(".sketch-btn-tutorial-next");
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(3000);
      await nextBtn.click();
      await page.waitForTimeout(3000);
      await nextBtn.click();
      await page.waitForTimeout(3000);
    }

    // Load sample into canvas
    const tryBtn = page.locator(".sketch-btn-try-canvas");
    if (await tryBtn.isVisible()) {
      await tryBtn.click();
      await page.waitForTimeout(2500);
    }
  }

  // 2. Interact with the live canvas plot
  console.log("📐 Interacting with canvas, zooming and opening triangles dock...");
  const zoomInBtn = page.locator("button[title*='Zoom In'], button:has-text('+')").first();
  if (await zoomInBtn.isVisible()) {
    await zoomInBtn.click();
    await page.waitForTimeout(1000);
  }

  // Open Diagonals mode
  const diagModeBtn = page.locator("button:has-text('Diagonals')");
  if (await diagModeBtn.isVisible()) {
    await diagModeBtn.click();
    await page.waitForTimeout(2000);
    // Click Finish
    const finishBtn = page.locator("button:has-text('Finish')");
    if (await finishBtn.isVisible()) {
      await finishBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // Open Triangles list dock
  const trianglesDockBtn = page.locator("button:has-text('Triangles')");
  if (await trianglesDockBtn.isVisible()) {
    await trianglesDockBtn.click();
    await page.waitForTimeout(3000);
  }

  // Click Export
  console.log("📥 Opening Export Modal and exporting PDF report...");
  const exportBtn = page.locator("button:has-text('Export')");
  if (await exportBtn.isVisible()) {
    await exportBtn.click();
    await page.waitForTimeout(2000);

    // Click PDF Plot Sheet
    const pdfCard = page.locator(".sketch-export-card:has-text('PDF Plot Sheet')");
    if (await pdfCard.isVisible()) {
      await pdfCard.click();
      await page.waitForTimeout(3000);
    }
  }

  await page.waitForTimeout(2000);

  // Close context to save video file
  console.log("💾 Closing browser to save video recording...");
  await page.close();
  const video = page.video();
  let videoPath = null;
  if (video) {
    videoPath = await video.path();
    console.log(`✅ Video saved to: ${videoPath}`);
  }

  await context.close();
  await browser.close();

  if (videoPath && fs.existsSync(videoPath)) {
    const finalDest = path.join(userVideosDir, "PlotScale_SketchPad_Live_Tutorial_Demo.webm");
    fs.copyFileSync(videoPath, finalDest);
    console.log(`🎉 Live Browser Demo Video copied to User Videos Folder: ${finalDest}`);
  }
}

recordSketchDemo().catch(console.error);
