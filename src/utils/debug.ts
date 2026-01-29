/**
 * Debug logging utility
 */

const DEBUG = process.env.DEBUG === 'true';

export function debugLog(message: string, data?: any): void {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    if (data !== undefined) {
      console.error(`[${timestamp}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.error(`[${timestamp}] ${message}`);
    }
  }
}
