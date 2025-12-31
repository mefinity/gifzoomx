(function() {
  'use strict';

  const OVERLAY_ID = 'gif-zoom-overlay';
  const PROXY_ATTR = 'data-gif-zoom-proxied';
  const SIDEBAR_BREAKPOINT = 1000;
  const SCALE_MIN = 0.5;
  const SCALE_MAX = 5;

  const BUTTON_COLOR = 'rgb(113, 118, 123)';
  const BUTTON_HOVER_COLOR = 'rgb(29, 155, 240)';
  const BUTTON_HOVER_BG = 'rgba(29, 155, 240, 0.1)';
  const BUTTON_STYLE = 'display: inline-flex; align-items: center; justify-content: center; width: 34.75px; height: 34.75px; border-radius: 9999px; background-color: transparent; transition: background-color 0.2s; cursor: pointer; overflow: hidden;';
  const BUTTON_ICON_STYLE = `display: flex; align-items: center; justify-content: center; color: ${BUTTON_COLOR}; transition: color 0.2s;`;

  const CLOSE_BG = 'rgba(15, 20, 25, 0.75)';
  const CLOSE_BG_HOVER = 'rgba(39, 44, 48, 0.75)';

  const DOWNLOAD_PATH = 'M3 19h18v2H3zM13 5.828V17h-2V5.828L7.757 9.071 6.343 7.657 12 2l5.657 5.657-1.414 1.414L13 5.828z';
  const INFO_PATH = 'M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zM11 11h2v6h-2zm0-4h2v2h-2z';
  const GITHUB_URL = 'https://github.com/mefinity/gifzoomx';

  const STYLES = {
    overlay: `
      position: fixed;
      inset: 0px;
      background-color: rgba(0, 0, 0, 0.85);
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
      background-color: ${CLOSE_BG};
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
      background-color: rgb(0, 0, 0);
      border-left: 1px solid rgb(47, 51, 54);
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 0;
    `,
    controlsContainer: `
      padding: 16px;
      background-color: rgb(0, 0, 0);
      margin-top: auto;
    `,
    controlsLabel: `
      font-size: 15px;
      font-weight: 700;
      color: rgb(239, 243, 244);
      margin-bottom: 16px;
    `,
    zoomDisplay: `
      font-size: 14px;
      color: rgb(113, 118, 123);
      margin-bottom: 12px;
    `,
    controlsText: `
      font-size: 14px;
      color: rgb(113, 118, 123);
      line-height: 2;
    `
  };

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

  const createIconButton = ({ title, path, onClick }) => {
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.title = title;
    button.style.cssText = BUTTON_STYLE;

    const iconWrapper = document.createElement('div');
    iconWrapper.style.cssText = BUTTON_ICON_STYLE;
    iconWrapper.innerHTML = `<svg viewBox="0 0 24 24" style="width: 18.75px; height: 18.75px; fill: currentColor;"><g><path d="${path}"></path></g></svg>`;
    button.appendChild(iconWrapper);

    const setHover = (hovered) => {
      button.style.backgroundColor = hovered ? BUTTON_HOVER_BG : 'transparent';
      iconWrapper.style.color = hovered ? BUTTON_HOVER_COLOR : BUTTON_COLOR;
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
      return setStyles(overlay, STYLES.overlay);
    }

    buildMediaSection() {
      const mediaSection = setStyles(document.createElement('div'), STYLES.mediaSection);

      const video = document.createElement('video');
      video.src = this.src;
      if (this.poster) video.poster = this.poster;
      video.autoplay = true;
      video.loop = true;
      video.muted = false;
      video.controls = false;
      video.playsInline = true;
      setStyles(video, STYLES.video);
      this.videoElement = video;
      this.bindVideoEvents(video);

      mediaSection.appendChild(video);
      mediaSection.appendChild(this.buildCloseButton());

      return mediaSection;
    }

    buildCloseButton() {
      const closeBtn = document.createElement('div');
      closeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: rgb(239, 243, 244);">
          <g><path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"></path></g>
        </svg>
      `;
      setStyles(closeBtn, STYLES.closeButton);
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.backgroundColor = CLOSE_BG_HOVER;
      });
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.backgroundColor = CLOSE_BG;
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
      const sidebar = setStyles(document.createElement('div'), STYLES.sidebar);
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
      const controlsContainer = setStyles(document.createElement('div'), STYLES.controlsContainer);

      const controlsLabel = setStyles(document.createElement('div'), STYLES.controlsLabel);
      controlsLabel.textContent = 'Controls';
      controlsContainer.appendChild(controlsLabel);

      const zoomDisplay = setStyles(document.createElement('div'), STYLES.zoomDisplay);
      controlsContainer.appendChild(zoomDisplay);

      const controlsText = setStyles(document.createElement('div'), STYLES.controlsText);
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
          onClick: () => this.downloadMedia()
        });

        buttonGroup.appendChild(downloadBtn);

        const infoBtn = createIconButton({
          title: 'GitHub',
          path: INFO_PATH,
          onClick: () => window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')
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
