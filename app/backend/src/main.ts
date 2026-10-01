import { AppBootstrapper } from '@backend/bootstrap/AppBootstrapper';
import { registerAppLifecycle } from '@backend/lifecycle/AppLifecycle';

/**
 * Application entry point.
 *
 * Intentionally minimal: it constructs the composition root and hands
 * control to the lifecycle module. Wiring lives in AppBootstrapper,
 * lifecycle events live in AppLifecycle, window creation lives in
 * WindowManager, and IPC registration lives in ipc/registerIpc.ts —
 * this file does none of that itself.
 */
const bootstrapper = new AppBootstrapper();

registerAppLifecycle(bootstrapper);
