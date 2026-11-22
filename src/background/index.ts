import { analyzeColor } from '../lib/color-utils';
import { storage } from '../lib/storage';
import type { ExtMessage, StoredColor } from '../types';

// Keyboard shortcut: open the popup. Picking needs Chrome's EyeDropper, which only opens from a
// click or key press inside the popup itself, so the shortcut brings you there with Pick focused
// (press Enter to start). Needs Chrome 127+ for action.openPopup (see minimum_chrome_version).
chrome.commands.onCommand.addListener((command) => {
  if (command === 'activate-eyedropper') chrome.action.openPopup().catch(() => {});
});

// Message hub
chrome.runtime.onMessage.addListener((msg: ExtMessage, sender, sendResponse) => {
  handleMessage(msg, sender, sendResponse);
  return true; // keep channel open for async
});

async function handleMessage(
  msg: ExtMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (r: unknown) => void
) {
  switch (msg.type) {
    case 'COLOR_PICKED': {
      const color = analyzeColor(msg.hex);
      const stored: StoredColor = {
        ...color,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: Date.now(),
      };
      await storage.saveColor(stored);
      const activeSessionId = await storage.getActiveSessionId();
      if (activeSessionId) await storage.addColorToSession(stored);
      sendResponse({ ok: true, color: stored });
      // Auto-reopen popup to show the picked color (Chrome 127+)
      try {
        await (chrome.action as typeof chrome.action & { openPopup?: () => Promise<void> }).openPopup?.();
      } catch { /* openPopup may not be available in all builds */ }
      break;
    }

    case 'GET_STATE': {
      const state = await storage.getState();
      sendResponse(state);
      break;
    }

    case 'SAVE_COLOR': {
      await storage.saveColor(msg.color);
      sendResponse({ ok: true });
      break;
    }

    case 'DELETE_HISTORY_ITEM': {
      await storage.deleteHistoryItem(msg.id);
      sendResponse({ ok: true });
      break;
    }

    case 'UPDATE_HISTORY_ITEM': {
      await storage.updateHistoryItem(msg.id, { tag: msg.tag, label: msg.label });
      sendResponse({ ok: true });
      break;
    }

    case 'START_SESSION': {
      const session = await storage.startSession(msg.name);
      sendResponse({ ok: true, session });
      break;
    }

    case 'END_SESSION': {
      await storage.endSession();
      sendResponse({ ok: true });
      break;
    }

    case 'DELETE_SESSION': {
      await storage.deleteSession(msg.id);
      sendResponse({ ok: true });
      break;
    }

    case 'UPDATE_SETTINGS': {
      await storage.updateSettings(msg.settings);
      sendResponse({ ok: true });
      break;
    }

    case 'COPY_TO_CLIPBOARD': {
      sendResponse({ ok: true });
      break;
    }

    default:
      sendResponse({ ok: false });
  }
}
