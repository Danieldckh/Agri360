(function () {
  'use strict';

  /**
   * Populate elements that have a data-bind attribute with values from a data object.
   *   <span data-bind="name"></span>  →  el.textContent = data.name
   * @param {HTMLElement} container
   * @param {Object} data — keys match data-bind values
   */
  function bindData(container, data) {
    var els = container.querySelectorAll('[data-bind]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-bind');
      if (data[key] !== undefined && data[key] !== null) {
        els[i].textContent = data[key];
      }
    }
  }

  /**
   * Set element attributes from data using data-bind-attr.
   *   <img data-bind-attr="src:photoUrl,alt:name">
   * @param {HTMLElement} container
   * @param {Object} data
   */
  function bindAttr(container, data) {
    var els = container.querySelectorAll('[data-bind-attr]');
    for (var i = 0; i < els.length; i++) {
      var pairs = els[i].getAttribute('data-bind-attr').split(',');
      for (var j = 0; j < pairs.length; j++) {
        var parts = pairs[j].split(':');
        var attr = parts[0].trim();
        var key = parts[1].trim();
        if (data[key] !== undefined && data[key] !== null) {
          els[i].setAttribute(attr, data[key]);
        }
      }
    }
  }

  /**
   * Clone a <template> element for each item in a list and append to a target container.
   *   <template id="card-tmpl">...</template>
   *   <div id="card-grid"></div>
   *
   * @param {HTMLElement} targetContainer — where cloned items are appended
   * @param {string} templateId — id of the <template> element (looked up in targetContainer's owner document)
   * @param {Array} items — array of data objects
   * @param {function} [bindFn] — called with (clonedElement, item, index) for custom binding
   */
  function bindList(targetContainer, templateId, items, bindFn) {
    var tmpl = document.getElementById(templateId);
    if (!tmpl) return;

    targetContainer.innerHTML = '';

    for (var i = 0; i < items.length; i++) {
      var el = tmpl.content.firstElementChild.cloneNode(true);

      bindData(el, items[i]);
      bindAttr(el, items[i]);

      if (bindFn) bindFn(el, items[i], i);

      targetContainer.appendChild(el);
    }
  }

  window.bindData = bindData;
  window.bindAttr = bindAttr;
  window.bindList = bindList;
})();
