export async function enterAppFullscreen() {
  if (
    typeof document === "undefined"
    || document.fullscreenElement
    || document.webkitFullscreenElement
  ) return true;
  const root = document.documentElement;
  const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
  if (!request) return false;

  try {
    await request.call(root, { navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}

export async function exitAppFullscreen() {
  if (
    typeof document === "undefined"
    || (!document.fullscreenElement && !document.webkitFullscreenElement)
  ) return;
  const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
  if (exit) await exit.call(document).catch(() => {});
}
