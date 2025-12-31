(function() {
  'use strict';

  const OVERLAY_ID = 'gif-zoom-overlay';
  const PROXY_ATTR = 'data-gif-zoom-proxied';
  const SIDEBAR_BREAKPOINT = 1000;
  const SCALE_MIN = 0.5;
  const SCALE_MAX = 5;

  const BUTTON_STYLE = 'display: inline-flex; align-items: center; justify-content: center; width: 34.75px; height: 34.75px; border-radius: 9999px; background-color: transparent; transition: background-color 0.2s; cursor: pointer; overflow: hidden;';
  const BUTTON_ICON_STYLE = 'display: flex; align-items: center; justify-content: center; transition: color 0.2s;';

  const DOWNLOAD_PATH = 'M3 19h18v2H3zM13 5.828V17h-2V5.828L7.757 9.071 6.343 7.657 12 2l5.657 5.657-1.414 1.414L13 5.828z';
  const INFO_PATH = 'M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zM11 11h2v6h-2zm0-4h2v2h-2z';
  const GITHUB_URL = 'https://github.com/mefinity/gifzoomx';

  const DEFAULT_COLORS = {
    background: { r: 0, g: 0, b: 0, a: 1 },
    textPrimary: { r: 239, g: 243, b: 244, a: 1 },
    textSecondary: { r: 113, g: 118, b: 123, a: 1 },
    border: { r: 47, g: 51, b: 54, a: 1 },
    accent: { r: 29, g: 155, b: 240, a: 1 }
  };

  const THEME_VARS = {
    background: ['--color-bg-primary', '--color-background', '--background', '--color-bg', '--background-color'],
    textPrimary: ['--color-text-primary', '--color-text', '--foreground', '--text-primary-color', '--text-color'],
    textSecondary: ['--color-text-secondary', '--color-text-tertiary', '--muted-foreground', '--text-secondary-color'],
    border: ['--color-border', '--border', '--border-color', '--divider-color'],
    accent: ['--color-primary', '--primary', '--color-accent', '--color-twitter-blue', '--theme-primary']
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const parseRgbChannel = (value) => {
    if (!value) return 0;
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
      return clamp(Math.round(parseFloat(trimmed) * 2.55), 0, 255);
    }
    return clamp(Math.round(parseFloat(trimmed)), 0, 255);
  };

  const parseAlphaChannel = (value) => {
    if (!value) return 1;
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
      return clamp(parseFloat(trimmed) / 100, 0, 1);
    }
    const parsed = parseFloat(trimmed);
    if (Number.isNaN(parsed)) return 1;
    return clamp(parsed, 0, 1);
  };

  const parseHexColor = (hex) => {
    const value = hex.replace('#', '').trim();
    if (value.length === 3) {
      const r = parseInt(value[0] + value[0], 16);
      const g = parseInt(value[1] + value[1], 16);
      const b = parseInt(value[2] + value[2], 16);
      return { r, g, b, a: 1 };
    }
    if (value.length === 4) {
      const r = parseInt(value[0] + value[0], 16);
      const g = parseInt(value[1] + value[1], 16);
      const b = parseInt(value[2] + value[2], 16);
      const a = parseInt(value[3] + value[3], 16) / 255;
      return { r, g, b, a };
    }
    if (value.length === 6) {
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      return { r, g, b, a: 1 };
    }
    if (value.length === 8) {
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      const a = parseInt(value.slice(6, 8), 16) / 255;
      return { r, g, b, a };
    }
    return null;
  };

  const parseRgbLike = (value) => {
    const parts = value.split('/');
    const rgbPart = parts[0] ? parts[0].trim() : '';
    const alphaPart = parts[1] ? parts[1].trim() : '';
    const rgbValues = rgbPart.split(/[\s,]+/).filter(Boolean);
    if (rgbValues.length < 3) return null;
    const r = parseRgbChannel(rgbValues[0]);
    const g = parseRgbChannel(rgbValues[1]);
    const b = parseRgbChannel(rgbValues[2]);
    let a = 1;
    if (alphaPart) {
      a = parseAlphaChannel(alphaPart);
    } else if (rgbValues.length >= 4) {
      a = parseAlphaChannel(rgbValues[3]);
    }
    return { r, g, b, a };
  };

  const parsePercent = (value) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
      const parsed = parseFloat(trimmed);
      if (Number.isNaN(parsed)) return null;
      return clamp(parsed / 100, 0, 1);
    }
    const parsed = parseFloat(trimmed);
    if (Number.isNaN(parsed)) return null;
    if (parsed > 1) return clamp(parsed / 100, 0, 1);
    return clamp(parsed, 0, 1);
  };

  const parseHue = (value) => {
    if (!value) return null;
    const trimmed = value.trim();
    const parsed = parseFloat(trimmed);
    if (Number.isNaN(parsed)) return null;
    if (trimmed.endsWith('turn')) return parsed * 360;
    if (trimmed.endsWith('rad')) return parsed * (180 / Math.PI);
    if (trimmed.endsWith('grad')) return parsed * 0.9;
    return parsed;
  };

  const hslToRgb = (hue, saturation, lightness, alpha = 1) => {
    if (!Number.isFinite(hue) || !Number.isFinite(saturation) || !Number.isFinite(lightness)) return null;
    const h = ((hue % 360) + 360) % 360;
    const s = clamp(saturation, 0, 1);
    const l = clamp(lightness, 0, 1);
    if (s === 0) {
      const gray = l * 255;
      return { r: gray, g: gray, b: gray, a: alpha };
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hk = h / 360;
    const hueToRgb = (t) => {
      let temp = t;
      if (temp < 0) temp += 1;
      if (temp > 1) temp -= 1;
      if (temp < 1 / 6) return p + (q - p) * 6 * temp;
      if (temp < 1 / 2) return q;
      if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
      return p;
    };

    return {
      r: hueToRgb(hk + 1 / 3) * 255,
      g: hueToRgb(hk) * 255,
      b: hueToRgb(hk - 1 / 3) * 255,
      a: alpha
    };
  };

  const parseHslLike = (value) => {
    const parts = value.split('/');
    const hslPart = parts[0] ? parts[0].trim() : '';
    const alphaPart = parts[1] ? parts[1].trim() : '';
    const hslValues = hslPart.split(/[\s,]+/).filter(Boolean);
    if (hslValues.length < 3) return null;
    const h = parseHue(hslValues[0]);
    const s = parsePercent(hslValues[1]);
    const l = parsePercent(hslValues[2]);
    if (!Number.isFinite(h) || s === null || l === null) return null;
    let a = 1;
    if (alphaPart) {
      a = parseAlphaChannel(alphaPart);
    } else if (hslValues.length >= 4) {
      a = parseAlphaChannel(hslValues[3]);
    }
    return hslToRgb(h, s, l, a);
  };

  const looksLikeHslTokens = (value) => {
    const tokens = value.split(/[\s,]+/).filter(Boolean);
    if (tokens.length < 3) return false;
    const secondHasPercent = tokens[1]?.includes('%');
    const thirdHasPercent = tokens[2]?.includes('%');
    return secondHasPercent && thirdHasPercent && !tokens[0].includes('%');
  };

  const parseColor = (value) => {
    if (!value) return null;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    if (trimmed === 'transparent') {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    if (trimmed.startsWith('#')) {
      return parseHexColor(trimmed);
    }
    const hslMatch = trimmed.match(/hsla?\(([^)]+)\)/);
    if (hslMatch) {
      const parsed = parseHslLike(hslMatch[1]);
      if (parsed) return parsed;
    }
    const match = trimmed.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parsed = parseRgbLike(match[1]);
      if (parsed) return parsed;
    }
    if (looksLikeHslTokens(trimmed)) {
      const parsed = parseHslLike(trimmed);
      if (parsed) return parsed;
    }
    if (trimmed.match(/^[0-9.%\s,/]+$/)) {
      return parseRgbLike(trimmed);
    }
    return null;
  };

  const resolveCssValue = (value, style, depth = 0) => {
    if (!value) return value;
    if (!style) return value;
    if (depth > 4) return value;
    const varRegex = /var\(\s*([^) ,]+)\s*(?:,\s*([^)]+))?\)/g;
    let result = value;
    let match;
    while ((match = varRegex.exec(value))) {
      const varName = match[1];
      const fallback = match[2];
      const varValue = style.getPropertyValue(varName).trim();
      const resolvedVar = resolveCssValue(varValue || fallback || '', style, depth + 1);
      result = result.replace(match[0], resolvedVar);
    }
    return result;
  };

  const colorToString = (color) => {
    if (!color) return '';
    const r = clamp(Math.round(color.r), 0, 255);
    const g = clamp(Math.round(color.g), 0, 255);
    const b = clamp(Math.round(color.b), 0, 255);
    const a = color.a;
    if (a === undefined || a >= 1) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    const alpha = clamp(a, 0, 1);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const withAlpha = (color, alpha) => ({ r: color.r, g: color.g, b: color.b, a: alpha });

  const mixColors = (base, blend, weight) => {
    const ratio = clamp(weight, 0, 1);
    return {
      r: Math.round(base.r * (1 - ratio) + blend.r * ratio),
      g: Math.round(base.g * (1 - ratio) + blend.g * ratio),
      b: Math.round(base.b * (1 - ratio) + blend.b * ratio),
      a: 1
    };
  };

  const relativeLuminance = (color) => {
    const toLinear = (channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);
  };

  const isDarkColor = (color) => relativeLuminance(color) < 0.5;

  const readCssVar = (style, names) => {
    if (!style) return '';
    for (const name of names) {
      const value = style.getPropertyValue(name);
      if (value && value.trim()) return value.trim();
    }
    return '';
  };

  const resolveThemeColors = (tweetElement) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    const main = document.querySelector('main');

    const pickColor = (values, fallback, options = {}) => {
      const ignoreTransparent = options.ignoreTransparent;
      for (const value of values) {
        const resolvedValue = resolveCssValue(value, rootStyle);
        const parsed = parseColor(resolvedValue);
        if (!parsed) continue;
        if (ignoreTransparent && parsed.a === 0) continue;
        return parsed;
      }
      return fallback;
    };

    const background = pickColor([
      readCssVar(rootStyle, THEME_VARS.background),
      bodyStyle.backgroundColor,
      main ? getComputedStyle(main).backgroundColor : '',
      primaryColumn ? getComputedStyle(primaryColumn).backgroundColor : '',
      tweetElement ? getComputedStyle(tweetElement).backgroundColor : ''
    ], DEFAULT_COLORS.background, { ignoreTransparent: true });

    const textPrimary = pickColor([
      readCssVar(rootStyle, THEME_VARS.textPrimary),
      tweetElement ? getComputedStyle(tweetElement).color : '',
      bodyStyle.color
    ], DEFAULT_COLORS.textPrimary);
    const isDark = isDarkColor(background);

    const secondaryCandidate = tweetElement?.querySelector('time') || tweetElement?.querySelector('[data-testid="tweetText"]');
    const secondaryValue = readCssVar(rootStyle, THEME_VARS.textSecondary) ||
      (secondaryCandidate ? getComputedStyle(secondaryCandidate).color : '');
    const resolvedSecondary = resolveCssValue(secondaryValue, rootStyle);
    const textSecondary = parseColor(resolvedSecondary) ||
      mixColors(textPrimary, background, isDark ? 0.5 : 0.3);

    const borderCandidate = tweetElement ? getComputedStyle(tweetElement).borderBottomColor : '';
    const borderValue = readCssVar(rootStyle, THEME_VARS.border) || borderCandidate;
    const resolvedBorder = resolveCssValue(borderValue, rootStyle);
    const parsedBorder = parseColor(resolvedBorder);
    const border = parsedBorder && parsedBorder.a !== 0 ?
      parsedBorder :
      mixColors(background, textPrimary, isDark ? 0.25 : 0.1);

    const accentValue = readCssVar(rootStyle, THEME_VARS.accent);
    const resolvedAccent = resolveCssValue(accentValue, rootStyle);
    const accent = parseColor(resolvedAccent) || DEFAULT_COLORS.accent;

    const overlayBackground = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.6)';
    const closeBase = mixColors(background, textPrimary, isDark ? 0.2 : 0.08);
    const closeHover = mixColors(background, textPrimary, isDark ? 0.35 : 0.16);

    return {
      overlayBackground,
      sidebarBackground: colorToString(background),
      sidebarBorder: colorToString(border),
      controlsBackground: colorToString(background),
      textPrimary: colorToString(textPrimary),
      textSecondary: colorToString(textSecondary),
      closeBackground: colorToString(withAlpha(closeBase, isDark ? 0.8 : 0.9)),
      closeHoverBackground: colorToString(withAlpha(closeHover, isDark ? 0.85 : 0.95)),
      closeIcon: colorToString(textPrimary),
      button: {
        default: colorToString(textSecondary),
        hover: colorToString(accent),
        hoverBg: colorToString(withAlpha(accent, 0.1))
      }
    };
  };

  const buildStyles = (theme) => ({
    overlay: `
      position: fixed;
      inset: 0px;
      background-color: ${theme.overlayBackground};
      z-index: 2147483647;
      display: flex;
      flex-direction: row;
    `,
    mediaSection: `
      flex: 1 1 0%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      min-width: 0px;
    `,
    video: `
      max-width: 95%;
      max-height: 95%;
      cursor: grab;
      transition: transform 0.1s ease-out;
      position: relative;
      z-index: 2147483648;
      touch-action: none;
    `,
    closeButton: `
      position: absolute;
      top: 12px;
      left: 16px;
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      background-color: ${theme.closeBackground};
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.2s;
    `,
    sidebar: `
      width: 350px;
      height: 100%;
      display: flex;
      flex-direction: column;
      background-color: ${theme.sidebarBackground};
      border-left: 1px solid ${theme.sidebarBorder};
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 0;
    `,
    controlsContainer: `
      padding: 16px;
      background-color: ${theme.controlsBackground};
      margin-top: auto;
    `,
    controlsLabel: `
      font-size: 15px;
      font-weight: 700;
      color: ${theme.textPrimary};
      margin-bottom: 16px;
    `,
    zoomDisplay: `
      font-size: 14px;
      color: ${theme.textSecondary};
      margin-bottom: 12px;
    `,
    controlsText: `
      font-size: 14px;
      color: ${theme.textSecondary};
      line-height: 2;
    `
  });

  const setStyles = (element, styles) => {
    element.style.cssText = styles;
    return element;
  };

  const getRuntime = () => {
    if (typeof browser !== 'undefined' && browser.runtime) return browser.runtime;
    if (typeof chrome !== 'undefined' && chrome.runtime) return chrome.runtime;
    return null;
  };

  let cachedWorkerUrl = null;
  let cachedWorkerPromise = null;

  const getWorkerUrl = async (runtime) => {
    if (cachedWorkerUrl) return cachedWorkerUrl;
    if (cachedWorkerPromise) return cachedWorkerPromise;

    cachedWorkerPromise = fetch(runtime.getURL('gif.worker.js'))
      .then((response) => {
        if (!response.ok) throw new Error('Worker fetch failed');
        return response.text();
      })
      .then((workerCode) => {
        const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
        cachedWorkerUrl = URL.createObjectURL(workerBlob);
        return cachedWorkerUrl;
      })
      .catch(() => {
        cachedWorkerPromise = null;
        return null;
      });

    return cachedWorkerPromise;
  };

  const releaseWorkerUrl = () => {
    if (cachedWorkerUrl) {
      URL.revokeObjectURL(cachedWorkerUrl);
      cachedWorkerUrl = null;
    }
    cachedWorkerPromise = null;
  };

  window.addEventListener('pagehide', releaseWorkerUrl);

  const getVideoContainer = (element) => {
    return element.closest('[data-testid="videoComponent"]') || element.closest('[data-testid="videoPlayer"]');
  };

  const isGifMedia = (container) => {
    if (!container) return false;
    const video = container.querySelector('video');
    if (video && video.src && video.src.includes('tweet_video')) return true;
    const spans = container.querySelectorAll('span');
    for (const span of spans) {
      if (span.textContent.trim() === 'GIF') return true;
    }
    return false;
  };

  const stopEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const createIconButton = ({ title, path, onClick, colors }) => {
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.title = title;
    button.style.cssText = BUTTON_STYLE;

    const resolvedColors = colors || {
      default: colorToString(DEFAULT_COLORS.textSecondary),
      hover: colorToString(DEFAULT_COLORS.accent),
      hoverBg: colorToString(withAlpha(DEFAULT_COLORS.accent, 0.1))
    };

    const iconWrapper = document.createElement('div');
    iconWrapper.style.cssText = BUTTON_ICON_STYLE;
    iconWrapper.style.color = resolvedColors.default;
    iconWrapper.innerHTML = `<svg viewBox="0 0 24 24" style="width: 18.75px; height: 18.75px; fill: currentColor;"><g><path d="${path}"></path></g></svg>`;
    button.appendChild(iconWrapper);

    const setHover = (hovered) => {
      button.style.backgroundColor = hovered ? resolvedColors.hoverBg : 'transparent';
      iconWrapper.style.color = hovered ? resolvedColors.hover : resolvedColors.default;
    };

    setHover(false);

    button.addEventListener('mouseenter', () => setHover(true));
    button.addEventListener('mouseleave', () => setHover(false));
    button.addEventListener('click', (event) => {
      stopEvent(event);
      onClick(event);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        stopEvent(event);
        onClick(event);
      }
    });

    return button;
  };

  let activeOverlay = null;

  class GifZoomOverlay {
    constructor(videoSrc, posterSrc, tweetElement) {
      this.src = videoSrc;
      this.poster = posterSrc;
      this.originalTweet = tweetElement;
      this.theme = resolveThemeColors(tweetElement);
      this.styles = buildStyles(this.theme);
      this.overlay = null;
      this.mediaSection = null;
      this.sidebar = null;
      this.videoElement = null;
      this.scale = 1;
      this.translateX = 0;
      this.translateY = 0;
      this.isDragging = false;
      this.startX = 0;
      this.startY = 0;
      this.pointerId = null;
      this.rafId = null;
      this.scrollPosition = window.scrollY;
      this.bodyOverflow = document.body.style.overflow;
      this.popupObserver = null;
      this.buttonObserver = null;
      this.onResize = null;
      this.onPointerDown = null;
      this.onPointerMove = null;
      this.onPointerUp = null;
      this.onWheel = null;
      this.handleKey = null;
      this.updateZoomDisplay = null;
      this.render();
    }

    render() {
      this.overlay = this.createOverlay();
      this.mediaSection = this.buildMediaSection();
      this.sidebar = this.buildSidebar();

      this.overlay.appendChild(this.mediaSection);
      this.overlay.appendChild(this.sidebar);

      document.body.appendChild(this.overlay);
      document.body.style.overflow = 'hidden';

      this.handleKey = (event) => {
        if (event.key === 'Escape') this.close();
      };
      document.addEventListener('keydown', this.handleKey);

      this.mediaSection.addEventListener('click', (event) => {
        if (event.target === this.mediaSection) this.close();
      });

      this.setupPopupObserver();
    }

    createOverlay() {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      return setStyles(overlay, this.styles.overlay);
    }

    buildMediaSection() {
      const mediaSection = setStyles(document.createElement('div'), this.styles.mediaSection);

      const video = document.createElement('video');
      video.src = this.src;
      if (this.poster) video.poster = this.poster;
      video.autoplay = true;
      video.loop = true;
      video.muted = false;
      video.controls = false;
      video.playsInline = true;
      setStyles(video, this.styles.video);
      this.videoElement = video;
      this.bindVideoEvents(video);

      mediaSection.appendChild(video);
      mediaSection.appendChild(this.buildCloseButton());

      return mediaSection;
    }

    buildCloseButton() {
      const closeBtn = document.createElement('div');
      closeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: ${this.theme.closeIcon};">
          <g><path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"></path></g>
        </svg>
      `;
      setStyles(closeBtn, this.styles.closeButton);
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.backgroundColor = this.theme.closeHoverBackground;
      });
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.backgroundColor = this.theme.closeBackground;
      });
      closeBtn.addEventListener('click', () => this.close());
      return closeBtn;
    }

    bindVideoEvents(video) {
      this.onWheel = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.deltaY > 0 ? 0.9 : 1.1;
        this.setScale(this.scale * delta);
        this.scheduleTransform();
      };
      video.addEventListener('wheel', this.onWheel, { passive: false });

      this.onPointerDown = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = true;
        this.pointerId = event.pointerId;
        this.startX = event.clientX - this.translateX;
        this.startY = event.clientY - this.translateY;
        video.setPointerCapture(event.pointerId);
        video.style.cursor = 'grabbing';
      };

      this.onPointerMove = (event) => {
        if (!this.isDragging || event.pointerId !== this.pointerId) return;
        event.preventDefault();
        this.translateX = event.clientX - this.startX;
        this.translateY = event.clientY - this.startY;
        this.scheduleTransform();
      };

      this.onPointerUp = (event) => {
        this.endDrag(event.pointerId);
        this.scheduleTransform();
      };

      video.addEventListener('pointerdown', this.onPointerDown);
      video.addEventListener('pointermove', this.onPointerMove);
      video.addEventListener('pointerup', this.onPointerUp);
      video.addEventListener('pointercancel', this.onPointerUp);

      video.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        this.resetView();
      });
    }

    buildSidebar() {
      const sidebar = setStyles(document.createElement('div'), this.styles.sidebar);
      this.sidebar = sidebar;
      this.onResize = () => this.updateSidebarVisibility();
      this.updateSidebarVisibility();
      window.addEventListener('resize', this.onResize);

      if (this.originalTweet) {
        const clone = this.originalTweet.cloneNode(true);
        this.prepareClone(clone);
        sidebar.appendChild(clone);
        sidebar.appendChild(this.buildControls());
      }

      return sidebar;
    }

    buildControls() {
      const controlsContainer = setStyles(document.createElement('div'), this.styles.controlsContainer);

      const controlsLabel = setStyles(document.createElement('div'), this.styles.controlsLabel);
      controlsLabel.textContent = 'Controls';
      controlsContainer.appendChild(controlsLabel);

      const zoomDisplay = setStyles(document.createElement('div'), this.styles.zoomDisplay);
      controlsContainer.appendChild(zoomDisplay);

      const controlsText = setStyles(document.createElement('div'), this.styles.controlsText);
      controlsText.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;"><img src="https://abs-0.twimg.com/emoji/v2/svg/1f50d.svg" style="width: 20px; height: 20px; display: inline;"><strong>Scroll</strong> - Zoom in or out</div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;"><img src="https://abs-0.twimg.com/emoji/v2/svg/1f5b1.svg" style="width: 20px; height: 20px; display: inline;"><strong>Drag</strong> - Pan when zoomed</div>
        <div style="display: flex; align-items: center; gap: 8px;"><img src="https://abs-0.twimg.com/emoji/v2/svg/32-20e3.svg" style="width: 20px; height: 20px; display: inline;"><strong>Double-click</strong> - Reset zoom</div>
      `;
      controlsContainer.appendChild(controlsText);

      this.updateZoomDisplay = () => {
        zoomDisplay.textContent = `Zoom: ${Math.round(this.scale * 100)}%`;
      };
      this.updateZoomDisplay();

      return controlsContainer;
    }

    updateSidebarVisibility() {
      if (!this.sidebar) return;
      this.sidebar.style.display = window.innerWidth < SIDEBAR_BREAKPOINT ? 'none' : 'flex';
    }

    setupPopupObserver() {
      if (!this.sidebar) return;
      this.popupObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && node.getAttribute('role') === 'menu') {
              node.style.position = 'fixed';
              node.style.zIndex = '2147483648';
              const rect = this.sidebar.getBoundingClientRect();
              node.style.top = '50%';
              node.style.left = `${rect.left + rect.width / 2}px`;
              node.style.right = 'auto';
              node.style.transform = 'translateY(-50%)';
            }
          }
        }
      });

      this.popupObserver.observe(document.body, {
        childList: true,
        subtree: false
      });
    }

    setScale(nextScale) {
      this.scale = Math.min(Math.max(SCALE_MIN, nextScale), SCALE_MAX);
    }

    resetView() {
      this.setScale(1);
      this.translateX = 0;
      this.translateY = 0;
      this.scheduleTransform();
    }

    scheduleTransform() {
      if (this.rafId) return;
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.applyTransform();
      });
    }

    applyTransform() {
      if (!this.videoElement) return;
      this.videoElement.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
      this.videoElement.style.cursor = this.isDragging ? 'grabbing' : 'grab';
      if (this.updateZoomDisplay) this.updateZoomDisplay();
    }

    endDrag(pointerId) {
      if (!this.isDragging) return;
      if (pointerId !== null && pointerId !== this.pointerId) return;
      if (this.videoElement && this.pointerId !== null && this.videoElement.hasPointerCapture(this.pointerId)) {
        this.videoElement.releasePointerCapture(this.pointerId);
      }
      this.isDragging = false;
      this.pointerId = null;
    }

    prepareClone(clone) {
      clone.querySelectorAll('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"]').forEach((el) => el.remove());

      clone.querySelectorAll('[aria-labelledby]').forEach((el) => {
        if (el.innerHTML.trim().replace(/<div[^>]*><\/div>/g, '').trim() === '') {
          el.remove();
        }
      });

      clone.querySelectorAll('div').forEach((el) => {
        const text = el.textContent.trim();
        const children = el.children;
        if (el.querySelector('img') || el.querySelector('svg') || el.querySelector('[role="button"]')) {
          return;
        }
        let allEmptyDivs = true;
        for (const child of children) {
          if (child.tagName !== 'DIV' || child.textContent.trim() !== '') {
            allEmptyDivs = false;
            break;
          }
        }
        if (text === '' && allEmptyDivs && children.length > 0 &&
            el.className && el.className.includes('css-175oi2r') &&
            !el.hasAttribute('role') && !el.hasAttribute('data-testid')) {
          if (!el.querySelector('[role="group"]') && !el.querySelector('[role="button"]')) {
            el.remove();
          }
        }
      });

      clone.querySelectorAll('[aria-label*="Grok"], [data-testid="caret"], [aria-label*="Show translation"], [aria-label*="Show original"], [data-testid="thumbsUpVoteButton"], [data-testid="thumbsDownVoteButton"]').forEach((el) => {
        const parent = el.closest('[role="button"]')?.parentElement || el.parentElement;
        if (parent) parent.remove();
      });

      clone.querySelectorAll('div').forEach((el) => {
        if (el.textContent.includes('Rate this translation')) {
          el.remove();
        }
      });

      const buttonGroup = clone.querySelector('[role="group"]');
      if (buttonGroup) {
        const allButtons = Array.from(buttonGroup.children);
        for (const buttonContainer of allButtons) {
          const hasLike = buttonContainer.querySelector('[data-testid="like"]');
          const hasUnlike = buttonContainer.querySelector('[data-testid="unlike"]');
          const hasBookmark = buttonContainer.querySelector('[data-testid="bookmark"]');
          const hasRemoveBookmark = buttonContainer.querySelector('[data-testid="removeBookmark"]');
          if (!hasLike && !hasUnlike && !hasBookmark && !hasRemoveBookmark) {
            buttonContainer.remove();
          }
        }
      }

      if (buttonGroup) {
        buttonGroup.style.justifyContent = 'space-evenly';
        buttonGroup.style.width = '100%';
        buttonGroup.style.paddingTop = '8px';
        buttonGroup.style.paddingBottom = '8px';

        const downloadBtn = createIconButton({
          title: 'Download',
          path: DOWNLOAD_PATH,
          onClick: () => this.downloadMedia(),
          colors: this.theme.button
        });

        buttonGroup.appendChild(downloadBtn);

        const infoBtn = createIconButton({
          title: 'GitHub',
          path: INFO_PATH,
          onClick: () => window.open(GITHUB_URL, '_blank', 'noopener,noreferrer'),
          colors: this.theme.button
        });
        infoBtn.style.marginLeft = '30px';

        buttonGroup.appendChild(infoBtn);
      }

      this.proxyButtons(clone, this.originalTweet);
      this.setupButtonSync(clone, this.originalTweet);
    }

    bindProxyButton(clonedBtn, originalBtn) {
      if (!clonedBtn || !originalBtn || clonedBtn.hasAttribute(PROXY_ATTR)) return;
      clonedBtn.setAttribute(PROXY_ATTR, 'true');
      clonedBtn.style.cursor = 'pointer';
      clonedBtn.addEventListener('click', (event) => {
        stopEvent(event);
        originalBtn.click();
      }, true);
    }

    createProxyClone(originalBtn) {
      const clone = originalBtn.cloneNode(true);
      this.bindProxyButton(clone, originalBtn);
      return clone;
    }

    proxyButtons(clone, original) {
      if (!clone || !original) return;
      const buttonPairs = [
        { testid: 'like' },
        { testid: 'unlike' },
        { testid: 'bookmark' },
        { testid: 'removeBookmark' }
      ];

      for (const { testid } of buttonPairs) {
        const clonedBtn = clone.querySelector(`[data-testid="${testid}"]`);
        const originalBtn = original.querySelector(`[data-testid="${testid}"]`);
        this.bindProxyButton(clonedBtn, originalBtn);
      }
    }

    setupButtonSync(clone, original) {
      if (!clone || !original) return;
      const buttonGroup = original.querySelector('[role="group"]');
      if (!buttonGroup) return;

      this.buttonObserver = new MutationObserver(() => {
        this.syncToggleButton(clone, original, 'like', 'unlike');
        this.syncToggleButton(clone, original, 'bookmark', 'removeBookmark');
      });

      this.buttonObserver.observe(buttonGroup, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-testid']
      });
    }

    syncToggleButton(clone, original, offTestId, onTestId) {
      const originalOff = original.querySelector(`[data-testid="${offTestId}"]`);
      const originalOn = original.querySelector(`[data-testid="${onTestId}"]`);
      const clonedOff = clone.querySelector(`[data-testid="${offTestId}"]`);
      const clonedOn = clone.querySelector(`[data-testid="${onTestId}"]`);

      if (originalOff && clonedOn) {
        const newCloned = this.createProxyClone(originalOff);
        clonedOn.parentElement.replaceChild(newCloned, clonedOn);
      } else if (originalOn && clonedOff) {
        const newCloned = this.createProxyClone(originalOn);
        clonedOff.parentElement.replaceChild(newCloned, clonedOff);
      }
    }

    async downloadMedia() {
      if (!this.src || typeof GIF === 'undefined') return;
      const runtime = getRuntime();
      if (!runtime || !runtime.getURL) return;

      try {
        const workerUrl = await getWorkerUrl(runtime);
        if (!workerUrl) return;

        const video = document.createElement('video');
        video.muted = true;
        video.crossOrigin = 'anonymous';
        video.src = this.src;

        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const gif = new GIF({
          workers: 2,
          quality: 10,
          width: canvas.width,
          height: canvas.height,
          workerScript: workerUrl
        });

        const fps = 10;
        const frameInterval = 1 / fps;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const totalFrames = Math.min(Math.ceil(duration * fps), 200);
        if (!totalFrames) return;

        for (let i = 0; i < totalFrames; i++) {
          await new Promise((resolve) => {
            video.onseeked = resolve;
            video.currentTime = i * frameInterval;
          });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          gif.addFrame(ctx, { copy: true, delay: frameInterval * 1000 });
        }

        gif.on('finished', (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `gif-zoom-${Date.now()}.gif`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        });

        gif.render();
      } catch (_) {
      }
    }

    close() {
      if (!this.overlay) return;
      if (this.popupObserver) this.popupObserver.disconnect();
      if (this.buttonObserver) this.buttonObserver.disconnect();
      if (this.onResize) window.removeEventListener('resize', this.onResize);
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this.handleKey) document.removeEventListener('keydown', this.handleKey);
      this.endDrag(this.pointerId);
      document.body.style.overflow = this.bodyOverflow;
      this.overlay.remove();
      this.overlay = null;
      window.scrollTo(0, this.scrollPosition);
      if (activeOverlay === this) activeOverlay = null;
    }
  }

  const handleGlobalClick = (event) => {
    const videoContainer = getVideoContainer(event.target);
    if (!videoContainer || !isGifMedia(videoContainer)) return;

    stopEvent(event);

    const videoEl = videoContainer.querySelector('video');
    if (!videoEl) return;

    const tweetEl = videoContainer.closest('[data-testid="tweet"]');
    if (activeOverlay) activeOverlay.close();
    activeOverlay = new GifZoomOverlay(videoEl.src, videoEl.poster, tweetEl);
  };

  document.addEventListener('click', handleGlobalClick, true);

})();
