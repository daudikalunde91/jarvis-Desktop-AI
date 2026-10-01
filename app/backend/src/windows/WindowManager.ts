import path from 'node:path';

import { BrowserWindow, shell } from 'electron';

import type { ILogger } from '@backend/logging/ILogger';
import type { AppConfig } from '@backend/config/IConfigManager';

/**
 * Owns creation and lifecycle of the main BrowserWindow.
 * Kept separate from main.ts so window concerns (size, dev tools,
 * loading the renderer) don't bloat the application entry point.
 */
export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: ILogger,
    private readonly preloadPath: string,
    private readonly rendererDistPath: string,
  ) {}

  createMainWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: this.config.window.width,
      height: this.config.window.height,
      show: true,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      this.logger.info('Renderer finished loading');
      this.mainWindow?.show();
    });

    this.mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      this.logger.error('Renderer failed to load', { errorCode, errorDescription, validatedURL });
      this.mainWindow?.show();
    });

    this.mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
      this.logger.debug('Renderer console', { message, line, sourceId });
    });

    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    if (this.config.app.environment === 'development') {
      this.mainWindow.loadURL(this.config.renderer.devServerUrl).catch((error) => {
        this.logger.error('Failed to load renderer dev server URL', { error: String(error) });
      });
      if (this.config.window.devTools) {
        this.mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    } else {
      this.mainWindow.loadFile(path.join(this.rendererDistPath, 'index.html')).catch((error) => {
        this.logger.error('Failed to load renderer build output', { error: String(error) });
      });
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.logger.info('Main window created');
    return this.mainWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}
