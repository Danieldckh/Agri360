(function () {
  'use strict';

  var STORAGE_KEY = 'proagri-style-overrides';

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

  function saveOverrides() {
    var overrides = {};
    var style = document.documentElement.style;
    for (var i = 0; i < style.length; i++) {
      var prop = style[i];
      if (prop.indexOf('--') === 0) {
        overrides[prop] = style.getPropertyValue(prop);
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }

  function resetOverrides() {
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
    localStorage.removeItem(STORAGE_KEY);
  }

  window.renderStylesPage = function (container) {
    var allVars = getAllCssVars();
    var varNames = Object.keys(allVars);

    var page = document.createElement('div');
    page.className = 'dev-page';

    // Header
    var header = document.createElement('div');
    header.className = 'dev-page-header';

    var title = document.createElement('h1');
    title.className = 'dev-page-title';
    title.textContent = 'Style Guide';
    header.appendChild(title);

    var actions = document.createElement('div');
    actions.className = 'dev-page-actions';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'dev-btn dev-btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function () {
      saveOverrides();
      saveBtn.textContent = 'Saved!';
      setTimeout(function () { saveBtn.textContent = 'Save'; }, 1500);
    });

    var resetBtn = document.createElement('button');
    resetBtn.className = 'dev-btn dev-btn-ghost';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', function () {
      resetOverrides();
      container.textContent = '';
      window.renderStylesPage(container);
    });

    actions.appendChild(saveBtn);
    actions.appendChild(resetBtn);
    header.appendChild(actions);
    page.appendChild(header);

    // Colors section
    var colorVars = varNames.filter(function (name) {
      return name.indexOf('--color') === 0;
    });

    if (colorVars.length > 0) {
      var colorSection = document.createElement('div');
      colorSection.className = 'dev-section';

      var colorTitle = document.createElement('h2');
      colorTitle.className = 'dev-section-title';
      colorTitle.textContent = 'Colors';
      colorSection.appendChild(colorTitle);

      var colorGrid = document.createElement('div');
      colorGrid.className = 'dev-color-grid';

      colorVars.forEach(function (varName) {
        var computed = getComputed(varName);
        var isColor = isColorValue(computed) || computed.indexOf('rgb') === 0;
        if (!isColor) return;

        var card = document.createElement('div');
        card.className = 'dev-color-card';

        var swatch = document.createElement('div');
        swatch.className = 'dev-color-swatch';
        swatch.style.background = 'var(' + varName + ')';

        var picker = document.createElement('input');
        picker.type = 'color';
        picker.className = 'dev-color-picker';
        picker.value = resolveToHex(varName);

        var hexSpan = null;

        picker.addEventListener('input', function () {
          document.documentElement.style.setProperty(varName, picker.value);
          swatch.style.background = picker.value;
          if (hexSpan) hexSpan.textContent = picker.value;
        });

        swatch.appendChild(picker);
        card.appendChild(swatch);

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
      page.appendChild(colorSection);
    }

    // Typography section
    var typoSection = document.createElement('div');
    typoSection.className = 'dev-section';

    var typoTitle = document.createElement('h2');
    typoTitle.className = 'dev-section-title';
    typoTitle.textContent = 'Typography';
    typoSection.appendChild(typoTitle);

    var typeSamples = [
      { size: '32px', weight: '700', label: 'Heading — 32px / 700', text: 'The quick brown fox' },
      { size: '20px', weight: '600', label: 'Subtitle — 20px / 600', text: 'The quick brown fox jumps over the lazy dog' },
      { size: '14px', weight: '400', label: 'Body — 14px / 400', text: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.' },
      { size: '12px', weight: '400', label: 'Small — 12px / 400', text: 'Secondary text, captions, and metadata appear at this size.' },
      { size: '11px', weight: '600', label: 'Tiny — 11px / 600 / uppercase', text: 'LABEL TEXT' }
    ];

    typeSamples.forEach(function (sample) {
      var block = document.createElement('div');
      block.className = 'dev-typography-sample';

      var label = document.createElement('div');
      label.className = 'dev-typography-label';
      label.textContent = sample.label;
      block.appendChild(label);

      var text = document.createElement('div');
      text.style.fontSize = sample.size;
      text.style.fontWeight = sample.weight;
      text.style.color = '#fff';
      if (sample.size === '11px') {
        text.style.textTransform = 'uppercase';
        text.style.letterSpacing = '1px';
      }
      text.textContent = sample.text;
      block.appendChild(text);

      typoSection.appendChild(block);
    });

    page.appendChild(typoSection);

    // CSS Variables table
    var varsSection = document.createElement('div');
    varsSection.className = 'dev-section';

    var varsTitle = document.createElement('h2');
    varsTitle.className = 'dev-section-title';
    varsTitle.textContent = 'CSS Variables';
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
