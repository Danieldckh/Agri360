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
    '--text-primary': '#1a1a1a',
    '--text-secondary': '#444444',
    '--text-muted': '#666666',
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

    var fontVal = settings['--font-family'] || DEFAULTS['--font-family'];
    root.style.setProperty('--font-family', fontVal);
    var fontOpt = FONT_OPTIONS.find(function (f) { return f.value === fontVal; });
    if (fontOpt) loadGoogleFont(fontOpt);

    ['--font-size-heading', '--font-size-subtitle', '--font-size-body', '--font-size-small'].forEach(function (key) {
      var val = settings[key] || DEFAULTS[key];
      root.style.setProperty(key, val + 'px');
    });

    if (settings['--color-accent-light']) root.style.setProperty('--color-accent-light', settings['--color-accent-light']);
    if (settings['--color-accent-dark']) root.style.setProperty('--color-accent-dark', settings['--color-accent-dark']);

    root.style.setProperty('--text-primary', settings['--text-primary'] || DEFAULTS['--text-primary']);
    root.style.setProperty('--text-secondary', settings['--text-secondary'] || DEFAULTS['--text-secondary']);
    root.style.setProperty('--text-muted', settings['--text-muted'] || DEFAULTS['--text-muted']);
  }

  applySettings();
  document.addEventListener('DOMContentLoaded', function () {
    applySettings();
  });

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

  // --- Build dynamic sections that can't be static HTML ---

  function buildColorPickerCard(label, key, cssVar, getPending, setPending) {
    var card = document.createElement('div');
    card.className = 'setting-card';

    var labelEl = document.createElement('div');
    labelEl.className = 'setting-card-label';
    labelEl.textContent = label;
    card.appendChild(labelEl);

    var row = document.createElement('div');
    row.className = 'settings-color-row';

    var swatch = document.createElement('div');
    swatch.className = 'settings-color-swatch';
    var currentColor = getPending(key);
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
      setPending(key, picker.value);
      if (cssVar) {
        document.documentElement.style.setProperty(cssVar, picker.value);
      }
    });

    row.appendChild(swatch);
    row.appendChild(valueSpan);
    card.appendChild(row);
    return card;
  }

  function buildSliderCard(cfg, getPending, setPending) {
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
    return card;
  }

  function initStylesPage(container) {
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

    // --- Save button ---
    var saveBtn = container.querySelector('#styles-save-btn');
    saveBtn.addEventListener('click', function () {
      var merged = loadSettings();
      Object.keys(pendingChanges).forEach(function (key) {
        merged[key] = pendingChanges[key];
      });
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(merged));
      applySettings();
      saveStyleOverrides();

      saveBtn.textContent = 'Saved!';
      saveBtn.classList.add('saved');
      setTimeout(function () {
        saveBtn.textContent = 'Save';
        saveBtn.classList.remove('saved');
      }, 1500);
    });

    // --- Reset button ---
    var resetBtn = container.querySelector('#styles-reset-btn');
    resetBtn.addEventListener('click', function () {
      localStorage.removeItem(THEME_STORAGE_KEY);
      var root = document.documentElement;
      Object.keys(DEFAULTS).forEach(function (key) {
        root.style.removeProperty(key);
      });
      resetStyleOverrides();
      pendingChanges = {};
      var parent = container.parentElement || container;
      parent.textContent = '';
      window.renderStylesPage(parent);
    });

    // --- Font select ---
    var fontSelect = container.querySelector('#font-select');
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

    // --- Font size sliders ---
    var sizeGrid = container.querySelector('#font-sizes-grid');
    var sizeConfigs = [
      { key: '--font-size-heading', label: 'Heading', min: 20, max: 48, step: 1 },
      { key: '--font-size-subtitle', label: 'Subtitle', min: 14, max: 32, step: 1 },
      { key: '--font-size-body', label: 'Body Text', min: 11, max: 20, step: 1 },
      { key: '--font-size-small', label: 'Small Text', min: 9, max: 16, step: 1 }
    ];
    sizeConfigs.forEach(function (cfg) {
      sizeGrid.appendChild(buildSliderCard(cfg, getPending, setPending));
    });

    // --- Accent color pickers ---
    var accentGrid = container.querySelector('#accent-colors-grid');
    [
      { key: '--color-accent-light', label: 'Accent (Primary)', cssVar: '--color-accent-light' },
      { key: '--color-accent-dark', label: 'Accent (Dark)', cssVar: '--color-accent-dark' }
    ].forEach(function (cfg) {
      accentGrid.appendChild(buildColorPickerCard(cfg.label, cfg.key, cfg.cssVar, getPending, setPending));
    });

    // --- All CSS color swatches ---
    var allColorsContainer = container.querySelector('#all-colors-container');
    var colorVars = varNames.filter(function (name) {
      return name.indexOf('--color') === 0;
    });

    if (colorVars.length > 0) {
      var allColorsLabel = document.createElement('h3');
      allColorsLabel.className = 'dev-section-title';
      allColorsLabel.style.marginTop = '20px';
      allColorsLabel.textContent = 'All Color Variables';
      allColorsContainer.appendChild(allColorsLabel);

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

      allColorsContainer.appendChild(colorGrid);
    }

    // --- Text color pickers ---
    var textColorsGrid = container.querySelector('#text-colors-grid');
    [
      { key: '--text-primary', label: 'Text Primary', cssVar: '--text-primary' },
      { key: '--text-secondary', label: 'Text Secondary', cssVar: '--text-secondary' },
      { key: '--text-muted', label: 'Text Muted', cssVar: '--text-muted' }
    ].forEach(function (cfg) {
      textColorsGrid.appendChild(buildColorPickerCard(cfg.label, cfg.key, cfg.cssVar, getPending, setPending));
    });

    // --- CSS variables table ---
    var tbody = container.querySelector('#css-vars-tbody');
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
  }

  window.renderStylesPage = function (container) {
    window.insertTemplate(container, '/pages/styles/styles.html', initStylesPage);
  };
})();
