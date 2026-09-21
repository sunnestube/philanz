/**
 * Vitest / Vite's transform pipeline attaches short-lived `end` listeners on streams.
 * With parallel specs that exceeds Node's defaultMaxListeners (10) and prints
 * MaxListenersExceededWarning — not an application leak.
 * Electron main also gets a matching bump (see main.js).
 */
import {EventEmitter} from 'node:events';

if (EventEmitter.defaultMaxListeners < 32) {
    EventEmitter.defaultMaxListeners = 32;
}
