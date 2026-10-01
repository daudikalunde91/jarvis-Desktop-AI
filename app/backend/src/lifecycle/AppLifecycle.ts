import { app } from 'electron';

import type { AppBootstrapper } from '@backend/bootstrap/AppBootstrapper';

/**
 * Owns Electron application-lifecycle events ONLY
 * (`whenReady`, `activate`, `window-all-closed`, `before-quit`).
 *
 * It does not construct subsystems and does not create windows itself —
 * it drives an already-constructed `AppBootstrapper` in response to
 * lifecycle events. This keeps "when things happen" (this file) separate
 * from "how things are wired" (AppBootstrapper) and "what a window looks
 * like" (WindowManager).
 */
export function registerAppLifecycle(bootstrapper: AppBootstrapper): void {
  app.whenReady().then(async () => {
    try {
      await bootstrapper.start();
    } catch (error) {
      console.error('[JARVIS] backend startup failed; keeping desktop HUD visible:', error);
    }
    bootstrapper.createWindow();

    app.on('activate', () => {
      if (!bootstrapper.hasOpenWindows()) {
        bootstrapper.createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    bootstrapper.shutdown();
  });
}
