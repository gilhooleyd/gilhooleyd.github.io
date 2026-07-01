import fs from "node:fs";
import path from "node:path";
import { contentDir, handleFileChange } from "./build.js";

/**
 * Recursively watches a directory for changes.
 * Works on Linux where fs.watch recursive:true is not supported.
 * @param {string} dir
 * @param {function(string, string): void} callback
 * @returns {function(): void} close function
 */
function watchRecursive(dir, callback) {
  const watchers = new Map();

  function watch(targetDir) {
    if (watchers.has(targetDir)) return;

    try {
      const watcher = fs.watch(targetDir, (eventType, filename) => {
        const fullPath = filename ? path.join(targetDir, filename) : null;

        // If a new directory is created, watch it
        if (fullPath && fs.existsSync(fullPath)) {
          try {
            if (fs.statSync(fullPath).isDirectory()) {
              watch(fullPath);
            }
          } catch (e) {
            // File might have been deleted quickly, ignore
          }
        }

        callback(eventType, fullPath);
      });

      watchers.set(targetDir, watcher);

      // Recursively watch subdirectories
      const files = fs.readdirSync(targetDir);
      for (const file of files) {
        const filePath = path.join(targetDir, file);
        try {
          if (fs.statSync(filePath).isDirectory()) {
            watch(filePath);
          }
        } catch (e) {
          // Ignore files that fail stat (e.g. broken symlinks)
        }
      }
    } catch (err) {
      console.error(`Error watching directory ${targetDir}:`, err);
    }
  }

  watch(dir);

  return () => {
    for (const watcher of watchers.values()) {
      watcher.close();
    }
    watchers.clear();
  };
}

/**
 * Starts watching the content directory and triggers incremental builds.
 */
export function startWatcher() {
  console.log(`Watching for changes in ${contentDir}...`);

  const changedFiles = new Set();
  let debounceTimer;

  return watchRecursive(contentDir, (eventType, filePath) => {
    if (!filePath) return;

    // Accumulate changes
    changedFiles.add(filePath);

    // Debounce processing to handle editors that save via temp files
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      for (const file of changedFiles) {
        handleFileChange(file);
      }
      changedFiles.clear();
    }, 100);
  });
}
