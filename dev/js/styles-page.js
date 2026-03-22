(function () {
  'use strict';

  var THEME_STORAGE_KEY = 'proagri-theme-settings';
  var STYLE_STORAGE_KEY = 'proagri-style-overrides';

  var FONT_OPTIONS = [
    { label: 'System Default', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    { label: 'Inter', value: "'Inter', sans-serif", import: 'Inter:wght@400;500;600;700' },
    { label: 'Poppins', value: "'Poppins', sans-serif", import: 'Poppins:wght@400;500;600;700' },
    { label: 'Nunito', value: "'Nunito', sans-serif", import: 'Nunito:wght@400;500;600;700' },
    { label: 'DM Sans', value: "'DM Sans', sans-serif", import: 'DM+Sans:wght@400;500;600;700' },
    { label: 'Source Sans 3', value: "'Source Sans 3', sans-serif", import: 'Source+Sans+3:wght@400;500;600;700' },
    { label: 'Roboto', value: "'Roboto', sans-serif", import: 'Roboto:wght@400;500;700' },
    { label: 'Open Sans', value: "'Open Sans', sans-serif", import: 'Open+Sans:wght@400;500;600;700' },
    { label: 'Lato', value: "'Lato', sans-serif", import: 'Lato:wght@400;700' },
    { label: 'Montserrat', value: "'Montserrat', sans-serif", import: 'Montserrat:wght@400;500;600;700' },
    { label: 'Raleway', value: "'Raleway', sans-serif", import: 'Raleway:wght@400;500;600;700' },
    { label: 'IBM Plex Sans', value: "'IBM Plex Sans', sans-serif", import: 'IBM+Plex+Sans:wght@400;500;600;700' }
  ];

  var DEFAULTS = {
    '--font-family': FONT_OPTIONS[0].value,
    '--font-size-heading': '32',
    '--font-size-subtitle': '20',
    '--font-size-body': '14',
    '--font-size-small': '12',
    '--text-primary-dark': '#ffffff',
    '--text-secondary-dark': '#bbbbbb',
    '--text-muted-dark': '#888888',
    '--text-primary-light': '#1a1a1a',
    '--text-secondary-light': '#444444',
    '--text-muted-light': '#666666',
    '--color-accent-light': '#f5a623',
    '--color-accent-dark': '#d4791a'
  };

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function getSetting(key) {
    var settings = loadSettings();
    return settings[key] !== undefined ? settings[key] : DEFAULTS[key];
  }

  function loadGoogleFont(fontOption) {
    if (!fontOption.import) return;
    var id = 'gfont-' + fontOption.import.replace(/[^a-z0-9]/gi, '-');
    if (document.getElementById(id)) return;
    var link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + fontOption.import + '&display=swap';
    document.head.appendChild(link);
  }

  function applySettings() {
    var settings = loadSettings();
    var root = document.documentElement;

    // Font family
    var fontVal = settings['--font-family'] || DEFAULTS['--font-family'];
    root.style.setProperty('--font-family', fontVal);
    var fontOpt = FONT_OPTIONS.find(function (f) { return f.value === fontVal; });
    if (fontOpt) loadGoogleFont(fontOpt);

    // Font sizes
    ['--font-size-heading', '--font-size-subtitle', '--font-size-body', '--font-size-small'].forEach(function (key) {
      var val = settings[key] || DEFAULTS[key];
      root.style.setProperty(key, val + 'px');
    });

    // Accent colors
    if (settings['--color-accent-light']) root.style.setProperty('--color-accent-light', settings['--color-accent-light']);
    if (settings['--color-accent-dark']) root.style.setProperty('--color-accent-dark', settings['--color-accent-dark']);

    // Text colors — dark mode (applied to :root)
    if (settings['--text-primary-dark']) root.style.setProperty('--text-primary', settings['--text-primary-dark']);
    if (settings['--text-secondary-dark']) root.style.setProperty('--text-secondary', settings['--text-secondary-dark']);
    if (settings['--text-muted-dark']) root.style.setProperty('--text-muted', settings['--text-muted-dark']);

    // Text colors — light mode: inject/update a style tag
    applyLightModeTextColors(settings);
  }

  function applyLightModeTextColors(settings) {
    var styleId = 'proagri-theme-light-overrides';
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();

    var primary = settings['--text-primary-light'] || DEFAULTS['--text-primary-light'];
    var secondary = settings['--text-secondary-light'] || DEFAULTS['--text-secondary-light'];
    var muted = settings['--text-muted-light'] || DEFAULTS['--text-muted-light'];

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent =
      '[data-theme="light"] { --text-primary: ' + primary + '; --text-secondary: ' + secondary + '; --text-muted: ' + muted + '; }';
    document.head.appendChild(style);
  }

  // Apply on page load — run immediately for fast paint, then again after DOMContentLoaded
  applySettings();
  document.addEventListener('DOMContentLoaded', function () {
    applySettings();
  });

  // --- Utility functions from the old styles page ---

  function getAllCssVars() {
    var vars = {};
    try {
      var sheets = document.styleSheets;
      for (var i = 0; i < sheets.length; i++) {
        try {
          var rules = sheets[i].cssRules;
          for (var j = 0; j < rules.length; j++) {
            if (rules[j].selectorText === ':root') {
              var text = rules[j].cssText;
              var matches = text.match(/--[\w-]+\s*:\s*[^;]+/g);
              if (matches) {
                matches.forEach(function (m) {
                  var idx = m.indexOf(':');
                  vars[m.substring(0, idx).trim()] = m.substring(idx + 1).trim();
                });
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    return vars;
  }

  function getComputed(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function isColorValue(value) {
    return /^#[0-9a-fA-F]{3,8}$/.test(value) ||
      /^rgb/.test(value) ||
      /^hsl/.test(value) ||
      /^[a-z]{3,20}$/.test(value);
  }

  function rgbToHex(rgb) {
    var match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return rgb;
    var r = parseInt(match[1], 10);
    var g = parseInt(match[2], 10);
    var b = parseInt(match[3], 10);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function resolveToHex(varName) {
    var computed = getComputed(varName);
    if (!computed) return '#000000';
    if (computed.indexOf('rgb') === 0) return rgbToHex(computed);
    if (computed.charAt(0) === '#') return computed;
    return '#000000';
  }

  function saveStyleOverrides() {
    var overrides = {};
    var style = document.documentElement.style;
    for (var i = 0; i < style.length; i++) {
      var prop = style[i];
      if (prop.indexOf('--') === 0) {
        overrides[prop] = style.getPropertyValue(prop);
      }
    }
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(overrides));
  }

  function resetStyleOverrides() {
    var style = document.documentElement.style;
    var toRemove = [];
    for (var i = 0; i < style.length; i++) {
      var prop = style[i];
      if (prop.indexOf('--') === 0) {
        toRemove.push(prop);
      }
    }
    toRemove.forEach(function (prop) {
      style.removeProperty(prop);
    });
    localStorage.removeItem(STYLE_STORAGE_KEY);
  }

  // --- Render the unified Styles & Settings page ---

  window.renderStylesPage = function (container) {
    var settings = loadSettings();
    var pendingChanges = {};
    var allVars = getAllCssVars();
    var varNames = Object.keys(allVars);

    function getPending(key) {
      return pendingChanges[key] !== undefined ? pendingChanges[key] : getSetting(key);
    }

    function setPending(key, value) {
      pendingChanges[key] = value;
    }

    var page = document.createElement('div');
    page.className = 'dev-page';

    // ===== (a) Header =====
    var header = document.createElement('div');
    header.className = 'dev-page-header';

    var title = document.createElement('h1');
    title.className = 'dev-page-title';
    title.textContent = 'Styles & Settings';
    header.appendChild(title);

    var actions = document.createElement('div');
    actions.className = 'dev-page-actions';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'dev-btn dev-btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function () {
      // Save theme settings
      var merged = loadSettings();
      Object.keys(pendingChanges).forEach(function (key) {
        merged[key] = pendingChanges[key];
      });
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(merged));
      applySettings();

      // Save style overrides for backwards compatibility
      saveStyleOverrides();

      saveBtn.textContent = 'Saved!';
      saveBtn.classList.add('saved');
      setTimeout(function () {
        saveBtn.textContent = 'Save';
        saveBtn.classList.remove('saved');
      }, 1500);
    });

    var resetBtn = document.createElement('button');
    resetBtn.className = 'dev-btn dev-btn-ghost';
    resetBtn.textContent = 'Reset to Defaults';
    resetBtn.addEventListener('click', function () {
      // Reset theme settings
      localStorage.removeItem(THEME_STORAGE_KEY);
      var root = document.documentElement;
      Object.keys(DEFAULTS).forEach(function (key) {
        var cssKey = key.replace(/-dark$/, '').replace(/-light$/, '');
        root.style.removeProperty(cssKey);
      });
      root.style.removeProperty('--font-family');
      root.style.removeProperty('--font-size-heading');
      root.style.removeProperty('--font-size-subtitle');
      root.style.removeProperty('--font-size-body');
      root.style.removeProperty('--font-size-small');
      root.style.removeProperty('--text-primary');
      root.style.removeProperty('--text-secondary');
      root.style.removeProperty('--text-muted');
      root.style.removeProperty('--color-accent-light');
      root.style.removeProperty('--color-accent-dark');
      var lightOverride = document.getElementById('proagri-theme-light-overrides');
      if (lightOverride) lightOverride.remove();

      // Reset style overrides
      resetStyleOverrides();

      pendingChanges = {};
      container.textContent = '';
      window.renderStylesPage(container);
    });

    actions.appendChild(saveBtn);
    actions.appendChild(resetBtn);
    header.appendChild(actions);
    page.appendChild(header);

    // ===== (b) Font Family Section =====
    var fontSection = document.createElement('div');
    fontSection.className = 'settings-section';

    var fontTitle = document.createElement('h2');
    fontTitle.className = 'settings-section-title';
    fontTitle.textContent = 'Font Family';
    fontSection.appendChild(fontTitle);

    var fontGrid = document.createElement('div');
    fontGrid.className = 'settings-grid';

    var fontCard = document.createElement('div');
    fontCard.className = 'setting-card';

    var fontLabel = document.createElement('div');
    fontLabel.className = 'setting-card-label';
    fontLabel.textContent = 'Primary Font';
    fontCard.appendChild(fontLabel);

    var fontSelect = document.createElement('select');
    fontSelect.className = 'settings-select';

    var currentFont = getPending('--font-family');
    FONT_OPTIONS.forEach(function (opt) {
      var option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      option.style.fontFamily = opt.value;
      if (opt.value === currentFont) option.selected = true;
      fontSelect.appendChild(option);
    });

    fontSelect.addEventListener('change', function () {
      setPending('--font-family', fontSelect.value);
      var fontOpt = FONT_OPTIONS.find(function (f) { return f.value === fontSelect.value; });
      if (fontOpt) loadGoogleFont(fontOpt);
      document.documentElement.style.setProperty('--font-family', fontSelect.value);
    });

    fontCard.appendChild(fontSelect);
    fontGrid.appendChild(fontCard);
    fontSection.appendChild(fontGrid);
    page.appendChild(fontSection);

    // ===== (c) Font Sizes Section =====
    var sizeSection = document.createElement('div');
    sizeSection.className = 'settings-section';

    var sizeTitle = document.createElement('h2');
    sizeTitle.className = 'settings-section-title';
    sizeTitle.textContent = 'Font Sizes';
    sizeSection.appendChild(sizeTitle);

    var sizeGrid = document.createElement('div');
    sizeGrid.className = 'settings-grid';

    var sizeConfigs = [
      { key: '--font-size-heading', label: 'Heading', min: 20, max: 48, step: 1 },
      { key: '--font-size-subtitle', label: 'Subtitle', min: 14, max: 32, step: 1 },
      { key: '--font-size-body', label: 'Body Text', min: 11, max: 20, step: 1 },
      { key: '--font-size-small', label: 'Small Text', min: 9, max: 16, step: 1 }
    ];

    sizeConfigs.forEach(function (cfg) {
      var card = document.createElement('div');
      card.className = 'setting-card';

      var label = document.createElement('div');
      label.className = 'setting-card-label';
      label.textContent = cfg.label;
      card.appendChild(label);

      var row = document.createElement('div');
      row.className = 'settings-slider-row';

      var slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'settings-slider';
      slider.min = cfg.min;
      slider.max = cfg.max;
      slider.step = cfg.step;
      slider.value = getPending(cfg.key);

      var valueLabel = document.createElement('span');
      valueLabel.className = 'settings-slider-value';
      valueLabel.textContent = slider.value + 'px';

      slider.addEventListener('input', function () {
        valueLabel.textContent = slider.value + 'px';
        setPending(cfg.key, slider.value);
        document.documentElement.style.setProperty(cfg.key, slider.value + 'px');
      });

      row.appendChild(slider);
      row.appendChild(valueLabel);
      card.appendChild(row);
      sizeGrid.appendChild(card);
    });

    sizeSection.appendChild(sizeGrid);
    page.appendChild(sizeSection);

    // ===== (d) Colors Section — accent colors + all CSS color swatches =====
    var colorSection = document.createElement('div');
    colorSection.className = 'settings-section';

    var colorTitle = document.createElement('h2');
    colorTitle.className = 'settings-section-title';
    colorTitle.textContent = 'Colors';
    colorSection.appendChild(colorTitle);

    // Accent color pickers from settings
    var accentGrid = document.createElement('div');
    accentGrid.className = 'settings-grid';

    var accentConfigs = [
      { key: '--color-accent-light', label: 'Accent (Primary)', cssVar: '--color-accent-light' },
      { key: '--color-accent-dark', label: 'Accent (Dark)', cssVar: '--color-accent-dark' }
    ];

    accentConfigs.forEach(function (cfg) {
      var card = document.createElement('div');
      card.className = 'setting-card';

      var label = document.createElement('div');
      label.className = 'setting-card-label';
      label.textContent = cfg.label;
      card.appendChild(label);

      var row = document.createElement('div');
      row.className = 'settings-color-row';

      var swatch = document.createElement('div');
      swatch.className = 'settings-color-swatch';
      var currentColor = getPending(cfg.key);
      swatch.style.background = currentColor;

      var picker = document.createElement('input');
      picker.type = 'color';
      picker.value = currentColor;
      swatch.appendChild(picker);

      var valueSpan = document.createElement('span');
      valueSpan.className = 'settings-color-value';
      valueSpan.textContent = currentColor;

      picker.addEventListener('input', function () {
        swatch.style.background = picker.value;
        valueSpan.textContent = picker.value;
        setPending(cfg.key, picker.value);
        if (cfg.cssVar) {
          document.documentElement.style.setProperty(cfg.cssVar, picker.value);
        }
      });

      row.appendChild(swatch);
      row.appendChild(valueSpan);
      card.appendChild(row);
      accentGrid.appendChild(card);
    });

    colorSection.appendChild(accentGrid);

    // All CSS color variable swatches from the old styles page
    var colorVars = varNames.filter(function (name) {
      return name.indexOf('--color') === 0;
    });

    if (colorVars.length > 0) {
      var allColorsLabel = document.createElement('h3');
      allColorsLabel.className = 'dev-section-title';
      allColorsLabel.style.marginTop = '20px';
      allColorsLabel.textContent = 'All Color Variables';
      colorSection.appendChild(allColorsLabel);

      var colorGrid = document.createElement('div');
      colorGrid.className = 'dev-color-grid';

      colorVars.forEach(function (varName) {
        var computed = getComputed(varName);
        var isColor = isColorValue(computed) || computed.indexOf('rgb') === 0;
        if (!isColor) return;

        var card = document.createElement('div');
        card.className = 'dev-color-card';

        var swatchDiv = document.createElement('div');
        swatchDiv.className = 'dev-color-swatch';
        swatchDiv.style.background = 'var(' + varName + ')';

        var colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.className = 'dev-color-picker';
        colorPicker.value = resolveToHex(varName);

        var hexSpan = null;

        colorPicker.addEventListener('input', function () {
          document.documentElement.style.setProperty(varName, colorPicker.value);
          swatchDiv.style.background = colorPicker.value;
          if (hexSpan) hexSpan.textContent = colorPicker.value;
        });

        swatchDiv.appendChild(colorPicker);
        card.appendChild(swatchDiv);

        var info = document.createElement('div');
        info.className = 'dev-color-info';

        var varLabel = document.createElement('div');
        varLabel.className = 'dev-color-var';
        varLabel.textContent = varName;
        info.appendChild(varLabel);

        hexSpan = document.createElement('div');
        hexSpan.className = 'dev-color-hex';
        hexSpan.textContent = resolveToHex(varName);
        info.appendChild(hexSpan);

        card.appendChild(info);
        colorGrid.appendChild(card);
      });

      colorSection.appendChild(colorGrid);
    }

    page.appendChild(colorSection);

    // ===== (e) Text Colors Section =====
    var textColorSection = document.createElement('div');
    textColorSection.className = 'settings-section';

    var textColorTitle = document.createElement('h2');
    textColorTitle.className = 'settings-section-title';
    textColorTitle.textContent = 'Text Colors';
    textColorSection.appendChild(textColorTitle);

    var textColorGrid = document.createElement('div');
    textColorGrid.className = 'settings-grid';

    var textColorConfigs = [
      { key: '--text-primary-dark', label: 'Text Primary (Dark Mode)', cssVar: null },
      { key: '--text-secondary-dark', label: 'Text Secondary (Dark Mode)', cssVar: null },
      { key: '--text-muted-dark', label: 'Text Muted (Dark Mode)', cssVar: null },
      { key: '--text-primary-light', label: 'Text Primary (Light Mode)', cssVar: null },
      { key: '--text-secondary-light', label: 'Text Secondary (Light Mode)', cssVar: null },
      { key: '--text-muted-light', label: 'Text Muted (Light Mode)', cssVar: null }
    ];

    textColorConfigs.forEach(function (cfg) {
      var card = document.createElement('div');
      card.className = 'setting-card';

      var label = document.createElement('div');
      label.className = 'setting-card-label';
      label.textContent = cfg.label;
      card.appendChild(label);

      var row = document.createElement('div');
      row.className = 'settings-color-row';

      var swatch = document.createElement('div');
      swatch.className = 'settings-color-swatch';
      var currentColor = getPending(cfg.key);
      swatch.style.background = currentColor;

      var picker = document.createElement('input');
      picker.type = 'color';
      picker.value = currentColor;
      swatch.appendChild(picker);

      var valueSpan = document.createElement('span');
      valueSpan.className = 'settings-color-value';
      valueSpan.textContent = currentColor;

      picker.addEventListener('input', function () {
        swatch.style.background = picker.value;
        valueSpan.textContent = picker.value;
        setPending(cfg.key, picker.value);

        var theme = document.documentElement.getAttribute('data-theme') || 'dark';
        if (cfg.key === '--text-primary-dark' && theme === 'dark') {
          document.documentElement.style.setProperty('--text-primary', picker.value);
        }
        if (cfg.key === '--text-secondary-dark' && theme === 'dark') {
          document.documentElement.style.setProperty('--text-secondary', picker.value);
        }
        if (cfg.key === '--text-muted-dark' && theme === 'dark') {
          document.documentElement.style.setProperty('--text-muted', picker.value);
        }
        if (cfg.key.endsWith('-light') && theme === 'light') {
          var cssKey = cfg.key.replace('-light', '');
          document.documentElement.style.setProperty(cssKey, picker.value);
        }
      });

      row.appendChild(swatch);
      row.appendChild(valueSpan);
      card.appendChild(row);
      textColorGrid.appendChild(card);
    });

    textColorSection.appendChild(textColorGrid);
    page.appendChild(textColorSection);

    // ===== (f) Live Preview Section =====
    var previewSection = document.createElement('div');
    previewSection.className = 'settings-section';

    var previewTitle = document.createElement('h2');
    previewTitle.className = 'settings-section-title';
    previewTitle.textContent = 'Live Preview';
    previewSection.appendChild(previewTitle);

    var preview = document.createElement('div');
    preview.className = 'settings-preview';

    var previewH = document.createElement('div');
    previewH.className = 'settings-preview-heading';
    previewH.textContent = 'Heading Text';
    preview.appendChild(previewH);

    var previewSub = document.createElement('div');
    previewSub.className = 'settings-preview-subtitle';
    previewSub.textContent = 'Subtitle text sample';
    preview.appendChild(previewSub);

    var previewBody = document.createElement('div');
    previewBody.className = 'settings-preview-body';
    previewBody.textContent = 'This is body text. It shows how your content will appear across the application with the current font and size settings.';
    preview.appendChild(previewBody);

    var previewSmall = document.createElement('div');
    previewSmall.className = 'settings-preview-small';
    previewSmall.textContent = 'Small text for labels, captions, and metadata.';
    preview.appendChild(previewSmall);

    previewSection.appendChild(preview);
    page.appendChild(previewSection);

    // ===== (g) All CSS Variables Table =====
    var varsSection = document.createElement('div');
    varsSection.className = 'dev-section';

    var varsTitle = document.createElement('h2');
    varsTitle.className = 'dev-section-title';
    varsTitle.textContent = 'All CSS Variables';
    varsSection.appendChild(varsTitle);

    var table = document.createElement('table');
    table.className = 'dev-var-list';

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['Variable', 'Default', 'Override'].forEach(function (text) {
      var th = document.createElement('th');
      th.textContent = text;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');

    varNames.forEach(function (varName) {
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      tdName.className = 'dev-var-name';
      tdName.textContent = varName;
      tr.appendChild(tdName);

      var tdValue = document.createElement('td');
      tdValue.className = 'dev-var-value';
      tdValue.textContent = allVars[varName];
      tr.appendChild(tdValue);

      var tdInput = document.createElement('td');
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'dev-var-input';
      input.value = getComputed(varName);
      input.placeholder = allVars[varName];

      input.addEventListener('change', function () {
        var val = input.value.trim();
        if (val) {
          document.documentElement.style.setProperty(varName, val);
        } else {
          document.documentElement.style.removeProperty(varName);
        }
      });

      tdInput.appendChild(input);
      tr.appendChild(tdInput);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    varsSection.appendChild(table);
    page.appendChild(varsSection);

    container.appendChild(page);
  };
})();
