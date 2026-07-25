// app.js

(function () {
  'use strict';

  var STORAGE_LIST = 'cas_list';
  var STORAGE_CURRENT = 'cas_current';
  var STORAGE_STYLE = 'cas_style';
  var STORAGE_PRESETS = 'cas_presets';

  var listEl = document.getElementById('ann-list');
  var emptyHint = document.getElementById('empty-hint');
  var countEl = document.getElementById('list-count');
  var form = document.getElementById('ann-form');
  var formTitle = document.getElementById('form-title');
  var saveBtn = document.getElementById('btn-save');
  var cancelBtn = document.getElementById('btn-cancel-edit');
  var tally = document.getElementById('tally');

  var fTitle = document.getElementById('f-title');
  var fSubtitle = document.getElementById('f-subtitle');
  var fDescription = document.getElementById('f-description');
  var fImage = document.getElementById('f-image');
  var fImagePreview = document.getElementById('f-image-preview');
  var btnClearImage = document.getElementById('btn-clear-image');

  var fImage2 = document.getElementById('f-image2');
  var fImagePreview2 = document.getElementById('f-image2-preview');
  var btnClearImage2 = document.getElementById('btn-clear-image2');

  var fImage3 = document.getElementById('f-image3');
  var fImagePreview3 = document.getElementById('f-image3-preview');
  var btnClearImage3 = document.getElementById('btn-clear-image3');

  var announcements = loadList();
  var styleConfig = loadStyle();
  var editingId = null;
  var currentImageData = null;
  var currentImageData2 = null;
  var currentImageData3 = null;
  var liveId = getCurrentLiveId();

  // Undo delete state
  var deletedItem = null;
  var deletedIndex = -1;
  var undoTimer = null;

  // Rich text helpers
  function stripHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = sanitizeDescriptionHtml(html);
    return tmp.textContent || tmp.innerText || '';
  }

  // Descriptions are intentionally rich text, but they must never carry scripts,
  // event handlers, or arbitrary markup into the OBS browser source.
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

  function getDescHtml() {
    var html = fDescription.innerHTML.trim();
    return fDescription.textContent.trim() ? sanitizeDescriptionHtml(html) : '';
  }

  // Presets
  var presets = loadPresets();

  // ---------- Default Style Configuration ----------
  function getDefaultStyle() {
    return {
      transition: 'fade',
      layout: 'lower-third',

      titleFont: "'Inter', sans-serif",
      titleWeight: "800",
      titleSize: 40,
      titleColor: "#FFFFFF",
      titleOffsetX: 0,
      titleOffsetY: 0,
      titleShadowX: 0,
      titleShadowY: 2,
      titleShadowBlur: 4,
      titleShadowColor: "#000000",

      subtitleFont: "'Inter', sans-serif",
      subtitleWeight: "600",
      subtitleSize: 19,
      subtitleColor: "#CCCCCC",
      subtitleOffsetX: 0,
      subtitleOffsetY: 0,
      subtitleShadowX: 0,
      subtitleShadowY: 0,
      subtitleShadowBlur: 0,
      subtitleShadowColor: "#000000",

      descFont: "'Inter', sans-serif",
      descWeight: "400",
      descSize: 15,
      descColor: "#AAAAAA",
      descOffsetX: 0,
      descOffsetY: 0,
      descShadowX: 0,
      descShadowY: 0,
      descShadowBlur: 0,
      descShadowColor: "#000000",

      imageSize: 80,
      imageRadius: 14,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageFit: "cover",

      image2Size: 80,
      image2Radius: 14,
      image2OffsetX: 0,
      image2OffsetY: 0,
      image2Absolute: false,
      image2Fit: "cover",

      image3Size: 80,
      image3Radius: 14,
      image3OffsetX: 0,
      image3OffsetY: 0,
      image3Absolute: false,
      image3Fit: "cover",

      bgType: "transparent",
      bgColor: "#000000",
      bgOpacity: 0.5,
      bgGradient1: "#000000",
      bgGradient2: "#333333",
      bgAngle: 90,
      bgImage: null,
      bgImageSize: "cover",
      bgImageX: 50,
      bgImageY: 50,
      bgImageRepeat: false,
      bgImageScaleW: 100,
      bgImageScaleH: 100,
      backdropBlur: 0,

      borderWidth: 0,
      borderColor: "#FFFFFF",
      borderRadius: 20,
      padding: 32,
      shadowOpacity: 0.5,

      position: "bottom-center",
      offsetX: 0,
      offsetY: 0,
      maxWidth: 1300,
      maxHeight: 0
    };
  }

  function mergeStyleWithDefaults(style) {
    var merged = getDefaultStyle();
    if (!style || typeof style !== 'object') return merged;
    Object.keys(style).forEach(function (key) { merged[key] = style[key]; });
    return merged;
  }

  // ---------- Storage helpers ----------

  function loadList() {
    try {
      var raw = localStorage.getItem(STORAGE_LIST);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map(function (announcement) {
        if (!announcement || typeof announcement !== 'object') return announcement;
        announcement.description = sanitizeDescriptionHtml(announcement.description);
        if (announcement.style) announcement.style = mergeStyleWithDefaults(announcement.style);
        return announcement;
      });
    } catch (e) {
      return [];
    }
  }

  function saveList() {
    try {
      localStorage.setItem(STORAGE_LIST, JSON.stringify(announcements));
    } catch (e) {
      alert("Failed to save. You may have run out of browser storage space. Try deleting some older announcements or clearing large images.");
      console.error("Storage error:", e);
    }
  }

  function loadStyle() {
    try {
      var raw = localStorage.getItem(STORAGE_STYLE);
      var parsed = raw ? JSON.parse(raw) : null;
      return mergeStyleWithDefaults(parsed);
    } catch (e) {
      return getDefaultStyle();
    }
  }

  function saveStyle() {
    if (editingId) {
      var a = announcements.find(function (x) { return x.id === editingId; });
      if (a) {
        a.style = JSON.parse(JSON.stringify(styleConfig));
        saveList();
        if (editingId === liveId) {
          // Send style-only broadcast so it updates inline without re-entering
          if (channel) {
            try { channel.postMessage({ type: 'style', config: a.style }); } catch (e) { }
          }
          // Update the current payload in storage without changing ts, so pollers pick it up silently
          try {
            var raw = localStorage.getItem(STORAGE_CURRENT);
            if (raw) {
              var curr = JSON.parse(raw);
              curr.announcement = a;
              localStorage.setItem(STORAGE_CURRENT, JSON.stringify(curr));
            }
          } catch (e) { }
          // Refresh the live preview with updated styles
          refreshPreview();
        }
      }
    } else {
      localStorage.setItem(STORAGE_STYLE, JSON.stringify(styleConfig));
      broadcastStyleUpdate();
      // Refresh the live preview if one is showing
      refreshPreview();
    }
  }

  function getCurrentLiveId() {
    try {
      var raw = localStorage.getItem(STORAGE_CURRENT);
      if (!raw) return null;
      var data = JSON.parse(raw);
      return data.hidden ? null : (data.announcement ? data.announcement.id : null);
    } catch (e) {
      return null;
    }
  }

  function uid() {
    return 'ann_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Presets Storage ----------

  function loadPresets() {
    try {
      var raw = localStorage.getItem(STORAGE_PRESETS);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function savePresets() {
    try {
      localStorage.setItem(STORAGE_PRESETS, JSON.stringify(presets));
    } catch (e) {
      alert('Failed to save presets. Storage may be full.');
    }
  }

  // ---------- Tabs ----------
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      tabContents.forEach(function (c) { c.classList.remove('active'); });

      btn.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // ---------- Rendering the list ----------

  function render() {
    listEl.innerHTML = '';
    countEl.textContent = '(' + announcements.length + ')';
    emptyHint.classList.toggle('visible', announcements.length === 0);

    announcements.forEach(function (a, index) {
      listEl.appendChild(buildCard(a, index));
    });
  }

  function buildCard(a, index) {
    var card = document.createElement('div');
    card.className = 'ann-card' + (a.id === liveId ? ' live' : '');
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.title = 'Click to show this on screen';

    var thumb;
    if (a.image) {
      thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.src = a.image;
      thumb.alt = '';
    } else {
      thumb = document.createElement('div');
      thumb.className = 'thumb';
    }

    var main = document.createElement('div');
    main.className = 'card-main';
    var titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    titleEl.textContent = a.title || 'Untitled';
    var metaEl = document.createElement('div');
    metaEl.className = 'card-meta';
    var descPlain = a.description ? stripHtml(a.description) : '';
    metaEl.textContent = a.subtitle ? a.subtitle : (descPlain ? descPlain.substring(0, 20) + '...' : '');
    main.appendChild(titleEl);
    main.appendChild(metaEl);

    var orderBtns = document.createElement('div');
    orderBtns.className = 'order-btns';
    var upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = '\u25B2';
    upBtn.title = 'Move up';
    upBtn.addEventListener('click', function (e) { e.stopPropagation(); moveItem(index, -1); });
    var downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = '\u25BC';
    downBtn.title = 'Move down';
    downBtn.addEventListener('click', function (e) { e.stopPropagation(); moveItem(index, 1); });
    orderBtns.appendChild(upBtn);
    orderBtns.appendChild(downBtn);

    var actions = document.createElement('div');
    actions.className = 'card-actions';
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      startEdit(a.id);
      // switch to announcement tab automatically
      document.querySelector('[data-tab="tab-announcements"]').click();
    });
    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function (e) { e.stopPropagation(); deleteItem(a.id); });
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(thumb);
    card.appendChild(main);
    card.appendChild(orderBtns);
    card.appendChild(actions);

    card.addEventListener('click', function () { showAnnouncement(a.id); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showAnnouncement(a.id); }
    });

    return card;
  }

  // ---------- Add / edit form ----------

  function resizeImage(file, callback, errorCallback) {
    var maxImageBytes = 1024 * 1024;
    var maxSourceBytes = 20 * 1024 * 1024;
    if (file.size > maxSourceBytes) {
      errorCallback('Please choose an image smaller than 20 MB.');
      return;
    }

    var reader = new FileReader();
    reader.onerror = function () { errorCallback('The selected image could not be read.'); };
    reader.onload = function (e) {
      var img = new Image();
      img.onerror = function () { errorCallback('The selected file is not a supported image.'); };
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var max_size = 1280;
        var width = img.width;
        var height = img.height;

        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }

        var type = file.type === 'image/png' ? 'image/png' : (file.type === 'image/webp' ? 'image/webp' : 'image/jpeg');
        var dataUrl = '';
        var attempts = 0;
        while (attempts < 4) {
          canvas.width = Math.max(1, Math.round(width));
          canvas.height = Math.max(1, Math.round(height));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          var quality = type === 'image/jpeg' ? Math.max(0.6, 0.88 - attempts * 0.1) : (type === 'image/webp' ? Math.max(0.6, 0.9 - attempts * 0.1) : undefined);
          dataUrl = canvas.toDataURL(type, quality);
          if (Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75) <= maxImageBytes) break;
          type = 'image/webp';
          width *= 0.8;
          height *= 0.8;
          attempts++;
        }

        if (Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75) > maxImageBytes) {
          errorCallback('This image is still too large after compression. Please choose a smaller image.');
          return;
        }
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function setupImageUpload(inputEl, previewEl, clearBtn, updateDataFn) {
    inputEl.addEventListener('change', function () {
      var file = inputEl.files && inputEl.files[0];
      if (!file) return;
      resizeImage(file, function (dataUrl) {
        updateDataFn(dataUrl);
        previewEl.src = dataUrl;
        previewEl.hidden = false;
        clearBtn.hidden = false;
      }, function (message) { alert(message); inputEl.value = ''; });
    });

    clearBtn.addEventListener('click', function () {
      updateDataFn(null);
      inputEl.value = '';
      previewEl.src = '';
      previewEl.hidden = true;
      clearBtn.hidden = true;
    });
  }

  setupImageUpload(fImage, fImagePreview, btnClearImage, function (d) { currentImageData = d; });
  setupImageUpload(fImage2, fImagePreview2, btnClearImage2, function (d) { currentImageData2 = d; });
  setupImageUpload(fImage3, fImagePreview3, btnClearImage3, function (d) { currentImageData3 = d; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = fTitle.value.trim();
    if (!title) return;

    if (editingId) {
      // --- EDITING an existing announcement ---
      var idx = -1;
      for (var i = 0; i < announcements.length; i++) {
        if (announcements[i].id === editingId) { idx = i; break; }
      }
      if (idx === -1) { stopEdit(); resetForm(); return; }

      var savedId = announcements[idx].id;
      var wasLive = (savedId === liveId);

      // Build the updated object explicitly (don't rely on Object.assign)
      announcements[idx] = {
        id: savedId,
        title: title,
        subtitle: fSubtitle.value.trim(),
        description: getDescHtml(),
        image: currentImageData,
        image2: currentImageData2,
        image3: currentImageData3,
        style: JSON.parse(JSON.stringify(styleConfig))
      };

      saveList();

      if (wasLive) {
        var payload = { announcement: announcements[idx], ts: Date.now() };
        localStorage.setItem(STORAGE_CURRENT, JSON.stringify(payload));
        broadcast(payload);
      }

      stopEdit();
      resetForm();
      render();
    } else {
      // --- ADDING a new announcement ---
      var newAnn = {
        id: uid(),
        title: title,
        subtitle: fSubtitle.value.trim(),
        description: getDescHtml(),
        image: currentImageData,
        image2: currentImageData2,
        image3: currentImageData3,
        style: JSON.parse(JSON.stringify(styleConfig))
      };
      announcements.push(newAnn);
      saveList();

      // Reset style to fresh defaults so the next announcement starts clean
      styleConfig = getDefaultStyle();
      localStorage.setItem(STORAGE_STYLE, JSON.stringify(styleConfig));
      initStyleForm();

      resetForm();
      render();
    }
  });

  cancelBtn.addEventListener('click', function () {
    stopEdit();
    resetForm();
  });

  document.getElementById('btn-floating-save').addEventListener('click', function () {
    if (editingId) form.requestSubmit();
  });
  document.getElementById('btn-floating-cancel').addEventListener('click', function () {
    stopEdit();
    resetForm();
  });

  function startEdit(id) {
    var a = announcements.find(function (x) { return x.id === id; });
    if (!a) return;
    editingId = id;
    formTitle.textContent = 'Edit Announcement';
    saveBtn.textContent = 'Save Changes';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.hidden = false;

    var badge = document.getElementById('style-context-badge');
    if (badge) badge.textContent = '(Editing ' + (a.title || 'Untitled') + ')';

    if (a.style) {
      styleConfig = mergeStyleWithDefaults(a.style);
    } else {
      styleConfig = loadStyle();
    }
    initStyleForm();

    fTitle.value = a.title || '';
    fSubtitle.value = a.subtitle || '';
    fDescription.innerHTML = sanitizeDescriptionHtml(a.description);

    currentImageData = a.image || null;
    if (currentImageData) {
      fImagePreview.src = currentImageData;
      fImagePreview.hidden = false;
      btnClearImage.hidden = false;
    } else {
      fImagePreview.hidden = true;
      btnClearImage.hidden = true;
    }

    currentImageData2 = a.image2 || null;
    if (currentImageData2) {
      fImagePreview2.src = currentImageData2;
      fImagePreview2.hidden = false;
      btnClearImage2.hidden = false;
    } else {
      fImagePreview2.hidden = true;
      btnClearImage2.hidden = true;
    }

    currentImageData3 = a.image3 || null;
    if (currentImageData3) {
      fImagePreview3.src = currentImageData3;
      fImagePreview3.hidden = false;
      btnClearImage3.hidden = false;
    } else {
      fImagePreview3.hidden = true;
      btnClearImage3.hidden = true;
    }

    fTitle.focus();

    var floatBar = document.getElementById('floating-save');
    var floatLabel = document.getElementById('floating-save-label');
    if (floatBar) {
      floatLabel.textContent = 'Editing: ' + (a.title || 'Untitled');
      floatBar.hidden = false;
    }

  }

  function stopEdit() {
    editingId = null;
    formTitle.textContent = 'Add Announcement';
    saveBtn.textContent = '+ Add Announcement';
    cancelBtn.hidden = true;

    var floatBar = document.getElementById('floating-save');
    if (floatBar) floatBar.hidden = true;

    var badge = document.getElementById('style-context-badge');
    if (badge) badge.textContent = '(Global Default)';

    // Always reset to fresh defaults so the next announcement starts clean
    styleConfig = getDefaultStyle();
    initStyleForm();
  }

  function resetForm() {
    form.reset();
    fDescription.innerHTML = '';
    currentImageData = null;
    fImagePreview.hidden = true;
    fImagePreview.src = '';
    btnClearImage.hidden = true;

    currentImageData2 = null;
    fImagePreview2.hidden = true;
    fImagePreview2.src = '';
    btnClearImage2.hidden = true;

    currentImageData3 = null;
    fImagePreview3.hidden = true;
    fImagePreview3.src = '';
    btnClearImage3.hidden = true;
  }

  function deleteItem(id) {
    // Find the item and its index before removing
    var idx = -1;
    for (var i = 0; i < announcements.length; i++) {
      if (announcements[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return;

    // Store for undo
    deletedItem = JSON.parse(JSON.stringify(announcements[idx]));
    deletedIndex = idx;

    // Remove it
    announcements.splice(idx, 1);
    saveList();
    if (liveId === id) hideAnnouncement();
    render();

    // Show undo toast
    showUndoToast('"' + (deletedItem.title || 'Untitled') + '" deleted.');
  }

  // ---------- Undo Delete ----------

  function showUndoToast(msg) {
    var toast = document.getElementById('undo-toast');
    var toastMsg = document.getElementById('undo-toast-msg');
    toastMsg.textContent = msg;
    toast.classList.add('visible');
    // Re-trigger animation
    toast.style.animation = 'none';
    void toast.offsetWidth;
    toast.style.animation = '';

    // Auto-dismiss after 8 seconds
    clearTimeout(undoTimer);
    undoTimer = setTimeout(function () {
      dismissUndo();
    }, 8000);
  }

  function dismissUndo() {
    clearTimeout(undoTimer);
    var toast = document.getElementById('undo-toast');
    toast.classList.remove('visible');
    deletedItem = null;
    deletedIndex = -1;
  }

  function performUndo() {
    if (!deletedItem) return;
    // Re-insert at original position
    if (deletedIndex >= 0 && deletedIndex <= announcements.length) {
      announcements.splice(deletedIndex, 0, deletedItem);
    } else {
      announcements.push(deletedItem);
    }
    saveList();
    render();
    dismissUndo();
  }

  document.getElementById('btn-undo').addEventListener('click', performUndo);
  document.getElementById('btn-undo-dismiss').addEventListener('click', dismissUndo);

  function moveItem(index, direction) {
    var newIndex = index + direction;
    if (newIndex < 0 || newIndex >= announcements.length) return;
    var tmp = announcements[index];
    announcements[index] = announcements[newIndex];
    announcements[newIndex] = tmp;
    saveList();
    render();
  }

  // ---------- Style & Position Syncing ----------

  // Custom font helper: wires a font <select> + text <input> pair
  function setupCustomFont(selectId, customInputId, customLabelId, configKey) {
    var sel = document.getElementById(selectId);
    var inp = document.getElementById(customInputId);
    var lbl = document.getElementById(customLabelId);

    function showCustom(show) {
      lbl.hidden = !show;
    }

    // When select changes
    sel.addEventListener('change', function () {
      if (sel.value === '__custom__') {
        showCustom(true);
        inp.focus();
        // Use whatever is already typed, or fallback
        var v = inp.value.trim();
        if (v) {
          styleConfig[configKey] = "'" + v + "', sans-serif";
          saveStyle();
        }
      } else {
        showCustom(false);
        styleConfig[configKey] = sel.value;
        saveStyle();
      }
    });

    // When custom input changes
    inp.addEventListener('input', function () {
      var v = inp.value.trim();
      if (v) {
        styleConfig[configKey] = "'" + v + "', sans-serif";
      } else {
        styleConfig[configKey] = "'Inter', sans-serif";
      }
      saveStyle();
    });
  }

  // Restore custom font state on form init
  function restoreCustomFontState(selectId, customInputId, customLabelId, savedValue) {
    var sel = document.getElementById(selectId);
    var inp = document.getElementById(customInputId);
    var lbl = document.getElementById(customLabelId);

    // Try setting the select to the saved value
    sel.value = savedValue;

    // If it didn't match any option, it's a custom font
    if (sel.value !== savedValue) {
      sel.value = '__custom__';
      // Extract font name from "'FontName', sans-serif" format
      var match = savedValue.match(/^'([^']+)'/);
      inp.value = match ? match[1] : savedValue;
      lbl.hidden = false;
    } else if (savedValue === '__custom__') {
      // Edge case: raw __custom__ stored (shouldn't happen, but be safe)
      sel.value = '__custom__';
      lbl.hidden = false;
    } else {
      lbl.hidden = true;
    }
  }

  function initStyleForm() {
    // Populate form from styleConfig
    document.getElementById('s-layout').value = styleConfig.layout || 'lower-third';
    document.getElementById('s-transition').value = styleConfig.transition;

    restoreCustomFontState('s-title-font', 's-title-font-custom', 's-title-font-custom-label', styleConfig.titleFont);
    document.getElementById('s-title-weight').value = styleConfig.titleWeight;
    document.getElementById('s-title-size').value = styleConfig.titleSize;
    document.getElementById('s-title-color').value = styleConfig.titleColor;
    document.getElementById('s-title-offset-x').value = styleConfig.titleOffsetX || 0;
    document.getElementById('s-title-offset-y').value = styleConfig.titleOffsetY || 0;
    document.getElementById('s-title-shadow-x').value = styleConfig.titleShadowX || 0;
    document.getElementById('s-title-shadow-y').value = styleConfig.titleShadowY !== undefined ? styleConfig.titleShadowY : 2;
    document.getElementById('s-title-shadow-blur').value = styleConfig.titleShadowBlur !== undefined ? styleConfig.titleShadowBlur : 4;
    document.getElementById('s-title-shadow-color').value = styleConfig.titleShadowColor || '#000000';

    restoreCustomFontState('s-subtitle-font', 's-subtitle-font-custom', 's-subtitle-font-custom-label', styleConfig.subtitleFont);
    document.getElementById('s-subtitle-weight').value = styleConfig.subtitleWeight;
    document.getElementById('s-subtitle-size').value = styleConfig.subtitleSize;
    document.getElementById('s-subtitle-color').value = styleConfig.subtitleColor;
    document.getElementById('s-subtitle-offset-x').value = styleConfig.subtitleOffsetX || 0;
    document.getElementById('s-subtitle-offset-y').value = styleConfig.subtitleOffsetY || 0;
    document.getElementById('s-subtitle-shadow-x').value = styleConfig.subtitleShadowX || 0;
    document.getElementById('s-subtitle-shadow-y').value = styleConfig.subtitleShadowY || 0;
    document.getElementById('s-subtitle-shadow-blur').value = styleConfig.subtitleShadowBlur || 0;
    document.getElementById('s-subtitle-shadow-color').value = styleConfig.subtitleShadowColor || '#000000';

    restoreCustomFontState('s-desc-font', 's-desc-font-custom', 's-desc-font-custom-label', styleConfig.descFont);
    document.getElementById('s-desc-weight').value = styleConfig.descWeight;
    document.getElementById('s-desc-size').value = styleConfig.descSize;
    document.getElementById('s-desc-color').value = styleConfig.descColor;
    document.getElementById('s-desc-offset-x').value = styleConfig.descOffsetX || 0;
    document.getElementById('s-desc-offset-y').value = styleConfig.descOffsetY || 0;
    document.getElementById('s-desc-shadow-x').value = styleConfig.descShadowX || 0;
    document.getElementById('s-desc-shadow-y').value = styleConfig.descShadowY || 0;
    document.getElementById('s-desc-shadow-blur').value = styleConfig.descShadowBlur || 0;
    document.getElementById('s-desc-shadow-color').value = styleConfig.descShadowColor || '#000000';

    document.getElementById('s-image-size').value = styleConfig.imageSize || 80;
    document.getElementById('s-image-radius').value = styleConfig.imageRadius || 14;
    document.getElementById('s-image-offset-x').value = styleConfig.imageOffsetX || 0;
    document.getElementById('s-image-offset-y').value = styleConfig.imageOffsetY || 0;
    document.getElementById('s-image-fit').value = styleConfig.imageFit || 'cover';

    document.getElementById('s-image2-size').value = styleConfig.image2Size || 80;
    document.getElementById('s-image2-radius').value = styleConfig.image2Radius || 14;
    document.getElementById('s-image2-offset-x').value = styleConfig.image2OffsetX || 0;
    document.getElementById('s-image2-offset-y').value = styleConfig.image2OffsetY || 0;
    document.getElementById('s-image2-absolute').checked = !!styleConfig.image2Absolute;
    document.getElementById('s-image2-fit').value = styleConfig.image2Fit || 'cover';

    document.getElementById('s-image3-size').value = styleConfig.image3Size || 80;
    document.getElementById('s-image3-radius').value = styleConfig.image3Radius || 14;
    document.getElementById('s-image3-offset-x').value = styleConfig.image3OffsetX || 0;
    document.getElementById('s-image3-offset-y').value = styleConfig.image3OffsetY || 0;
    document.getElementById('s-image3-absolute').checked = !!styleConfig.image3Absolute;
    document.getElementById('s-image3-fit').value = styleConfig.image3Fit || 'cover';

    document.getElementById('s-bg-type').value = styleConfig.bgType;
    updateBgVisibility();

    document.getElementById('s-bg-color').value = styleConfig.bgColor;
    document.getElementById('s-bg-opacity').value = styleConfig.bgOpacity;
    document.getElementById('s-bg-gradient1').value = styleConfig.bgGradient1;
    document.getElementById('s-bg-gradient2').value = styleConfig.bgGradient2;
    document.getElementById('s-bg-angle').value = styleConfig.bgAngle;

    document.getElementById('s-bg-image-size').value = styleConfig.bgImageSize || "cover";
    document.getElementById('s-bg-image-x').value = styleConfig.bgImageX || 50;
    document.getElementById('s-bg-image-y').value = styleConfig.bgImageY || 50;
    document.getElementById('s-bg-image-repeat').checked = !!styleConfig.bgImageRepeat;
    var scaleW = styleConfig.bgImageScaleW || 100;
    var scaleH = styleConfig.bgImageScaleH || 100;
    document.getElementById('s-bg-image-scale-w').value = scaleW;
    document.getElementById('s-bg-image-scale-w-val').textContent = scaleW + '%';
    document.getElementById('s-bg-image-scale-h').value = scaleH;
    document.getElementById('s-bg-image-scale-h-val').textContent = scaleH + '%';
    updateBgImageManualVisibility();

    document.getElementById('s-backdrop-blur').value = styleConfig.backdropBlur;

    document.getElementById('s-border-width').value = styleConfig.borderWidth;
    document.getElementById('s-border-color').value = styleConfig.borderColor;
    document.getElementById('s-border-radius').value = styleConfig.borderRadius;
    document.getElementById('s-padding').value = styleConfig.padding;
    document.getElementById('s-shadow-opacity').value = styleConfig.shadowOpacity;

    // Position
    document.querySelectorAll('.pos-preset').forEach(function (btn) {
      if (btn.getAttribute('data-pos') === styleConfig.position) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.getElementById('p-offset-x').value = styleConfig.offsetX;
    document.getElementById('p-offset-y').value = styleConfig.offsetY;
    document.getElementById('p-max-width').value = styleConfig.maxWidth;
    document.getElementById('p-max-height').value = styleConfig.maxHeight || 0;
  }

  function updateBgVisibility() {
    var type = document.getElementById('s-bg-type').value;
    document.getElementById('s-bg-solid-group').hidden = (type !== 'solid' && type !== 'image');
    document.getElementById('s-bg-gradient-group').hidden = type !== 'gradient';
    document.getElementById('s-bg-image-group').hidden = type !== 'image';
    document.getElementById('s-bg-image-options').hidden = type !== 'image';
    if (type !== 'image') {
      document.getElementById('s-bg-image-manual-group').hidden = true;
    } else {
      updateBgImageManualVisibility();
    }
  }

  function updateBgImageManualVisibility() {
    var sizeVal = document.getElementById('s-bg-image-size').value;
    document.getElementById('s-bg-image-manual-group').hidden = sizeVal !== '__manual__';
  }

  document.getElementById('s-bg-type').addEventListener('change', updateBgVisibility);
  document.getElementById('s-bg-image-size').addEventListener('change', updateBgImageManualVisibility);

  function attachStyleListeners() {
    var inputs = [
      { id: 's-layout', key: 'layout', type: 'string' },
      { id: 's-transition', key: 'transition', type: 'string' },

      { id: 's-title-weight', key: 'titleWeight', type: 'string' },
      { id: 's-title-size', key: 'titleSize', type: 'number' },
      { id: 's-title-color', key: 'titleColor', type: 'string' },
      { id: 's-title-offset-x', key: 'titleOffsetX', type: 'number' },
      { id: 's-title-offset-y', key: 'titleOffsetY', type: 'number' },

      { id: 's-subtitle-weight', key: 'subtitleWeight', type: 'string' },
      { id: 's-subtitle-size', key: 'subtitleSize', type: 'number' },
      { id: 's-subtitle-color', key: 'subtitleColor', type: 'string' },
      { id: 's-subtitle-offset-x', key: 'subtitleOffsetX', type: 'number' },
      { id: 's-subtitle-offset-y', key: 'subtitleOffsetY', type: 'number' },

      { id: 's-desc-weight', key: 'descWeight', type: 'string' },
      { id: 's-desc-size', key: 'descSize', type: 'number' },
      { id: 's-desc-color', key: 'descColor', type: 'string' },
      { id: 's-desc-offset-x', key: 'descOffsetX', type: 'number' },
      { id: 's-desc-offset-y', key: 'descOffsetY', type: 'number' },

      { id: 's-title-shadow-x', key: 'titleShadowX', type: 'number' },
      { id: 's-title-shadow-y', key: 'titleShadowY', type: 'number' },
      { id: 's-title-shadow-blur', key: 'titleShadowBlur', type: 'number' },
      { id: 's-title-shadow-color', key: 'titleShadowColor', type: 'string' },

      { id: 's-subtitle-shadow-x', key: 'subtitleShadowX', type: 'number' },
      { id: 's-subtitle-shadow-y', key: 'subtitleShadowY', type: 'number' },
      { id: 's-subtitle-shadow-blur', key: 'subtitleShadowBlur', type: 'number' },
      { id: 's-subtitle-shadow-color', key: 'subtitleShadowColor', type: 'string' },

      { id: 's-desc-shadow-x', key: 'descShadowX', type: 'number' },
      { id: 's-desc-shadow-y', key: 'descShadowY', type: 'number' },
      { id: 's-desc-shadow-blur', key: 'descShadowBlur', type: 'number' },
      { id: 's-desc-shadow-color', key: 'descShadowColor', type: 'string' },

      { id: 's-image-size', key: 'imageSize', type: 'number' },
      { id: 's-image-radius', key: 'imageRadius', type: 'number' },
      { id: 's-image-offset-x', key: 'imageOffsetX', type: 'number' },
      { id: 's-image-offset-y', key: 'imageOffsetY', type: 'number' },
      { id: 's-image-fit', key: 'imageFit', type: 'string' },

      { id: 's-image2-size', key: 'image2Size', type: 'number' },
      { id: 's-image2-radius', key: 'image2Radius', type: 'number' },
      { id: 's-image2-offset-x', key: 'image2OffsetX', type: 'number' },
      { id: 's-image2-offset-y', key: 'image2OffsetY', type: 'number' },
      { id: 's-image2-fit', key: 'image2Fit', type: 'string' },

      { id: 's-image3-size', key: 'image3Size', type: 'number' },
      { id: 's-image3-radius', key: 'image3Radius', type: 'number' },
      { id: 's-image3-offset-x', key: 'image3OffsetX', type: 'number' },
      { id: 's-image3-offset-y', key: 'image3OffsetY', type: 'number' },
      { id: 's-image3-fit', key: 'image3Fit', type: 'string' },

      { id: 's-bg-type', key: 'bgType', type: 'string' },
      { id: 's-bg-color', key: 'bgColor', type: 'string' },
      { id: 's-bg-opacity', key: 'bgOpacity', type: 'number' },
      { id: 's-bg-gradient1', key: 'bgGradient1', type: 'string' },
      { id: 's-bg-gradient2', key: 'bgGradient2', type: 'string' },
      { id: 's-bg-angle', key: 'bgAngle', type: 'number' },
      { id: 's-backdrop-blur', key: 'backdropBlur', type: 'number' },

      { id: 's-bg-image-size', key: 'bgImageSize', type: 'string' },
      { id: 's-bg-image-x', key: 'bgImageX', type: 'number' },
      { id: 's-bg-image-y', key: 'bgImageY', type: 'number' },
      { id: 's-bg-image-repeat', key: 'bgImageRepeat', type: 'boolean' },

      { id: 's-border-width', key: 'borderWidth', type: 'number' },
      { id: 's-border-color', key: 'borderColor', type: 'string' },
      { id: 's-border-radius', key: 'borderRadius', type: 'number' },
      { id: 's-padding', key: 'padding', type: 'number' },
      { id: 's-shadow-opacity', key: 'shadowOpacity', type: 'number' },

      { id: 'p-offset-x', key: 'offsetX', type: 'number' },
      { id: 'p-offset-y', key: 'offsetY', type: 'number' },
      { id: 'p-max-width', key: 'maxWidth', type: 'number' },
      { id: 'p-max-height', key: 'maxHeight', type: 'number' },
    ];

    inputs.forEach(function (item) {
      document.getElementById(item.id).addEventListener(item.type === 'boolean' ? 'change' : 'input', function (e) {
        if (item.type === 'number') {
          styleConfig[item.key] = parseFloat(e.target.value) || 0;
        } else if (item.type === 'boolean') {
          styleConfig[item.key] = e.target.checked;
        } else {
          styleConfig[item.key] = e.target.value;
        }
        saveStyle();
      });
    });

    // Custom font select+input wiring
    setupCustomFont('s-title-font', 's-title-font-custom', 's-title-font-custom-label', 'titleFont');
    setupCustomFont('s-subtitle-font', 's-subtitle-font-custom', 's-subtitle-font-custom-label', 'subtitleFont');
    setupCustomFont('s-desc-font', 's-desc-font-custom', 's-desc-font-custom-label', 'descFont');

    ['s-image2-absolute', 's-image3-absolute'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function (e) {
        var key = id === 's-image2-absolute' ? 'image2Absolute' : 'image3Absolute';
        styleConfig[key] = e.target.checked;
        saveStyle();
      });
    });

    // Special handlers for background image
    var bgFileInput = document.getElementById('s-bg-image-file');
    bgFileInput.addEventListener('change', function () {
      var file = bgFileInput.files && bgFileInput.files[0];
      if (!file) return;
      resizeImage(file, function (dataUrl) {
        styleConfig.bgImage = dataUrl;
        saveStyle();
      }, function (message) { alert(message); bgFileInput.value = ''; });
    });

    document.getElementById('s-bg-image-clear').addEventListener('click', function () {
      styleConfig.bgImage = null;
      bgFileInput.value = '';
      saveStyle();
    });

    // Manual background scale sliders
    document.getElementById('s-bg-image-scale-w').addEventListener('input', function (e) {
      var val = parseInt(e.target.value) || 100;
      styleConfig.bgImageScaleW = val;
      document.getElementById('s-bg-image-scale-w-val').textContent = val + '%';
      saveStyle();
    });
    document.getElementById('s-bg-image-scale-h').addEventListener('input', function (e) {
      var val = parseInt(e.target.value) || 100;
      styleConfig.bgImageScaleH = val;
      document.getElementById('s-bg-image-scale-h-val').textContent = val + '%';
      saveStyle();
    });

    // Position presets
    document.querySelectorAll('.pos-preset').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.pos-preset').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        styleConfig.position = btn.getAttribute('data-pos');
        saveStyle();
      });
    });

    document.getElementById('btn-reset-style').addEventListener('click', function () {
      if (confirm('Are you sure you want to reset all styles and positions to default?')) {
        styleConfig = getDefaultStyle();
        saveStyle();
        initStyleForm();
      }
    });
  }


  // ---------- Showing on the display / OBS output ----------

  function showAnnouncement(id) {
    var a = announcements.find(function (x) { return x.id === id; });
    if (!a) return;
    liveId = id;
    tally.classList.add('live');

    var payload = { announcement: a, ts: Date.now() };
    localStorage.setItem(STORAGE_CURRENT, JSON.stringify(payload));
    broadcast(payload);

    render();
    updatePreview(a);
  }

  function hideAnnouncement() {
    liveId = null;
    var payload = { hidden: true, ts: Date.now() };
    localStorage.setItem(STORAGE_CURRENT, JSON.stringify(payload));
    broadcast(payload);
    tally.classList.remove('live');
    render();
    updatePreview(null);
  }

  // Best-effort instant update for pages open in the same browser session.
  var channel = null;
  try {
    if ('BroadcastChannel' in window) channel = new BroadcastChannel('church-announcements');
  } catch (e) { channel = null; }

  function broadcast(payload) {
    if (!channel) return;
    try { channel.postMessage({ type: 'content', payload: payload }); } catch (e) { /* ignore */ }
  }

  function broadcastStyleUpdate() {
    if (!channel) return;
    try { channel.postMessage({ type: 'style', config: styleConfig }); } catch (e) { /* ignore */ }
  }

  // ---------- Toolbar ----------

  document.getElementById('btn-hide').addEventListener('click', hideAnnouncement);

  document.getElementById('btn-out').addEventListener('click', function () {
    if (!liveId) return;
    // Broadcast the "out" command to the display so it animates the exit
    if (channel) {
      try { channel.postMessage({ type: 'out' }); } catch (e) { /* ignore */ }
    }
    // Also write a hidden payload so polling picks it up
    liveId = null;
    var payload = { hidden: true, ts: Date.now() };
    localStorage.setItem(STORAGE_CURRENT, JSON.stringify(payload));
    tally.classList.remove('live');
    render();
    updatePreview(null);
  });
  document.getElementById('btn-open-display').addEventListener('click', function () {
    window.open('display.html', 'cas-display', 'width=1280,height=720');
  });

  document.getElementById('btn-export').addEventListener('click', function () {
    var json = JSON.stringify({ announcements: announcements, style: styleConfig }, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'church-announcements-backup.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-import').addEventListener('click', function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!Array.isArray(data.announcements)) throw new Error('Invalid file.');
          announcements = data.announcements.map(function (announcement) {
            if (!announcement || typeof announcement !== 'object') throw new Error('Invalid announcement.');
            announcement.description = sanitizeDescriptionHtml(announcement.description);
            if (announcement.style) announcement.style = mergeStyleWithDefaults(announcement.style);
            return announcement;
          });
          if (data.style) {
            styleConfig = mergeStyleWithDefaults(data.style);
          }
          saveList();
          saveStyle();
          render();
          initStyleForm();
        } catch (err) {
          alert('Could not import file: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // ---------- Live Preview ----------

  var previewStage = document.getElementById('live-preview-stage');

  function updatePreview(ann) {
    if (!previewStage) return;
    previewStage.innerHTML = '';

    if (!ann) {
      var ph = document.createElement('p');
      ph.className = 'preview-placeholder';
      ph.textContent = 'Click an announcement to preview it here.';
      previewStage.appendChild(ph);
      return;
    }

    var s = ann.style || getDefaultStyle();

    var card = document.createElement('div');
    card.className = 'ann-card-stage';
    var pvLayout = s.layout || 'lower-third';
    if (pvLayout !== 'lower-third') {
      card.classList.add('layout-' + pvLayout);
    }

    if (ann.image) {
      var media = document.createElement('div');
      media.className = 'stage-media stage-media-1';
      var img = document.createElement('img');
      img.src = ann.image;
      img.alt = '';
      media.appendChild(img);
      card.appendChild(media);
    }

    if (ann.image2) {
      var media2 = document.createElement('div');
      media2.className = 'stage-media stage-media-2';
      var img2 = document.createElement('img');
      img2.src = ann.image2;
      img2.alt = '';
      media2.appendChild(img2);
      card.appendChild(media2);
    }

    if (ann.image3) {
      var media3 = document.createElement('div');
      media3.className = 'stage-media stage-media-3';
      var img3 = document.createElement('img');
      img3.src = ann.image3;
      img3.alt = '';
      media3.appendChild(img3);
      card.appendChild(media3);
    }

    var body = document.createElement('div');
    body.className = 'stage-body';

    var title = document.createElement('div');
    title.className = 'stage-title';
    title.textContent = ann.title || '';
    body.appendChild(title);

    if (ann.subtitle) {
      var subtitle = document.createElement('div');
      subtitle.className = 'stage-subtitle';
      subtitle.textContent = ann.subtitle;
      body.appendChild(subtitle);
    }

    if (ann.description) {
      var desc = document.createElement('div');
      desc.className = 'stage-description';
      desc.innerHTML = sanitizeDescriptionHtml(ann.description);
      body.appendChild(desc);
    }

    card.appendChild(body);
    previewStage.appendChild(card);

    applyPreviewStyles(card, s);
  }

  function applyPreviewStyles(card, s) {
    // Background
    var bg = 'transparent';
    if (s.bgType === 'solid') {
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
      bg = null; // skip shorthand
    }
    if (bg !== null) card.style.background = bg;
    if (s.backdropBlur > 0) {
      card.style.backdropFilter = 'blur(' + s.backdropBlur + 'px)';
      card.style.webkitBackdropFilter = 'blur(' + s.backdropBlur + 'px)';
    }

    card.style.border = s.borderWidth > 0 ? s.borderWidth + 'px solid ' + s.borderColor : 'none';
    card.style.borderRadius = Math.max(s.borderRadius * 0.4, 4) + 'px';
    card.style.padding = Math.max(s.padding * 0.4, 6) + 'px';
    card.style.boxShadow = s.shadowOpacity > 0 ? '0 4px 16px rgba(0,0,0,' + s.shadowOpacity + ')' : 'none';
    card.style.gap = '10px';

    // Scale everything to fit the preview container
    var container = document.getElementById('live-preview-container');
    if (!container) return;
    var containerW = container.offsetWidth || 400;
    var containerH = container.offsetHeight || 225;
    var refW = 1280;
    var scale = containerW / refW;

    // Card sizing
    var cardMaxW = (s.maxWidth > 0 ? Math.min(s.maxWidth, refW * 0.88) : refW * 0.88);
    card.style.width = (cardMaxW * scale) + 'px';
    if (s.maxHeight > 0) {
      var cardMaxH = Math.min(s.maxHeight, 720 * 0.88);
      card.style.maxHeight = (cardMaxH * scale) + 'px';
      card.style.overflow = 'hidden';
    } else {
      card.style.maxHeight = 'none';
      card.style.overflow = '';
    }

    // Position
    var ox = (s.offsetX || 0) * scale;
    var oy = (s.offsetY || 0) * scale;

    if (s.position === 'top-left') {
      card.style.top = (containerH * 0.06 + oy) + 'px';
      card.style.left = (containerW * 0.04 + ox) + 'px';
    } else if (s.position === 'top-center') {
      card.style.top = (containerH * 0.06 + oy) + 'px';
      card.style.left = ((containerW - cardMaxW * scale) / 2 + ox) + 'px';
    } else if (s.position === 'top-right') {
      card.style.top = (containerH * 0.06 + oy) + 'px';
      card.style.right = (containerW * 0.04 - ox) + 'px';
    } else if (s.position === 'middle-left') {
      card.style.top = '50%';
      card.style.left = (containerW * 0.04 + ox) + 'px';
      card.style.transform = 'translateY(calc(-50% + ' + oy + 'px))';
    } else if (s.position === 'center') {
      card.style.top = '50%';
      card.style.left = ((containerW - cardMaxW * scale) / 2 + ox) + 'px';
      card.style.transform = 'translateY(calc(-50% + ' + oy + 'px))';
    } else if (s.position === 'middle-right') {
      card.style.top = '50%';
      card.style.right = (containerW * 0.04 - ox) + 'px';
      card.style.transform = 'translateY(calc(-50% + ' + oy + 'px))';
    } else if (s.position === 'bottom-left') {
      card.style.bottom = (containerH * 0.06 - oy) + 'px';
      card.style.left = (containerW * 0.04 + ox) + 'px';
    } else if (s.position === 'bottom-center' || !s.position) {
      card.style.bottom = (containerH * 0.06 - oy) + 'px';
      card.style.left = ((containerW - cardMaxW * scale) / 2 + ox) + 'px';
    } else if (s.position === 'bottom-right') {
      card.style.bottom = (containerH * 0.06 - oy) + 'px';
      card.style.right = (containerW * 0.04 - ox) + 'px';
    }

    // Typography — scale font sizes
    var mediaEl = card.querySelector('.stage-media-1');
    if (mediaEl) {
      var iSize = Math.max((s.imageSize || 80) * scale, 16);
      mediaEl.style.width = iSize + 'px';
      mediaEl.style.height = iSize + 'px';
      mediaEl.style.borderRadius = ((s.imageRadius !== undefined ? s.imageRadius : 14) * scale) + 'px';
      mediaEl.style.transform = 'translate(' + ((s.imageOffsetX||0) * scale) + 'px, ' + ((s.imageOffsetY||0) * scale) + 'px)';
      var imgEl = mediaEl.querySelector('img');
      if (imgEl) imgEl.style.objectFit = s.imageFit || 'cover';
    }

    var mediaEl2 = card.querySelector('.stage-media-2');
    if (mediaEl2) {
      var iSize2 = Math.max((s.image2Size || 80) * scale, 16);
      mediaEl2.style.width = iSize2 + 'px';
      mediaEl2.style.height = iSize2 + 'px';
      mediaEl2.style.borderRadius = ((s.image2Radius !== undefined ? s.image2Radius : 14) * scale) + 'px';
      mediaEl2.style.transform = 'translate(' + ((s.image2OffsetX||0) * scale) + 'px, ' + ((s.image2OffsetY||0) * scale) + 'px)';
      var imgEl2 = mediaEl2.querySelector('img');
      if (imgEl2) imgEl2.style.objectFit = s.image2Fit || 'cover';
    }

    var mediaEl3 = card.querySelector('.stage-media-3');
    if (mediaEl3) {
      var iSize3 = Math.max((s.image3Size || 80) * scale, 16);
      mediaEl3.style.width = iSize3 + 'px';
      mediaEl3.style.height = iSize3 + 'px';
      mediaEl3.style.borderRadius = ((s.image3Radius !== undefined ? s.image3Radius : 14) * scale) + 'px';
      mediaEl3.style.transform = 'translate(' + ((s.image3OffsetX||0) * scale) + 'px, ' + ((s.image3OffsetY||0) * scale) + 'px)';
      var imgEl3 = mediaEl3.querySelector('img');
      if (imgEl3) imgEl3.style.objectFit = s.image3Fit || 'cover';
    }

    var titleEl = card.querySelector('.stage-title');
    if (titleEl) {
      titleEl.style.fontFamily = s.titleFont;
      titleEl.style.fontWeight = s.titleWeight;
      titleEl.style.fontSize = Math.max(s.titleSize * scale, 8) + 'px';
      titleEl.style.color = s.titleColor;
      titleEl.style.lineHeight = '1.15';
      titleEl.style.transform = 'translate(' + ((s.titleOffsetX||0) * scale) + 'px, ' + ((s.titleOffsetY||0) * scale) + 'px)';
      if (s.titleShadowBlur > 0 || s.titleShadowX || s.titleShadowY) {
        titleEl.style.textShadow = (s.titleShadowX || 0) * scale + 'px ' + (s.titleShadowY || 0) * scale + 'px ' + (s.titleShadowBlur || 0) * scale + 'px ' + (s.titleShadowColor || '#000000');
      } else {
        titleEl.style.textShadow = 'none';
      }
    }

    var subEl = card.querySelector('.stage-subtitle');
    if (subEl) {
      subEl.style.fontFamily = s.subtitleFont;
      subEl.style.fontWeight = s.subtitleWeight;
      subEl.style.fontSize = Math.max(s.subtitleSize * scale, 6) + 'px';
      subEl.style.color = s.subtitleColor;
      subEl.style.marginTop = '2px';
      subEl.style.transform = 'translate(' + ((s.subtitleOffsetX||0) * scale) + 'px, ' + ((s.subtitleOffsetY||0) * scale) + 'px)';
      if (s.subtitleShadowBlur > 0 || s.subtitleShadowX || s.subtitleShadowY) {
        subEl.style.textShadow = (s.subtitleShadowX || 0) * scale + 'px ' + (s.subtitleShadowY || 0) * scale + 'px ' + (s.subtitleShadowBlur || 0) * scale + 'px ' + (s.subtitleShadowColor || '#000000');
      } else {
        subEl.style.textShadow = 'none';
      }
    }

    var descEl = card.querySelector('.stage-description');
    if (descEl) {
      descEl.style.fontFamily = s.descFont;
      descEl.style.fontWeight = s.descWeight;
      descEl.style.fontSize = Math.max(s.descSize * scale, 5) + 'px';
      descEl.style.color = s.descColor;
      descEl.style.marginTop = '3px';
      descEl.style.lineHeight = '1.3';
      descEl.style.transform = 'translate(' + ((s.descOffsetX||0) * scale) + 'px, ' + ((s.descOffsetY||0) * scale) + 'px)';
      if (s.descShadowBlur > 0 || s.descShadowX || s.descShadowY) {
        descEl.style.textShadow = (s.descShadowX || 0) * scale + 'px ' + (s.descShadowY || 0) * scale + 'px ' + (s.descShadowBlur || 0) * scale + 'px ' + (s.descShadowColor || '#000000');
      } else {
        descEl.style.textShadow = 'none';
      }
    }

    // Layout-specific preview overrides
    var pvLayout = s.layout || 'lower-third';
    if (pvLayout === 'fullscreen') {
      card.style.width = containerW + 'px';
      card.style.height = containerH + 'px';
      card.style.top = '0';
      card.style.left = '0';
      card.style.bottom = 'auto';
      card.style.right = 'auto';
      card.style.transform = 'none';
      card.style.borderRadius = '0';
    } else if (pvLayout === 'side-panel') {
      var panelW = Math.min(containerW * 0.3, 120);
      card.style.width = panelW + 'px';
      card.style.height = containerH + 'px';
      card.style.top = '0';
      card.style.bottom = '0';
      if (s.position && s.position.indexOf('right') !== -1) {
        card.style.left = 'auto';
        card.style.right = '0';
      } else {
        card.style.left = '0';
        card.style.right = 'auto';
      }
      card.style.transform = 'none';
    } else if (pvLayout === 'ticker') {
      card.style.width = containerW + 'px';
      card.style.height = 'auto';
      card.style.top = 'auto';
      card.style.bottom = '0';
      card.style.left = '0';
      card.style.right = '0';
      card.style.transform = 'none';
      card.style.borderRadius = '0';
      card.style.padding = Math.max(s.padding * 0.2, 3) + 'px';
    }
  }

  // Refresh preview with current live announcement's latest data
  function refreshPreview() {
    if (!liveId) return;
    var a = announcements.find(function (x) { return x.id === liveId; });
    if (a) updatePreview(a);
  }

  // Show preview of last live item on boot
  if (liveId) {
    var liveAnn = announcements.find(function (x) { return x.id === liveId; });
    if (liveAnn) updatePreview(liveAnn);
  }

  // ---------- Style Presets ----------

  var presetListEl = document.getElementById('preset-list');
  var presetEmptyHint = document.getElementById('preset-empty-hint');
  var presetNameInput = document.getElementById('preset-name');
  var quickPresetSelect = document.getElementById('s-quick-preset');

  function renderPresetList() {
    presetListEl.innerHTML = '';
    presetEmptyHint.classList.toggle('visible', presets.length === 0);

    presets.forEach(function (preset, index) {
      var card = document.createElement('div');
      card.className = 'preset-card';

      var info = document.createElement('div');
      info.style.flex = '1';
      var nameEl = document.createElement('div');
      nameEl.className = 'preset-name';
      nameEl.textContent = preset.name;
      var metaEl = document.createElement('div');
      metaEl.className = 'preset-meta';
      var keys = Object.keys(preset.style || {}).length;
      metaEl.textContent = keys + ' style properties';
      info.appendChild(nameEl);
      info.appendChild(metaEl);

      var actions = document.createElement('div');
      actions.className = 'preset-actions';

      var applyBtn = document.createElement('button');
      applyBtn.className = 'apply-preset';
      applyBtn.textContent = 'Apply';
      applyBtn.addEventListener('click', function () {
        applyPreset(index);
      });

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-preset';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function () {
        deletePreset(index);
      });

      actions.appendChild(applyBtn);
      actions.appendChild(deleteBtn);

      card.appendChild(info);
      card.appendChild(actions);
      presetListEl.appendChild(card);
    });
  }

  function populatePresetDropdown() {
    while (quickPresetSelect.options.length > 1) {
      quickPresetSelect.remove(1);
    }
    presets.forEach(function (preset, index) {
      var opt = document.createElement('option');
      opt.value = index;
      opt.textContent = preset.name;
      quickPresetSelect.appendChild(opt);
    });
  }

  function saveCurrentAsPreset() {
    var name = presetNameInput.value.trim();
    if (!name) {
      alert('Please enter a name for the preset.');
      presetNameInput.focus();
      return;
    }

    var exists = presets.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); });
    if (exists) {
      if (!confirm('A preset named "' + name + '" already exists. Overwrite it?')) return;
      presets = presets.filter(function (p) { return p.name.toLowerCase() !== name.toLowerCase(); });
    }

    presets.push({
      name: name,
      style: JSON.parse(JSON.stringify(styleConfig)),
      createdAt: Date.now()
    });

    savePresets();
    renderPresetList();
    populatePresetDropdown();
    presetNameInput.value = '';
  }

  function applyPreset(index) {
    var preset = presets[index];
    if (!preset) return;

    styleConfig = mergeStyleWithDefaults(preset.style);
    initStyleForm();
    saveStyle();

    // Also apply to the live announcement if not currently editing,
    // so the preview and OBS display output reflect the preset
    if (!editingId && liveId) {
      var a = announcements.find(function (x) { return x.id === liveId; });
      if (a) {
        a.style = JSON.parse(JSON.stringify(styleConfig));
        saveList();
        if (channel) {
          try { channel.postMessage({ type: 'style', config: a.style }); } catch (e) { }
        }
        try {
          var raw = localStorage.getItem(STORAGE_CURRENT);
          if (raw) {
            var curr = JSON.parse(raw);
            curr.announcement = a;
            localStorage.setItem(STORAGE_CURRENT, JSON.stringify(curr));
          }
        } catch (e) { }
        refreshPreview();
      }
    }

    document.querySelector('[data-tab="tab-style"]').click();
  }

  function deletePreset(index) {
    if (!confirm('Delete preset "' + presets[index].name + '"?')) return;
    presets.splice(index, 1);
    savePresets();
    renderPresetList();
    populatePresetDropdown();
  }

  document.getElementById('btn-save-preset').addEventListener('click', saveCurrentAsPreset);

  document.getElementById('btn-quick-apply-preset').addEventListener('click', function () {
    var val = quickPresetSelect.value;
    if (val === '') return;
    applyPreset(parseInt(val, 10));
    quickPresetSelect.value = '';
  });

  // ---------- Boot ----------

  initStyleForm();
  attachStyleListeners();
  render();
  renderPresetList();
  populatePresetDropdown();

  // Rich text toolbar
  document.querySelectorAll('.rt-btn').forEach(function (btn) {
    btn.addEventListener('mousedown', function (e) {
      e.preventDefault(); // prevent focus loss from contenteditable
    });
    btn.addEventListener('click', function () {
      document.execCommand(btn.getAttribute('data-cmd'), false, null);
      fDescription.focus();
    });
  });

})();
