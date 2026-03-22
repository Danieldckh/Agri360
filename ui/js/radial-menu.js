/**
 * Radial Menu Component
 *
 * Usage:
 *   var radial = new RadialMenu(sheetContainer, {
 *     actions: [
 *       { id: 'dashboard', label: 'View Dashboard', action: function(rowData) {} },
 *       { id: 'status', label: 'Change Status', action: function(rowData) {} },
 *       { id: 'next', label: 'Next Step', action: function(rowData) {}, highlight: true },
 *     ]
 *   });
 *   radial.attachToRow(rowElement, rowData);
 */
(function() {
  'use strict';

  function RadialMenu(sheetContainer, config) {
    this.sheetContainer = sheetContainer;
    this.actions = config.actions || [];
    this.activeRow = null;
    this.radialEl = null;
    this._onMouseLeave = null;
  }

  RadialMenu.prototype.attachToRow = function(rowEl, rowData) {
    var self = this;
    var trigger = rowEl.querySelector('.radial-trigger');
    if (!trigger) return;

    trigger.addEventListener('mouseenter', function() {
      self.open(rowEl, rowData);
    });
  };

  RadialMenu.prototype.open = function(rowEl, rowData) {
    if (this.activeRow === rowEl) return;
    this.close();

    var self = this;
    this.activeRow = rowEl;

    // Add active class to sheet container (fades other rows)
    this.sheetContainer.classList.add('radial-active');
    rowEl.classList.add('radial-row-active');

    // Activate trigger icon (shifts left)
    var trigger = rowEl.querySelector('.radial-trigger');
    if (trigger) trigger.classList.add('radial-trigger-active');

    // Create radial container
    this.radialEl = document.createElement('div');
    this.radialEl.className = 'radial-container';
    rowEl.style.position = 'relative';
    rowEl.appendChild(this.radialEl);

    // Calculate positions and clamp within card bounds
    var actions = this.actions;
    var totalItems = actions.length;
    var arcSpread = Math.min(totalItems * 40, 200);
    var startY = -(arcSpread / 2);
    var itemSpacing = totalItems > 1 ? arcSpread / (totalItems - 1) : 0;

    // Clamp: check if radial would go outside the sheet container
    var sheetRect = this.sheetContainer.getBoundingClientRect();
    var rowRect = rowEl.getBoundingClientRect();
    var rowCenterY = rowRect.top + rowRect.height / 2;
    var topEdge = rowCenterY + startY - 15;
    var bottomEdge = rowCenterY + startY + arcSpread + 45;

    var clampOffset = 0;
    if (topEdge < sheetRect.top) {
      clampOffset = sheetRect.top - topEdge;
    } else if (bottomEdge > sheetRect.bottom) {
      clampOffset = sheetRect.bottom - bottomEdge;
    }

    // Create SVG for bezier lines
    var svgNS = 'http://www.w3.org/2000/svg';
    var svgWidth = 200;
    var svgHeight = arcSpread + 60;
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('viewBox', '0 0 ' + svgWidth + ' ' + svgHeight);
    svg.className.baseVal = 'radial-lines';
    svg.style.right = '0';
    svg.style.top = (startY + clampOffset - 15) + 'px';
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';

    var originX = 20;
    var originY = -startY + 15 - clampOffset;

    // Origin dot
    var dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', originX);
    dot.setAttribute('cy', originY);
    dot.setAttribute('r', 3);
    dot.setAttribute('fill', 'rgba(245, 166, 35, 0.4)');
    svg.appendChild(dot);

    // Create items and bezier paths
    actions.forEach(function(action, index) {
      var itemY = startY + (index * itemSpacing) + clampOffset;
      var arcOffset = self._arcOffset(index, totalItems);

      // Bezier path
      var endX = svgWidth - 55;
      var endY = 15 + (index * itemSpacing);
      var cp1x = originX + 50;
      var cp1y = originY;
      var cp2x = endX - 40;
      var cp2y = endY;

      var path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M ' + originX + ',' + originY +
        ' C ' + cp1x + ',' + cp1y + ' ' + cp2x + ',' + cp2y + ' ' + endX + ',' + endY);
      path.setAttribute('stroke', 'rgba(255, 255, 255, 0.12)');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);

      // Radial item
      var item = document.createElement('div');
      item.className = 'radial-item' + (action.highlight ? ' radial-item-highlight' : '');
      item.textContent = action.label;
      item.style.right = '8px';
      item.style.top = (itemY - 15) + 'px';
      item.style.marginLeft = arcOffset + 'px';
      item.style.position = 'absolute';

      // Stagger animation
      setTimeout(function() {
        item.classList.add('radial-item-visible');
      }, 50 + (index * 50));

      item.addEventListener('click', function(e) {
        e.stopPropagation();
        self.close();
        if (action.action) action.action(rowData);
      });

      self.radialEl.appendChild(item);
    });

    this.radialEl.appendChild(svg);

    // Show after a frame
    requestAnimationFrame(function() {
      self.radialEl.classList.add('radial-visible');
    });

    // Close on mouse leave from the row area
    this._onMouseLeave = function(e) {
      var relatedTarget = e.relatedTarget;
      if (relatedTarget && (rowEl.contains(relatedTarget) || (self.radialEl && self.radialEl.contains(relatedTarget)))) {
        return;
      }
      self.close();
    };
    rowEl.addEventListener('mouseleave', this._onMouseLeave);
  };

  RadialMenu.prototype._arcOffset = function(index, total) {
    if (total <= 1) return 0;
    var mid = (total - 1) / 2;
    var distance = Math.abs(index - mid);
    var maxOffset = 12;
    return (1 - (distance / mid)) * maxOffset;
  };

  RadialMenu.prototype.close = function() {
    if (!this.activeRow) return;

    this.sheetContainer.classList.remove('radial-active');
    this.activeRow.classList.remove('radial-row-active');

    var trigger = this.activeRow.querySelector('.radial-trigger');
    if (trigger) trigger.classList.remove('radial-trigger-active');

    if (this.radialEl && this.radialEl.parentNode) {
      this.radialEl.parentNode.removeChild(this.radialEl);
    }

    if (this._onMouseLeave) {
      this.activeRow.removeEventListener('mouseleave', this._onMouseLeave);
    }

    this.radialEl = null;
    this.activeRow = null;
    this._onMouseLeave = null;
  };

  window.RadialMenu = RadialMenu;
})();
