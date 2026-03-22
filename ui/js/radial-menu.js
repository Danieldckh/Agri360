/**
 * Radial Menu Component (v2 — Stacked Button List)
 *
 * Opens a vertical stack of action buttons on click of the ⋯ trigger.
 * The clicked action sits in the center; others fan out above and below.
 * Closes on click-outside or on action selection.
 *
 * Usage:
 *   var menu = new RadialMenu(sheetContainer, {
 *     actions: [
 *       { id: 'dashboard', label: 'View Dashboard', action: function(rowData) {} },
 *       { id: 'status', label: 'Change Status', action: function(rowData) {} },
 *       { id: 'next', label: 'Next Step', action: function(rowData) {}, highlight: true },
 *     ]
 *   });
 *   menu.attachToRow(rowElement, rowData);
 */
(function() {
  'use strict';

  function RadialMenu(sheetContainer, config) {
    this.sheetContainer = sheetContainer;
    this.actions = config.actions || [];
    this.activeRow = null;
    this.menuEl = null;
    this._onDocClick = null;
    this._onKeyDown = null;
  }

  RadialMenu.prototype.attachToRow = function(rowEl, rowData) {
    var self = this;
    var trigger = rowEl.querySelector('.radial-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      if (self.activeRow === rowEl) {
        self.close();
      } else {
        self.open(rowEl, rowData);
      }
    });
  };

  RadialMenu.prototype.open = function(rowEl, rowData) {
    if (this.activeRow === rowEl) return;
    this.close();

    var self = this;
    this.activeRow = rowEl;

    // Fade other rows
    this.sheetContainer.classList.add('radial-active');
    rowEl.classList.add('radial-row-active');

    // Highlight trigger
    var trigger = rowEl.querySelector('.radial-trigger');
    if (trigger) trigger.classList.add('radial-trigger-active');

    // Build the stacked menu container
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'radial-stack-menu';
    rowEl.style.position = 'relative';

    var actions = this.actions;
    var totalItems = actions.length;

    // Create buttons — they stack vertically via CSS
    actions.forEach(function(action, index) {
      var btn = document.createElement('button');
      btn.className = 'radial-stack-btn';
      if (action.highlight) btn.classList.add('radial-stack-btn-highlight');
      btn.textContent = action.label;
      btn.type = 'button';

      // Stagger animation
      btn.style.animationDelay = (index * 40) + 'ms';

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        self.close();
        if (action.action) action.action(rowData);
      });

      self.menuEl.appendChild(btn);
    });

    rowEl.appendChild(this.menuEl);

    // Position the menu so it's vertically centered on the trigger
    requestAnimationFrame(function() {
      self.menuEl.classList.add('radial-stack-visible');
      self._clampMenuPosition(rowEl);
    });

    // Close on click outside (delayed to avoid catching this click)
    setTimeout(function() {
      self._onDocClick = function(e) {
        if (self.menuEl && self.menuEl.contains(e.target)) return;
        if (trigger && trigger.contains(e.target)) return;
        self.close();
      };
      document.addEventListener('click', self._onDocClick, true);
    }, 0);

    // Close on Escape
    this._onKeyDown = function(e) {
      if (e.key === 'Escape') self.close();
    };
    document.addEventListener('keydown', this._onKeyDown);
  };

  RadialMenu.prototype._clampMenuPosition = function(rowEl) {
    if (!this.menuEl) return;

    var sheetRect = this.sheetContainer.getBoundingClientRect();
    var menuRect = this.menuEl.getBoundingClientRect();

    // Check if menu goes above or below the sheet
    if (menuRect.top < sheetRect.top) {
      var shiftDown = sheetRect.top - menuRect.top + 4;
      this.menuEl.style.transform = 'translateY(calc(-50% + ' + shiftDown + 'px))';
    } else if (menuRect.bottom > sheetRect.bottom) {
      var shiftUp = menuRect.bottom - sheetRect.bottom + 4;
      this.menuEl.style.transform = 'translateY(calc(-50% - ' + shiftUp + 'px))';
    }
  };

  RadialMenu.prototype.close = function() {
    if (!this.activeRow) return;

    this.sheetContainer.classList.remove('radial-active');
    this.activeRow.classList.remove('radial-row-active');

    var trigger = this.activeRow.querySelector('.radial-trigger');
    if (trigger) trigger.classList.remove('radial-trigger-active');

    if (this.menuEl && this.menuEl.parentNode) {
      this.menuEl.parentNode.removeChild(this.menuEl);
    }

    if (this._onDocClick) {
      document.removeEventListener('click', this._onDocClick, true);
    }
    if (this._onKeyDown) {
      document.removeEventListener('keydown', this._onKeyDown);
    }

    this.menuEl = null;
    this.activeRow = null;
    this._onDocClick = null;
    this._onKeyDown = null;
  };

  window.RadialMenu = RadialMenu;
})();
