import { loadExternalScript } from "../../utils/loadExternalScript.js";

const TESSERACT_URL =
  "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

let preloadPromise = null;

/**
 * Starts loading the OCR engine before the camera scanner is opened.
 * The promise is shared so the script is only requested once.
 */
export function preloadTeamScannerOcr() {
  if (typeof window === "undefined") return Promise.resolve(null);

  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }

  if (!preloadPromise) {
    preloadPromise = loadExternalScript(TESSERACT_URL, "Tesseract").catch((error) => {
      // Allow a later scanner open to retry if the background preload failed.
      preloadPromise = null;
      throw error;
    });
  }

  return preloadPromise;
}
