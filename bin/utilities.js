import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Checks if the current file is the main module being executed.
 * This prevents the CLI from running when the module is imported (e.g., for tests).
 * @param {string} metaUrl - The module's URL, injectable for tests.
 * @returns {boolean} True if this is the main entry point script.
 */
function isMainModule(metaUrl) {
  try {
    const scriptPath = process.argv[1] && realpathSync(process.argv[1]);
    const modulePath = realpathSync(fileURLToPath(metaUrl));
    return scriptPath === modulePath;
  }
  catch {
    return false;
  }
}

export default {
  isMainModule,
};
