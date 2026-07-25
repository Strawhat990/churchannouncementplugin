// display.js

(function () {
  'use strict';

  var STORAGE_CURRENT = 'cas_current';
  var STORAGE_STYLE = 'cas_style';
  var stage = document.getElementById('stage');
  
  var lastTs = 0;
  var currentAnnouncement = null;
  var currentStyle = null;

  function getDefaultStyle() {
    return {
      transition: 'fade',
      layout: 'lower-third',
      titleFont: "'Inter', sans-serif", titleWeight: "800", titleSize: 40, titleColor: "#FFFFFF", titleOffsetX: 0, titleOffsetY: 0,
      titleShadowX: 0, titleShadowY: 2, titleShadowBlur: 4, titleShadowColor: "#000000",
      subtitleFont: "'Inter', sans-serif", subtitleWeight: "600", subtitleSize: 19, subtitleColor: "#CCCCCC", subtitleOffsetX: 0, subtitleOffsetY: 0,
      subtitleShadowX: 0, subtitleShadowY: 0, subtitleShadowBlur: 0, subtitleShadowColor: "#000000",
      descFont: "'Inter', sans-serif", descWeight: "400", descSize: 15, descColor: "#AAAAAA", descOffsetX: 0, descOffsetY: 0,
      descShadowX: 0, descShadowY: 0, descShadowBlur: 0, descShadowColor: "#000000",
      imageSize: 80, imageRadius: 14, imageOffsetX: 0, imageOffsetY: 0, imageFit: "cover",
      image2Size: 80, image2Radius: 14, image2OffsetX: 0, image2OffsetY: 0, image2Absolute: false, image2Fit: "cover",
      image3Size: 80, image3Radius: 14, image3OffsetX: 0, image3OffsetY: 0, image3Absolute: false, image3Fit: "cover",
      bgType: "transparent", bgColor: "#000000", bgOpacity: 0.5, bgGradient1: "#000000", bgGradient2: "#333333", bgAngle: 90, bgImage: null, bgImageSize: "cover", bgImageX: 50, bgImageY: 50, bgImageRepeat: false, bgImageScaleW: 100, bgImageScaleH: 100, backdropBlur: 0,
      borderWidth: 0, borderColor: "#FFFFFF", borderRadius: 20, padding: 32, shadowOpacity: 0.5,
      position: "bottom-center", offsetX: 0, offsetY: 0, maxWidth: 1300, maxHeight: 0
    };
  }

  function mergeStyleWithDefaults(style) {
    var merged = getDefaultStyle();
    if (!style || typeof style !== 'object') return merged;
    Object.keys(style).forEach(function (key) { merged[key] = style[key]; });
    return merged;
  }

  function sanitizeDescriptionHtml(html) {
    var allowedTags = { B: true, STRONG: true, I: true, EM: true, UL: true, OL: true, LI: true, BR: true, P: true, DIV: true };
    var template = document.createElement('template');
    template.innerHTML = html || '';

    function cleanChildren(parent) {
      var child = parent.firstChild;
      while (child) {
        var next = child.nextSibling;
        if (child.nodeType === 1) {
          cleanChildren(child);
          if (!allowedTags[child.tagName]) {
            while (child.firstChild) parent.insertBefore(child.firstChild, child);
            parent.removeChild(child);
          } else {
            while (child.attributes.length) child.removeAttribute(child.attributes[0].name);
          }
        } else if (child.nodeType !== 3) {
          parent.removeChild(child);
        }
        child = next;
      }
    }

    cleanChildren(template.content);
    return template.innerHTML.trim();
  }

  function readStyle() {
    try {
      var raw = localStorage.getItem(STORAGE_STYLE);
      currentStyle = raw ? mergeStyleWithDefaults(JSON.parse(raw)) : getDefaultStyle();
    } catch (e) {
      currentStyle = getDefaultStyle();
    }
  }

  function applyPayload(payload) {
    if (!payload || payload.ts === lastTs) return;
    lastTs = payload.ts;
    
    if (payload.hidden) {
      currentAnnouncement = null;
      clearStage();
    } else if (payload.announcement) {
      currentAnnouncement = payload.announcement;
      
      // Prefer announcement's specific style, otherwise fall back to global
      if (currentAnnouncement.style) {
        currentStyle = mergeStyleWithDefaults(currentAnnouncement.style);
      } else {
        readStyle();
      }
      
      renderCard(currentAnnouncement);
    }
  }

  function updateStyleFromConfig(config) {
    if (!config) return;
    currentStyle = mergeStyleWithDefaults(config);
    
    // If there's an active announcement, update its styles inline
    // Find the latest non-exiting card
    if (currentAnnouncement) {
      var allCards = stage.querySelectorAll('.ann-card-stage');
      for (var i = allCards.length - 1; i >= 0; i--) {
        if (!allCards[i].getAttribute('data-exiting')) {
          applyStylesToCard(allCards[i]);
          break;
        }
      }
    }
  }

  function readCurrent() {
    try {
      var raw = localStorage.getItem(STORAGE_CURRENT);
      if (!raw) return;
      applyPayload(JSON.parse(raw));
    } catch (e) { /* ignore malformed payloads */ }
    
    // Sync global styles only if the current announcement doesn't have its own embedded style
    // (prevents global style from overwriting announcement-specific styling)
    if (!currentAnnouncement || !currentAnnouncement.style) {
      try {
        var rawStyle = localStorage.getItem(STORAGE_STYLE);
        if (rawStyle) {
          var parsed = mergeStyleWithDefaults(JSON.parse(rawStyle));
          if (JSON.stringify(parsed) !== JSON.stringify(currentStyle)) {
            updateStyleFromConfig(parsed);
          }
        }
      } catch (e) {}
    }
  }

  // Baseline: poll every 300ms. Simple and works everywhere localStorage does.
  readStyle();
  readCurrent();
  setInterval(readCurrent, 300);

  // Optional speed boost when both pages share a live BroadcastChannel.
  try {
    if ('BroadcastChannel' in window) {
      var channel = new BroadcastChannel('church-announcements');
      channel.onmessage = function (event) {
        var msg = event.data;
        if (!msg) return;
        if (msg.type === 'content') {
          applyPayload(msg.payload);
        } else if (msg.type === 'style') {
          updateStyleFromConfig(msg.config);
        } else if (msg.type === 'out') {
          currentAnnouncement = null;
          clearStage();
        } else if (msg.announcement || msg.hidden) {
          // backwards compatibility with old payloads
          applyPayload(msg);
        }
      };
    }
  } catch (e) { /* ignore */ }

  // ---------- CSS Helpers ----------
  
  function applyStylesToCard(card) {
    var s = currentStyle;

    // Background
    var bg = 'transparent';
    if (s.bgType === 'solid') {
      // convert hex to rgba
      var hex = s.bgColor.replace('#', '');
      var r = parseInt(hex.substring(0, 2), 16);
      var g = parseInt(hex.substring(2, 4), 16);
      var b = parseInt(hex.substring(4, 6), 16);
      bg = 'rgba(' + r + ',' + g + ',' + b + ',' + s.bgOpacity + ')';
    } else if (s.bgType === 'gradient') {
      bg = 'linear-gradient(' + s.bgAngle + 'deg, ' + s.bgGradient1 + ', ' + s.bgGradient2 + ')';
    } else if (s.bgType === 'image' && s.bgImage) {
      // Fallback solid background color behind image
      var hexImg = s.bgColor.replace('#', '');
      var rImg = parseInt(hexImg.substring(0, 2), 16);
      var gImg = parseInt(hexImg.substring(2, 4), 16);
      var bImg = parseInt(hexImg.substring(4, 6), 16);
      card.style.backgroundColor = 'rgba(' + rImg + ',' + gImg + ',' + bImg + ',' + s.bgOpacity + ')';

      var bgSize = s.bgImageSize || 'cover';
      if (bgSize === '__manual__') {
        bgSize = (s.bgImageScaleW || 100) + '% ' + (s.bgImageScaleH || 100) + '%';
      }
      var bgPosX = (s.bgImageX !== undefined ? s.bgImageX : 50) + '%';
      var bgPosY = (s.bgImageY !== undefined ? s.bgImageY : 50) + '%';
      card.style.backgroundImage = 'url(' + s.bgImage + ')';
      card.style.backgroundSize = bgSize;
      card.style.backgroundPosition = bgPosX + ' ' + bgPosY;
      card.style.backgroundRepeat = s.bgImageRepeat ? 'repeat' : 'no-repeat';
      card.style.backgroundOrigin = 'border-box';
      bg = null;
    }
    
    if (bg !== null) card.style.background = bg;
    card.style.backdropFilter = s.backdropBlur > 0 ? 'blur(' + s.backdropBlur + 'px)' : 'none';
    card.style.webkitBackdropFilter = card.style.backdropFilter;

    // Borders & Box
    card.style.border = s.borderWidth > 0 ? s.borderWidth + 'px solid ' + s.borderColor : 'none';
    card.style.borderRadius = s.borderRadius + 'px';
    card.style.padding = s.padding + 'px';
    card.style.boxShadow = s.shadowOpacity > 0 ? '0 10px 40px rgba(0,0,0,' + s.shadowOpacity + ')' : 'none';

    // Width
    card.style.width = s.maxWidth > 0 ? 'min(88vw, ' + s.maxWidth + 'px)' : 'auto';

    // Height
    if (s.maxHeight > 0) {
      card.style.maxHeight = s.maxHeight + 'px';
      card.style.overflow = 'hidden';
    } else {
      card.style.maxHeight = 'none';
      card.style.overflow = '';
    }

    // Position setup
    card.style.top = 'auto';
    card.style.bottom = 'auto';
    card.style.left = 'auto';
    card.style.right = 'auto';
    card.style.transform = 'none';

    var ox = s.offsetX + 'px';
    var oy = s.offsetY + 'px';

    if (s.position === 'top-left') {
      card.style.top = '6%'; card.style.left = '4%';
      card.style.transform = 'translate(' + ox + ', ' + oy + ')';
    } else if (s.position === 'top-center') {
      card.style.top = '6%'; card.style.left = '50%';
      card.style.transform = 'translate(calc(-50% + ' + ox + '), ' + oy + ')';
    } else if (s.position === 'top-right') {
      card.style.top = '6%'; card.style.right = '4%';
      card.style.transform = 'translate(' + ox + ', ' + oy + ')';
    } else if (s.position === 'middle-left') {
      card.style.top = '50%'; card.style.left = '4%';
      card.style.transform = 'translate(' + ox + ', calc(-50% + ' + oy + '))';
    } else if (s.position === 'center') {
      card.style.top = '50%'; card.style.left = '50%';
      card.style.transform = 'translate(calc(-50% + ' + ox + '), calc(-50% + ' + oy + '))';
    } else if (s.position === 'middle-right') {
      card.style.top = '50%'; card.style.right = '4%';
      card.style.transform = 'translate(' + ox + ', calc(-50% + ' + oy + '))';
    } else if (s.position === 'bottom-left') {
      card.style.bottom = '6%'; card.style.left = '4%';
      card.style.transform = 'translate(' + ox + ', ' + oy + ')';
    } else if (s.position === 'bottom-center') {
      card.style.bottom = '6%'; card.style.left = '50%';
      card.style.transform = 'translate(calc(-50% + ' + ox + '), ' + oy + ')';
    } else if (s.position === 'bottom-right') {
      card.style.bottom = '6%'; card.style.right = '4%';
      card.style.transform = 'translate(' + ox + ', ' + oy + ')';
    }

    // Typography & Media
    var mediaEl = card.querySelector('.stage-media-1');
    if (mediaEl) {
      var iSize = s.imageSize || 80;
      mediaEl.style.width = iSize + 'px';
      mediaEl.style.height = iSize + 'px';
      mediaEl.style.borderRadius = (s.imageRadius !== undefined ? s.imageRadius : 14) + 'px';
      mediaEl.style.transform = 'translate(' + (s.imageOffsetX||0) + 'px, ' + (s.imageOffsetY||0) + 'px)';
      var img = mediaEl.querySelector('img');
      if (img) img.style.objectFit = s.imageFit || 'cover';
    }

    var mediaEl2 = card.querySelector('.stage-media-2');
    if (mediaEl2) {
      var iSize2 = s.image2Size || 80;
      mediaEl2.style.width = iSize2 + 'px';
      mediaEl2.style.height = iSize2 + 'px';
      mediaEl2.style.borderRadius = (s.image2Radius !== undefined ? s.image2Radius : 14) + 'px';
      mediaEl2.style.transform = 'translate(' + (s.image2OffsetX||0) + 'px, ' + (s.image2OffsetY||0) + 'px)';
      if (s.image2Absolute) {
        mediaEl2.style.position = 'absolute';
      } else {
        mediaEl2.style.position = '';
      }
      var img2 = mediaEl2.querySelector('img');
      if (img2) img2.style.objectFit = s.image2Fit || 'cover';
    }

    var mediaEl3 = card.querySelector('.stage-media-3');
    if (mediaEl3) {
      var iSize3 = s.image3Size || 80;
      mediaEl3.style.width = iSize3 + 'px';
      mediaEl3.style.height = iSize3 + 'px';
      mediaEl3.style.borderRadius = (s.image3Radius !== undefined ? s.image3Radius : 14) + 'px';
      mediaEl3.style.transform = 'translate(' + (s.image3OffsetX||0) + 'px, ' + (s.image3OffsetY||0) + 'px)';
      if (s.image3Absolute) {
        mediaEl3.style.position = 'absolute';
      } else {
        mediaEl3.style.position = '';
      }
      var img3 = mediaEl3.querySelector('img');
      if (img3) img3.style.objectFit = s.image3Fit || 'cover';
    }

    var titleEl = card.querySelector('.stage-title');
    if (titleEl) {
      titleEl.style.fontFamily = s.titleFont;
      titleEl.style.fontWeight = s.titleWeight;
      titleEl.style.fontSize = s.titleSize + 'px';
      titleEl.style.color = s.titleColor;
      titleEl.style.transform = 'translate(' + (s.titleOffsetX||0) + 'px, ' + (s.titleOffsetY||0) + 'px)';
      if (s.titleShadowBlur > 0 || s.titleShadowX || s.titleShadowY) {
        titleEl.style.textShadow = (s.titleShadowX||0) + 'px ' + (s.titleShadowY||0) + 'px ' + (s.titleShadowBlur||0) + 'px ' + (s.titleShadowColor||'#000000');
      } else {
        titleEl.style.textShadow = 'none';
      }
    }

    var subEl = card.querySelector('.stage-subtitle');
    if (subEl) {
      subEl.style.fontFamily = s.subtitleFont;
      subEl.style.fontWeight = s.subtitleWeight;
      subEl.style.fontSize = s.subtitleSize + 'px';
      subEl.style.color = s.subtitleColor;
      subEl.style.transform = 'translate(' + (s.subtitleOffsetX||0) + 'px, ' + (s.subtitleOffsetY||0) + 'px)';
      if (s.subtitleShadowBlur > 0 || s.subtitleShadowX || s.subtitleShadowY) {
        subEl.style.textShadow = (s.subtitleShadowX||0) + 'px ' + (s.subtitleShadowY||0) + 'px ' + (s.subtitleShadowBlur||0) + 'px ' + (s.subtitleShadowColor||'#000000');
      } else {
        subEl.style.textShadow = 'none';
      }
    }

    var descEl = card.querySelector('.stage-description');
    if (descEl) {
      descEl.style.fontFamily = s.descFont;
      descEl.style.fontWeight = s.descWeight;
      descEl.style.fontSize = s.descSize + 'px';
      descEl.style.color = s.descColor;
      descEl.style.transform = 'translate(' + (s.descOffsetX||0) + 'px, ' + (s.descOffsetY||0) + 'px)';
      if (s.descShadowBlur > 0 || s.descShadowX || s.descShadowY) {
        descEl.style.textShadow = (s.descShadowX||0) + 'px ' + (s.descShadowY||0) + 'px ' + (s.descShadowBlur||0) + 'px ' + (s.descShadowColor||'#000000');
      } else {
        descEl.style.textShadow = 'none';
      }
    }

    // Layout class management (keeps class in sync during live style updates)
    var layout = s.layout || 'lower-third';
    card.className = card.className.replace(/\blayout-\S+/g, '').trim();
    if (layout !== 'lower-third') {
      card.classList.add('layout-' + layout);
    }

    // Layout-specific positioning overrides
    if (layout === 'fullscreen') {
      card.style.top = '0';
      card.style.left = '0';
      card.style.right = '0';
      card.style.bottom = '0';
      card.style.width = '100vw';
      card.style.height = '100vh';
      card.style.transform = 'none';
      card.style.borderRadius = '0';
      card.style.maxWidth = 'none';
    } else if (layout === 'side-panel') {
      card.style.top = '0';
      card.style.bottom = '0';
      card.style.height = '100vh';
      card.style.width = '350px';
      card.style.maxWidth = '350px';
      card.style.transform = 'none';
      if (s.position && s.position.indexOf('right') !== -1) {
        card.style.left = 'auto';
        card.style.right = '0';
      } else {
        card.style.left = '0';
        card.style.right = 'auto';
      }
    } else if (layout === 'ticker') {
      card.style.bottom = '0';
      card.style.left = '0';
      card.style.right = '0';
      card.style.top = 'auto';
      card.style.width = '100vw';
      card.style.height = 'auto';
      card.style.transform = 'none';
      card.style.borderRadius = '0';
    }
  }

  // ---------- Transition offset helpers ----------

  function getEntryOffset(transition) {
    switch (transition) {
      case 'slide-left':  return { x: '80px',  y: '0',    scale: null };
      case 'slide-right': return { x: '-80px', y: '0',    scale: null };
      case 'slide-up':    return { x: '0',     y: '80px', scale: null };
      case 'slide-down':  return { x: '0',     y: '-80px',scale: null };
      case 'zoom':        return { x: '0',     y: '0',    scale: '1.15' };
      case 'scale':       return { x: '0',     y: '0',    scale: '0.9' };
      default:            return { x: '0',     y: '0',    scale: null }; // fade
    }
  }

  function getExitOffset(transition) {
    switch (transition) {
      case 'slide-left':  return { x: '-80px', y: '0',    scale: null };
      case 'slide-right': return { x: '80px',  y: '0',    scale: null };
      case 'slide-up':    return { x: '0',     y: '-80px',scale: null };
      case 'slide-down':  return { x: '0',     y: '0',    scale: null };
      case 'zoom':        return { x: '0',     y: '0',    scale: '0.85' };
      case 'scale':       return { x: '0',     y: '0',    scale: '1.1' };
      default:            return { x: '0',     y: '0',    scale: null }; // fade
    }
  }

  function buildTransformWithOffset(baseTransform, offset) {
    var base = baseTransform || 'none';
    if (base === 'none') base = '';
    var extra = '';
    if (offset.x !== '0' || offset.y !== '0') {
      extra += ' translate(' + offset.x + ', ' + offset.y + ')';
    }
    if (offset.scale) {
      extra += ' scale(' + offset.scale + ')';
    }
    return (base + extra).trim() || 'none';
  }

  // ---------- Rendering ----------

  function renderCard(a) {
    // Collect ALL existing cards (handles rapid switching where old cards are still mid-exit)
    var allExisting = stage.querySelectorAll('.ann-card-stage');
    var transition = currentStyle.transition || 'fade';
    var entryOffset = getEntryOffset(transition);

    var card = document.createElement('div');
    card.className = 'ann-card-stage';
    var layout = currentStyle.layout || 'lower-third';
    if (layout !== 'lower-third') {
      card.classList.add('layout-' + layout);
    }

    if (a.image) {
      var media = document.createElement('div');
      media.className = 'stage-media stage-media-1';
      var img = document.createElement('img');
      img.src = a.image;
      img.alt = '';
      media.appendChild(img);
      card.appendChild(media);
    }

    if (a.image2) {
      var media2 = document.createElement('div');
      media2.className = 'stage-media stage-media-2';
      var img2 = document.createElement('img');
      img2.src = a.image2;
      img2.alt = '';
      media2.appendChild(img2);
      card.appendChild(media2);
    }

    if (a.image3) {
      var media3 = document.createElement('div');
      media3.className = 'stage-media stage-media-3';
      var img3 = document.createElement('img');
      img3.src = a.image3;
      img3.alt = '';
      media3.appendChild(img3);
      card.appendChild(media3);
    }

    var body = document.createElement('div');
    body.className = 'stage-body';

    var title = document.createElement('div');
    title.className = 'stage-title';
    title.textContent = a.title || '';
    body.appendChild(title);

    if (a.subtitle) {
      var subtitle = document.createElement('div');
      subtitle.className = 'stage-subtitle';
      subtitle.textContent = a.subtitle;
      body.appendChild(subtitle);
    }

    if (a.description) {
      var desc = document.createElement('div');
      desc.className = 'stage-description';
      desc.innerHTML = sanitizeDescriptionHtml(a.description);
      body.appendChild(desc);
    }

    card.appendChild(body);

    // Disable CSS transition while setting up initial state
    card.style.transition = 'none';

    stage.appendChild(card);
    
    // Apply all styles (this sets the final position transform)
    applyStylesToCard(card);

    // Capture the final position transform that applyStylesToCard set
    var finalTransform = card.style.transform || 'none';
    // Store it on the element so we can use it for exit too
    card.setAttribute('data-final-transform', finalTransform);

    // Set the entry transform (final position + entry offset)
    card.style.transform = buildTransformWithOffset(finalTransform, entryOffset);
    card.style.opacity = '0';

    // Force layout reflow so the browser commits the starting state
    void card.offsetWidth;

    // Re-enable CSS transition, then animate to the final position
    card.style.transition = '';
    requestAnimationFrame(function () {
      card.style.transform = finalTransform;
      card.style.opacity = '1';
      card.classList.add('visible');
    });

    // Animate out ALL existing cards (prevents overlap on rapid switching)
    var exitOffset = getExitOffset(transition);
    for (var i = 0; i < allExisting.length; i++) {
      (function (old) {
        // If already being animated out (marked), just remove immediately
        if (old.getAttribute('data-exiting')) {
          old.remove();
          return;
        }
        old.setAttribute('data-exiting', '1');
        var outgoingFinal = old.getAttribute('data-final-transform') || 'none';
        old.classList.remove('visible');
        old.style.opacity = '0';
        old.style.transform = buildTransformWithOffset(outgoingFinal, exitOffset);
        setTimeout(function () { if (old.parentNode) old.remove(); }, 650);
      })(allExisting[i]);
    }
  }

  function clearStage() {
    var allCards = stage.querySelectorAll('.ann-card-stage');
    if (!allCards.length) return;
    var transition = currentStyle ? (currentStyle.transition || 'fade') : 'fade';
    var exitOffset = getExitOffset(transition);
    for (var i = 0; i < allCards.length; i++) {
      (function (card) {
        var finalTransform = card.getAttribute('data-final-transform') || 'none';
        card.classList.remove('visible');
        card.style.opacity = '0';
        card.style.transform = buildTransformWithOffset(finalTransform, exitOffset);
        setTimeout(function () { if (card.parentNode) card.remove(); }, 650);
      })(allCards[i]);
    }
  }
})();
