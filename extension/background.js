'use strict';

const ALLOWED_VIDEO_HOSTS = new Set(['video.twimg.com']);

const isAllowedVideoUrl = (value) => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_VIDEO_HOSTS.has(url.hostname);
  } catch (_) {
    return false;
  }
};

const fetchVideoBytes = async (url) => {
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Video fetch failed: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return {
    buffer,
    contentType: response.headers.get('content-type') || ''
  };
};

const handleMessage = (message, _sender, sendResponse) => {
  if (!message || message.type !== 'fetch-video') return undefined;

  if (!isAllowedVideoUrl(message.url)) {
    sendResponse({ ok: false, error: 'Blocked URL' });
    return undefined;
  }

  fetchVideoBytes(message.url)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || 'Fetch failed' }));

  return true;
};

if (typeof browser !== 'undefined' && browser.runtime?.onMessage) {
  browser.runtime.onMessage.addListener(handleMessage);
} else if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(handleMessage);
}
