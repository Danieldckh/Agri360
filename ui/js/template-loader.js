(function () {
  'use strict';

  var cache = {};

  /**
   * Fetch an HTML template file and cache the result.
   * @param {string} path — relative to /templates/ (e.g. 'pages/employees.html')
   * @returns {Promise<string>} the raw HTML string
   */
  function loadTemplate(path) {
    if (cache[path]) return Promise.resolve(cache[path]);
    return fetch('/templates/' + path)
      .then(function (r) {
        if (!r.ok) throw new Error('Template not found: ' + path);
        return r.text();
      })
      .then(function (html) {
        cache[path] = html;
        return html;
      });
  }

  /**
   * Load a template, insert it into a container, then call an init function.
   * @param {HTMLElement} container — target element (its contents are replaced)
   * @param {string} path — template path relative to /templates/
   * @param {function} [initFn] — called with (container) after HTML is inserted
   * @returns {Promise<void>}
   */
  function insertTemplate(container, path, initFn) {
    return loadTemplate(path).then(function (html) {
      container.innerHTML = html;
      if (initFn) initFn(container);
    });
  }

  /**
   * Clear the template cache (useful during development).
   */
  function clearTemplateCache() {
    cache = {};
  }

  window.loadTemplate = loadTemplate;
  window.insertTemplate = insertTemplate;
  window.clearTemplateCache = clearTemplateCache;
})();
