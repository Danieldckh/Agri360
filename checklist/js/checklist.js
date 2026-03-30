(function () {
  'use strict';

  var API_URL = window.API_URL || '/api';
  var clipboard = { type: null, data: null };

  // ---- Helpers ----

  function authHeaders(json) {
    var h = window.getAuthHeaders ? window.getAuthHeaders() : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  function generateChecklistId() {
    return 'CL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }

  function getMonthRange(start, end) {
    if (!start || !end) return [];
    var months = [];
    var d = new Date(start + '-01');
    var endDate = new Date(end + '-01');
    while (d <= endDate) {
      var y = d.getFullYear();
      var m = ('0' + (d.getMonth() + 1)).slice(-2);
      months.push(y + '-' + m);
      d.setMonth(d.getMonth() + 1);
    }
    return months;
  }

  function formatMonth(m) {
    var parts = m.split('-');
    var names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return names[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  // ---- African countries list ----
  var AFRICAN_COUNTRIES = [
    'South Africa','Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi',
    'Cameroon','Cape Verde','Central African Republic','Chad','Comoros','Congo','DR Congo',
    'Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia',
    'Ghana','Guinea','Guinea-Bissau','Ivory Coast','Kenya','Lesotho','Liberia','Libya',
    'Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia',
    'Niger','Nigeria','Rwanda','Senegal','Sierra Leone','Somalia','South Sudan','Sudan',
    'Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe'
  ];

  // ---- Video type options ----
  var VIDEO_TYPES = [
    'Corporate Video','Product Demo','Testimonial','Event Coverage','Social Media Short',
    'Explainer','Training Video','Drone Footage','Interview','Behind the Scenes',
    'Animation','Live Stream','Documentary','Music Video'
  ];

  var VIDEO_DURATIONS = ['30 seconds','60 seconds','2 minutes','5 minutes','10+ minutes'];

  // ---- Own Page Social Media item types ----
  var OWN_PAGE_TYPES = [
    { type: 'facebookPosts', label: 'Facebook Posts' },
    { type: 'facebookStories', label: 'Facebook Stories' },
    { type: 'facebookVideoPosts', label: 'Facebook Video Posts' },
    { type: 'instagramPosts', label: 'Instagram Posts' },
    { type: 'instagramStories', label: 'Instagram Stories' },
    { type: 'tiktokShorts', label: 'TikTok Shorts' },
    { type: 'youtubeShorts', label: 'YouTube Shorts' },
    { type: 'youtubeVideo', label: 'YouTube Video' },
    { type: 'linkedinArticle', label: 'LinkedIn Article' },
    { type: 'twitterPosts', label: 'Twitter/X Posts' }
  ];

  // ---- Agri4All item types ----
  var AGRI4ALL_TYPES = [
    { type: 'facebookPosts', label: 'Facebook Posts' },
    { type: 'facebookStories', label: 'Facebook Stories' },
    { type: 'facebookVideoPosts', label: 'Facebook Video Posts' },
    { type: 'instagramPosts', label: 'Instagram Posts' },
    { type: 'instagramStories', label: 'Instagram Stories' },
    { type: 'tiktokShorts', label: 'TikTok Shorts' },
    { type: 'youtubeShorts', label: 'YouTube Shorts' },
    { type: 'youtubeVideo', label: 'YouTube Video' },
    { type: 'linkedinArticle', label: 'LinkedIn Article + Campaign' },
    { type: 'newsletterFeature', label: 'Newsletter Feature' },
    { type: 'newsletterBanner', label: 'Newsletter Banner' },
    { type: 'unlimitedProductUploads', label: 'Unlimited Product Uploads' },
    { type: 'agri4allProductUploads', label: 'Agri4All Product Uploads' }
  ];

  // ============================================================
  // openChecklistForClient — the main wizard entry point
  // ============================================================

  window.openChecklistForClient = function (presetClientId) {
    var checklistId = generateChecklistId();
    var currentPage = 1;
    var maxVisited = 1;

    var formData = {
      companyName: '', tradingName: '', companyRegNo: '', vatNumber: '',
      website: '', industryExpertise: '',
      physicalAddress: '', physicalPostalCode: '', postalAddress: '', postalCode: '',
      primaryContact: { name: '', email: '', cell: '', tel: '' },
      materialContact: { name: '', email: '', cell: '', tel: '' },
      accountsContact: { name: '', email: '', cell: '', tel: '' },
      projectSummary: '', campaignMonthStart: '', campaignMonthEnd: '',
      existingClientId: presetClientId || null,

      page2ActiveMonths: [], page3ActiveMonths: [], page4ActiveMonths: [],
      page5ActiveMonths: [], page6ActiveMonths: [], page7ActiveMonths: [],
      page8ActiveMonths: [], page9ActiveMonths: [],

      socialLinks: { facebook: '', instagram: '', linkedin: '', youtube: '', tiktok: '', twitter: '' },
      socialMediaManagement: {
        enabled: false,
        platforms: { facebook: false, instagram: false, linkedin: false, youtube: false, tiktok: false, twitter: false },
        monthlyPosts: 10, adSpend: 0, googleAds: false, contentCalendar: false
      },
      ownPageSocialMedia: { enabled: false, items: [] },

      selectedCountries: ['South Africa'],
      agri4all: { enabled: false, items: [] },

      onlineArticles: { enabled: false, proAgriMedia: false, proAgriCoZa: false, amount: 1, curated: 0 },

      banners: { enabled: false, agri4all: false, proAgri: false },

      magazine: { enabled: false, entries: [{ saDigital: false, africaPrint: false, africaDigital: false, coffeeTableBook: false }] },

      video: { enabled: false, entries: [{ videoType: '', videoDuration: '', photographerIncluded: false, shootDays: 0, shootHours: 0, location: '', description: '' }] },

      websiteDesign: { enabled: false, type: '', numberOfPages: '' },

      currency: 'R', monthlyFinancials: {},

      signOffDate: '', representative: ''
    };

    // Initialize own page items
    OWN_PAGE_TYPES.forEach(function (t) {
      formData.ownPageSocialMedia.items.push({ type: t.type, enabled: false, amount: 0, curated: 0, timeframe: '' });
    });
    AGRI4ALL_TYPES.forEach(function (t) {
      formData.agri4all.items.push({ type: t.type, enabled: false, amount: 0, curated: 0 });
    });

    // If preset client, fetch and prefill
    if (presetClientId) {
      fetch(API_URL + '/clients/' + presetClientId, { headers: authHeaders(false) })
        .then(function (r) { return r.json(); })
        .then(function (c) {
          if (c && !c.error) {
            formData.companyName = c.name || '';
            formData.tradingName = c.tradingName || '';
            formData.companyRegNo = c.companyRegNo || '';
            formData.vatNumber = c.vatNumber || '';
            formData.website = c.website || '';
            formData.industryExpertise = c.industryExpertise || '';
            formData.physicalAddress = c.physicalAddress || '';
            formData.physicalPostalCode = c.physicalPostalCode || '';
            formData.postalAddress = c.postalAddress || '';
            formData.postalCode = c.postalCode || '';
            if (c.primaryContact) formData.primaryContact = c.primaryContact;
            if (c.materialContact) formData.materialContact = c.materialContact;
            if (c.accountsContact) formData.accountsContact = c.accountsContact;
            renderCurrentPage();
          }
        });
    }

    // ---- Build modal DOM ----
    var overlay = el('div', 'checklist-overlay');
    var modal = el('div', 'checklist-modal');

    // Header
    var headerBar = el('div', 'checklist-header');
    var titleEl = el('h2', 'checklist-title', 'New Client Booking');
    headerBar.appendChild(titleEl);

    var stepIndicator = el('div', 'checklist-steps');
    for (var i = 1; i <= 10; i++) {
      (function (pageNum) {
        var dot = el('span', 'checklist-step-dot', pageNum);
        dot.setAttribute('data-page', pageNum);
        dot.addEventListener('click', function () {
          if (pageNum <= maxVisited) {
            currentPage = pageNum;
            renderCurrentPage();
          }
        });
        stepIndicator.appendChild(dot);
      })(i);
    }
    headerBar.appendChild(stepIndicator);

    var closeBtn = el('button', 'checklist-close-btn', '\u00D7');
    closeBtn.addEventListener('click', function () { confirmClose(); });
    headerBar.appendChild(closeBtn);

    modal.appendChild(headerBar);

    // Content area
    var content = el('div', 'checklist-content');
    modal.appendChild(content);

    // Footer
    var footer = el('div', 'checklist-footer');
    var backBtn = el('button', 'checklist-btn checklist-btn-back', 'Back');
    var fillBtn = el('button', 'checklist-btn checklist-btn-fill', 'Fill Test Data');
    var nextBtn = el('button', 'checklist-btn checklist-btn-next', 'Next');

    backBtn.addEventListener('click', function () { goBack(); });
    nextBtn.addEventListener('click', function () { goNext(); });
    fillBtn.addEventListener('click', function () { fillTestData(); });

    footer.appendChild(backBtn);
    footer.appendChild(fillBtn);
    footer.appendChild(nextBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Keyboard shortcuts
    function onKeyDown(e) {
      if (e.key === 'Escape') { confirmClose(); return; }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    }
    document.addEventListener('keydown', onKeyDown);

    function confirmClose() {
      var hasData = formData.companyName || formData.campaignMonthStart;
      if (hasData) {
        if (!confirm('You have unsaved data. Close the wizard?')) return;
      }
      cleanup();
    }

    function cleanup() {
      document.removeEventListener('keydown', onKeyDown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    // ---- Navigation ----

    function goBack() {
      if (currentPage > 1) {
        currentPage--;
        renderCurrentPage();
      }
    }

    function goNext() {
      if (currentPage === 1) {
        var errors = validatePage1();
        if (errors.length > 0) {
          showErrors(errors);
          return;
        }
      }
      if (currentPage === 10) {
        submitForm();
        return;
      }
      currentPage++;
      if (currentPage > maxVisited) maxVisited = currentPage;
      renderCurrentPage();
    }

    function validatePage1() {
      var errs = [];
      if (!formData.companyName.trim()) errs.push('Company Name is required');
      if (!formData.campaignMonthStart) errs.push('Campaign Month Start is required');
      if (!formData.campaignMonthEnd) errs.push('Campaign Month End is required');
      return errs;
    }

    function showErrors(errs) {
      var existing = content.querySelector('.checklist-errors');
      if (existing) existing.parentNode.removeChild(existing);
      var errDiv = el('div', 'checklist-errors');
      errs.forEach(function (msg) {
        var p = el('p', '', msg);
        errDiv.appendChild(p);
      });
      content.insertBefore(errDiv, content.firstChild);
      errDiv.scrollIntoView({ behavior: 'smooth' });
    }

    function renderCurrentPage() {
      while (content.firstChild) content.removeChild(content.firstChild);

      // Update step dots
      var dots = stepIndicator.querySelectorAll('.checklist-step-dot');
      for (var j = 0; j < dots.length; j++) {
        var pg = parseInt(dots[j].getAttribute('data-page'), 10);
        dots[j].className = 'checklist-step-dot' +
          (pg === currentPage ? ' active' : '') +
          (pg <= maxVisited ? ' visited' : '');
      }

      // Back/Next visibility
      backBtn.style.display = currentPage === 1 ? 'none' : '';
      nextBtn.textContent = currentPage === 10 ? 'Submit' : 'Next';

      var pageTitle = el('h3', 'checklist-page-title', getPageTitle(currentPage));
      content.appendChild(pageTitle);

      var pageRenderers = [null, renderPage1, renderPage2, renderPage3, renderPage4, renderPage5, renderPage6, renderPage7, renderPage8, renderPage9, renderPage10];
      pageRenderers[currentPage](content);

      content.scrollTop = 0;
    }

    function getPageTitle(pg) {
      var titles = ['', 'Client Information', 'Social Media & Own Page', 'Countries & Agri4All',
        'Online Articles', 'Banners', 'Magazine', 'Video', 'Website Design', 'Financials', 'Sign-Off'];
      return 'Page ' + pg + ': ' + titles[pg];
    }

    // ---- Shared UI builders ----

    function makeField(labelText, inputType, value, onChange, opts) {
      opts = opts || {};
      var wrap = el('div', 'checklist-field');
      var lbl = el('label', 'checklist-label', labelText);
      if (opts.required) {
        var req = el('span', 'checklist-required', ' *');
        lbl.appendChild(req);
      }
      wrap.appendChild(lbl);

      var input;
      if (inputType === 'textarea') {
        input = el('textarea', 'checklist-input checklist-textarea');
        input.rows = 3;
        input.value = value || '';
      } else {
        input = el('input', 'checklist-input');
        input.type = inputType || 'text';
        input.value = value || '';
      }
      if (opts.placeholder) input.placeholder = opts.placeholder;
      input.addEventListener('input', function () { onChange(input.value); });
      wrap.appendChild(input);
      return wrap;
    }

    function makeContactCard(title, contactObj, onUpdate) {
      var card = el('div', 'checklist-contact-card');
      var heading = el('h4', 'checklist-contact-title', title);
      card.appendChild(heading);

      var grid = el('div', 'checklist-field-grid');
      grid.appendChild(makeField('Name', 'text', contactObj.name, function (v) { contactObj.name = v; onUpdate(); }));
      grid.appendChild(makeField('Email', 'email', contactObj.email, function (v) { contactObj.email = v; onUpdate(); }));
      grid.appendChild(makeField('Cell', 'tel', contactObj.cell, function (v) { contactObj.cell = v; onUpdate(); }));
      grid.appendChild(makeField('Tel', 'tel', contactObj.tel, function (v) { contactObj.tel = v; onUpdate(); }));
      card.appendChild(grid);
      return card;
    }

    function makeActiveMonths(pageKey) {
      var allMonths = getMonthRange(formData.campaignMonthStart, formData.campaignMonthEnd);
      var active = formData[pageKey];
      // Init active months to all if empty
      if (active.length === 0 && allMonths.length > 0) {
        allMonths.forEach(function (m) { active.push(m); });
      }

      var section = el('div', 'checklist-active-months');
      var heading = el('h4', 'checklist-section-subtitle', 'Active Months');
      section.appendChild(heading);

      var pills = el('div', 'checklist-month-pills');
      allMonths.forEach(function (m) {
        var pill = el('span', 'checklist-month-pill' + (active.indexOf(m) !== -1 ? ' active' : ''), formatMonth(m));
        pill.addEventListener('click', function () {
          var idx = active.indexOf(m);
          if (idx !== -1) { active.splice(idx, 1); pill.className = 'checklist-month-pill'; }
          else { active.push(m); pill.className = 'checklist-month-pill active'; }
        });
        pills.appendChild(pill);
      });
      section.appendChild(pills);
      return section;
    }

    function makeToggleSection(title, enabledObj, enabledKey, renderBody, sectionType) {
      var section = el('div', 'checklist-toggle-section');
      var header = el('div', 'checklist-toggle-header');

      var cb = el('input', '');
      cb.type = 'checkbox';
      cb.checked = enabledObj[enabledKey];
      var label = el('label', 'checklist-toggle-label', title);

      var copyBtn = el('button', 'checklist-btn-icon', '\u{1F4CB}');
      copyBtn.title = 'Copy';
      var pasteBtn = el('button', 'checklist-btn-icon' + (!clipboard.data ? ' disabled' : ''), '\u{1F4CC}');
      pasteBtn.title = 'Paste';

      copyBtn.addEventListener('click', function () {
        clipboard = { type: sectionType, data: JSON.parse(JSON.stringify(enabledObj)) };
        pasteBtn.className = 'checklist-btn-icon';
      });
      pasteBtn.addEventListener('click', function () {
        if (!clipboard.data || clipboard.type !== sectionType) return;
        var keys = Object.keys(clipboard.data);
        keys.forEach(function (k) { enabledObj[k] = clipboard.data[k]; });
        // Re-render section
        while (body.firstChild) body.removeChild(body.firstChild);
        cb.checked = enabledObj[enabledKey];
        body.className = 'checklist-toggle-body' + (enabledObj[enabledKey] ? '' : ' disabled');
        renderBody(body);
      });

      header.appendChild(cb);
      header.appendChild(label);
      header.appendChild(copyBtn);
      header.appendChild(pasteBtn);
      section.appendChild(header);

      var body = el('div', 'checklist-toggle-body' + (enabledObj[enabledKey] ? '' : ' disabled'));
      renderBody(body);
      section.appendChild(body);

      cb.addEventListener('change', function () {
        enabledObj[enabledKey] = cb.checked;
        body.className = 'checklist-toggle-body' + (cb.checked ? '' : ' disabled');
      });

      return section;
    }

    // ---- Page 1: Client Information ----

    function renderPage1(container) {
      var grid = el('div', 'checklist-field-grid');

      // Company name with typeahead
      var cnWrap = el('div', 'checklist-field checklist-field-typeahead');
      var cnLabel = el('label', 'checklist-label', 'Company Name');
      var reqSpan = el('span', 'checklist-required', ' *');
      cnLabel.appendChild(reqSpan);
      cnWrap.appendChild(cnLabel);

      var cnInput = el('input', 'checklist-input');
      cnInput.type = 'text';
      cnInput.value = formData.companyName;
      cnInput.placeholder = 'Start typing to search...';
      cnWrap.appendChild(cnInput);

      var dropdown = el('div', 'checklist-typeahead-dropdown');
      dropdown.style.display = 'none';
      cnWrap.appendChild(dropdown);

      var doSearch = debounce(function (query) {
        if (query.length < 2) { dropdown.style.display = 'none'; return; }
        fetch(API_URL + '/clients?search=' + encodeURIComponent(query), { headers: authHeaders(false) })
          .then(function (r) { return r.json(); })
          .then(function (clients) {
            while (dropdown.firstChild) dropdown.removeChild(dropdown.firstChild);
            if (!clients.length) { dropdown.style.display = 'none'; return; }
            clients.forEach(function (c) {
              var item = el('div', 'checklist-typeahead-item', c.name);
              item.addEventListener('mousedown', function (e) {
                e.preventDefault();
                formData.existingClientId = c.id;
                formData.companyName = c.name;
                formData.tradingName = c.tradingName || '';
                formData.companyRegNo = c.companyRegNo || '';
                formData.vatNumber = c.vatNumber || '';
                formData.website = c.website || '';
                formData.industryExpertise = c.industryExpertise || '';
                formData.physicalAddress = c.physicalAddress || '';
                formData.physicalPostalCode = c.physicalPostalCode || '';
                formData.postalAddress = c.postalAddress || '';
                formData.postalCode = c.postalCode || '';
                if (c.primaryContact) formData.primaryContact = c.primaryContact;
                if (c.materialContact) formData.materialContact = c.materialContact;
                if (c.accountsContact) formData.accountsContact = c.accountsContact;
                dropdown.style.display = 'none';
                renderCurrentPage();
              });
              dropdown.appendChild(item);
            });
            dropdown.style.display = '';
          });
      }, 300);

      cnInput.addEventListener('input', function () {
        formData.companyName = cnInput.value;
        formData.existingClientId = null;
        doSearch(cnInput.value);
      });
      cnInput.addEventListener('blur', function () {
        setTimeout(function () { dropdown.style.display = 'none'; }, 200);
      });

      grid.appendChild(cnWrap);
      grid.appendChild(makeField('Trading Name', 'text', formData.tradingName, function (v) { formData.tradingName = v; }));
      grid.appendChild(makeField('Company Reg No', 'text', formData.companyRegNo, function (v) { formData.companyRegNo = v; }));
      grid.appendChild(makeField('VAT Number', 'text', formData.vatNumber, function (v) { formData.vatNumber = v; }));
      grid.appendChild(makeField('Website', 'url', formData.website, function (v) { formData.website = v; }));
      grid.appendChild(makeField('Industry / Expertise', 'text', formData.industryExpertise, function (v) { formData.industryExpertise = v; }));

      container.appendChild(grid);

      // Addresses
      var addrHeading = el('h4', 'checklist-section-subtitle', 'Addresses');
      container.appendChild(addrHeading);
      var addrGrid = el('div', 'checklist-field-grid');
      addrGrid.appendChild(makeField('Physical Address', 'text', formData.physicalAddress, function (v) { formData.physicalAddress = v; }));
      addrGrid.appendChild(makeField('Physical Postal Code', 'text', formData.physicalPostalCode, function (v) { formData.physicalPostalCode = v; }));
      addrGrid.appendChild(makeField('Postal Address', 'text', formData.postalAddress, function (v) { formData.postalAddress = v; }));
      addrGrid.appendChild(makeField('Postal Code', 'text', formData.postalCode, function (v) { formData.postalCode = v; }));
      container.appendChild(addrGrid);

      // Contacts
      container.appendChild(makeContactCard('Primary Contact', formData.primaryContact, function () {}));
      container.appendChild(makeContactCard('Material Contact', formData.materialContact, function () {}));
      container.appendChild(makeContactCard('Accounts Contact', formData.accountsContact, function () {}));

      // Project Summary
      container.appendChild(makeField('Project Summary', 'textarea', formData.projectSummary, function (v) { formData.projectSummary = v; }));

      // Campaign dates
      var dateHeading = el('h4', 'checklist-section-subtitle', 'Campaign Period');
      container.appendChild(dateHeading);
      var dateGrid = el('div', 'checklist-field-grid');
      dateGrid.appendChild(makeField('Campaign Month Start', 'month', formData.campaignMonthStart, function (v) { formData.campaignMonthStart = v; }, { required: true }));
      dateGrid.appendChild(makeField('Campaign Month End', 'month', formData.campaignMonthEnd, function (v) { formData.campaignMonthEnd = v; }, { required: true }));
      container.appendChild(dateGrid);
    }

    // ---- Page 2: Social Media & Own Page ----

    function renderPage2(container) {
      container.appendChild(makeActiveMonths('page2ActiveMonths'));

      // Social links
      var linksHeading = el('h4', 'checklist-section-subtitle', 'Social Account Links');
      container.appendChild(linksHeading);
      var linksGrid = el('div', 'checklist-field-grid');
      var platforms = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'twitter'];
      platforms.forEach(function (p) {
        var label = p.charAt(0).toUpperCase() + p.slice(1);
        if (p === 'twitter') label = 'Twitter/X';
        linksGrid.appendChild(makeField(label, 'url', formData.socialLinks[p], function (v) { formData.socialLinks[p] = v; }, { placeholder: 'https://' }));
      });
      container.appendChild(linksGrid);

      // Social Media Management toggle
      container.appendChild(makeToggleSection('Social Media Management', formData.socialMediaManagement, 'enabled', function (body) {
        var sGrid = el('div', 'checklist-field-grid');
        // Platform checkboxes
        var platWrap = el('div', 'checklist-checkbox-group');
        platforms.forEach(function (p) {
          var lbl = el('label', 'checklist-checkbox-label');
          var cb = el('input', '');
          cb.type = 'checkbox';
          cb.checked = formData.socialMediaManagement.platforms[p];
          cb.addEventListener('change', function () { formData.socialMediaManagement.platforms[p] = cb.checked; });
          lbl.appendChild(cb);
          lbl.appendChild(document.createTextNode(' ' + (p === 'twitter' ? 'Twitter/X' : p.charAt(0).toUpperCase() + p.slice(1))));
          platWrap.appendChild(lbl);
        });
        body.appendChild(platWrap);

        sGrid.appendChild(makeField('Monthly Posts', 'number', formData.socialMediaManagement.monthlyPosts, function (v) { formData.socialMediaManagement.monthlyPosts = parseInt(v, 10) || 0; }));
        sGrid.appendChild(makeField('Ad Spend', 'number', formData.socialMediaManagement.adSpend, function (v) { formData.socialMediaManagement.adSpend = parseFloat(v) || 0; }));
        body.appendChild(sGrid);

        var extraWrap = el('div', 'checklist-checkbox-group');
        var gaLbl = el('label', 'checklist-checkbox-label');
        var gaCb = el('input', ''); gaCb.type = 'checkbox'; gaCb.checked = formData.socialMediaManagement.googleAds;
        gaCb.addEventListener('change', function () { formData.socialMediaManagement.googleAds = gaCb.checked; });
        gaLbl.appendChild(gaCb); gaLbl.appendChild(document.createTextNode(' Google Ads'));
        extraWrap.appendChild(gaLbl);

        var ccLbl = el('label', 'checklist-checkbox-label');
        var ccCb = el('input', ''); ccCb.type = 'checkbox'; ccCb.checked = formData.socialMediaManagement.contentCalendar;
        ccCb.addEventListener('change', function () { formData.socialMediaManagement.contentCalendar = ccCb.checked; });
        ccLbl.appendChild(ccCb); ccLbl.appendChild(document.createTextNode(' Content Calendar'));
        extraWrap.appendChild(ccLbl);
        body.appendChild(extraWrap);
      }, 'socialMediaManagement'));

      // Own Page Social Media toggle
      container.appendChild(makeToggleSection('Own Page Social Media', formData.ownPageSocialMedia, 'enabled', function (body) {
        var table = el('div', 'checklist-item-table');
        formData.ownPageSocialMedia.items.forEach(function (item, idx) {
          var typeInfo = OWN_PAGE_TYPES[idx] || { label: item.type };
          var row = el('div', 'checklist-item-row');

          var cbLbl = el('label', 'checklist-checkbox-label');
          var cb = el('input', ''); cb.type = 'checkbox'; cb.checked = item.enabled;
          cb.addEventListener('change', function () { item.enabled = cb.checked; });
          cbLbl.appendChild(cb); cbLbl.appendChild(document.createTextNode(' ' + typeInfo.label));
          row.appendChild(cbLbl);

          var amtInput = el('input', 'checklist-input checklist-input-sm');
          amtInput.type = 'number'; amtInput.value = item.amount; amtInput.placeholder = 'Amount';
          amtInput.addEventListener('input', function () { item.amount = parseInt(amtInput.value, 10) || 0; });
          row.appendChild(amtInput);

          var curInput = el('input', 'checklist-input checklist-input-sm');
          curInput.type = 'number'; curInput.value = item.curated; curInput.placeholder = 'Curated';
          curInput.addEventListener('input', function () { item.curated = parseInt(curInput.value, 10) || 0; });
          row.appendChild(curInput);

          table.appendChild(row);
        });
        body.appendChild(table);
      }, 'ownPageSocialMedia'));
    }

    // ---- Page 3: Countries & Agri4All ----

    function renderPage3(container) {
      container.appendChild(makeActiveMonths('page3ActiveMonths'));

      var countryHeading = el('h4', 'checklist-section-subtitle', 'Countries');
      container.appendChild(countryHeading);

      var countryGrid = el('div', 'checklist-country-grid');
      AFRICAN_COUNTRIES.forEach(function (c) {
        var lbl = el('label', 'checklist-checkbox-label');
        var cb = el('input', ''); cb.type = 'checkbox';
        cb.checked = formData.selectedCountries.indexOf(c) !== -1;
        cb.addEventListener('change', function () {
          var i = formData.selectedCountries.indexOf(c);
          if (cb.checked && i === -1) formData.selectedCountries.push(c);
          if (!cb.checked && i !== -1) formData.selectedCountries.splice(i, 1);
        });
        lbl.appendChild(cb); lbl.appendChild(document.createTextNode(' ' + c));
        countryGrid.appendChild(lbl);
      });
      container.appendChild(countryGrid);

      // Agri4All toggle
      container.appendChild(makeToggleSection('Agri4All', formData.agri4all, 'enabled', function (body) {
        var table = el('div', 'checklist-item-table');
        formData.agri4all.items.forEach(function (item, idx) {
          var typeInfo = AGRI4ALL_TYPES[idx] || { label: item.type };
          var row = el('div', 'checklist-item-row');

          var cbLbl = el('label', 'checklist-checkbox-label');
          var cb = el('input', ''); cb.type = 'checkbox'; cb.checked = item.enabled;
          cb.addEventListener('change', function () { item.enabled = cb.checked; });
          cbLbl.appendChild(cb); cbLbl.appendChild(document.createTextNode(' ' + typeInfo.label));
          row.appendChild(cbLbl);

          var amtInput = el('input', 'checklist-input checklist-input-sm');
          amtInput.type = 'number'; amtInput.value = item.amount; amtInput.placeholder = 'Amount';
          amtInput.addEventListener('input', function () { item.amount = parseInt(amtInput.value, 10) || 0; });
          row.appendChild(amtInput);

          var curInput = el('input', 'checklist-input checklist-input-sm');
          curInput.type = 'number'; curInput.value = item.curated; curInput.placeholder = 'Curated';
          curInput.addEventListener('input', function () { item.curated = parseInt(curInput.value, 10) || 0; });
          row.appendChild(curInput);

          table.appendChild(row);
        });
        body.appendChild(table);
      }, 'agri4all'));
    }

    // ---- Page 4: Online Articles ----

    function renderPage4(container) {
      container.appendChild(makeActiveMonths('page4ActiveMonths'));

      container.appendChild(makeToggleSection('Online Articles', formData.onlineArticles, 'enabled', function (body) {
        var cbGroup = el('div', 'checklist-checkbox-group');

        var pmLbl = el('label', 'checklist-checkbox-label');
        var pmCb = el('input', ''); pmCb.type = 'checkbox'; pmCb.checked = formData.onlineArticles.proAgriMedia;
        pmCb.addEventListener('change', function () { formData.onlineArticles.proAgriMedia = pmCb.checked; });
        pmLbl.appendChild(pmCb); pmLbl.appendChild(document.createTextNode(' ProAgriMedia.com'));
        cbGroup.appendChild(pmLbl);

        var pcLbl = el('label', 'checklist-checkbox-label');
        var pcCb = el('input', ''); pcCb.type = 'checkbox'; pcCb.checked = formData.onlineArticles.proAgriCoZa;
        pcCb.addEventListener('change', function () { formData.onlineArticles.proAgriCoZa = pcCb.checked; });
        pcLbl.appendChild(pcCb); pcLbl.appendChild(document.createTextNode(' ProAgri.co.za'));
        cbGroup.appendChild(pcLbl);

        body.appendChild(cbGroup);

        var numGrid = el('div', 'checklist-field-grid');
        numGrid.appendChild(makeField('Amount', 'number', formData.onlineArticles.amount, function (v) { formData.onlineArticles.amount = parseInt(v, 10) || 0; }));
        numGrid.appendChild(makeField('Curated', 'number', formData.onlineArticles.curated, function (v) { formData.onlineArticles.curated = parseInt(v, 10) || 0; }));
        body.appendChild(numGrid);
      }, 'onlineArticles'));
    }

    // ---- Page 5: Banners ----

    function renderPage5(container) {
      container.appendChild(makeActiveMonths('page5ActiveMonths'));

      container.appendChild(makeToggleSection('Banners', formData.banners, 'enabled', function (body) {
        var cbGroup = el('div', 'checklist-checkbox-group');

        var a4Lbl = el('label', 'checklist-checkbox-label');
        var a4Cb = el('input', ''); a4Cb.type = 'checkbox'; a4Cb.checked = formData.banners.agri4all;
        a4Cb.addEventListener('change', function () { formData.banners.agri4all = a4Cb.checked; });
        a4Lbl.appendChild(a4Cb); a4Lbl.appendChild(document.createTextNode(' Agri4All'));
        cbGroup.appendChild(a4Lbl);

        var paLbl = el('label', 'checklist-checkbox-label');
        var paCb = el('input', ''); paCb.type = 'checkbox'; paCb.checked = formData.banners.proAgri;
        paCb.addEventListener('change', function () { formData.banners.proAgri = paCb.checked; });
        paLbl.appendChild(paCb); paLbl.appendChild(document.createTextNode(' ProAgri'));
        cbGroup.appendChild(paLbl);

        body.appendChild(cbGroup);
      }, 'banners'));
    }

    // ---- Page 6: Magazine (with tabs) ----

    function renderPage6(container) {
      container.appendChild(makeActiveMonths('page6ActiveMonths'));

      container.appendChild(makeToggleSection('Magazine', formData.magazine, 'enabled', function (body) {
        var activeTab = 0;

        function renderTabs() {
          while (body.firstChild) body.removeChild(body.firstChild);

          var tabBar = el('div', 'checklist-tab-bar');
          formData.magazine.entries.forEach(function (entry, idx) {
            var tab = el('span', 'checklist-tab' + (idx === activeTab ? ' active' : ''), 'Magazine ' + (idx + 1));
            tab.addEventListener('click', function () { activeTab = idx; renderTabs(); });

            if (formData.magazine.entries.length > 1) {
              var removeX = el('span', 'checklist-tab-remove', '\u00D7');
              removeX.addEventListener('click', function (e) {
                e.stopPropagation();
                if (confirm('Remove Magazine ' + (idx + 1) + '?')) {
                  formData.magazine.entries.splice(idx, 1);
                  if (activeTab >= formData.magazine.entries.length) activeTab = formData.magazine.entries.length - 1;
                  renderTabs();
                }
              });
              tab.appendChild(removeX);
            }
            tabBar.appendChild(tab);
          });

          var addTab = el('span', 'checklist-tab checklist-tab-add', '+ Add');
          addTab.addEventListener('click', function () {
            formData.magazine.entries.push({ saDigital: false, africaPrint: false, africaDigital: false, coffeeTableBook: false });
            activeTab = formData.magazine.entries.length - 1;
            renderTabs();
          });
          tabBar.appendChild(addTab);
          body.appendChild(tabBar);

          var entry = formData.magazine.entries[activeTab];
          var cbGroup = el('div', 'checklist-checkbox-group');
          var fields = [
            { key: 'saDigital', label: 'SA Digital' },
            { key: 'africaPrint', label: 'Africa Print' },
            { key: 'africaDigital', label: 'Africa Digital' },
            { key: 'coffeeTableBook', label: 'Coffee Table Book' }
          ];
          fields.forEach(function (f) {
            var lbl = el('label', 'checklist-checkbox-label');
            var cb = el('input', ''); cb.type = 'checkbox'; cb.checked = entry[f.key];
            cb.addEventListener('change', function () { entry[f.key] = cb.checked; });
            lbl.appendChild(cb); lbl.appendChild(document.createTextNode(' ' + f.label));
            cbGroup.appendChild(lbl);
          });
          body.appendChild(cbGroup);
        }

        renderTabs();
      }, 'magazine'));
    }

    // ---- Page 7: Video (with tabs) ----

    function renderPage7(container) {
      container.appendChild(makeActiveMonths('page7ActiveMonths'));

      container.appendChild(makeToggleSection('Video', formData.video, 'enabled', function (body) {
        var activeTab = 0;

        function renderTabs() {
          while (body.firstChild) body.removeChild(body.firstChild);

          var tabBar = el('div', 'checklist-tab-bar');
          formData.video.entries.forEach(function (entry, idx) {
            var tab = el('span', 'checklist-tab' + (idx === activeTab ? ' active' : ''), 'Video ' + (idx + 1));
            tab.addEventListener('click', function () { activeTab = idx; renderTabs(); });

            if (formData.video.entries.length > 1) {
              var removeX = el('span', 'checklist-tab-remove', '\u00D7');
              removeX.addEventListener('click', function (e) {
                e.stopPropagation();
                if (confirm('Remove Video ' + (idx + 1) + '?')) {
                  formData.video.entries.splice(idx, 1);
                  if (activeTab >= formData.video.entries.length) activeTab = formData.video.entries.length - 1;
                  renderTabs();
                }
              });
              tab.appendChild(removeX);
            }
            tabBar.appendChild(tab);
          });

          var addTab = el('span', 'checklist-tab checklist-tab-add', '+ Add');
          addTab.addEventListener('click', function () {
            formData.video.entries.push({ videoType: '', videoDuration: '', photographerIncluded: false, shootDays: 0, shootHours: 0, location: '', description: '' });
            activeTab = formData.video.entries.length - 1;
            renderTabs();
          });
          tabBar.appendChild(addTab);
          body.appendChild(tabBar);

          var entry = formData.video.entries[activeTab];

          // Video Type radios
          var typeHeading = el('h5', 'checklist-radio-heading', 'Video Type');
          body.appendChild(typeHeading);
          var typeGroup = el('div', 'checklist-radio-group');
          VIDEO_TYPES.forEach(function (vt) {
            var lbl = el('label', 'checklist-radio-label');
            var rb = el('input', ''); rb.type = 'radio'; rb.name = 'videoType' + activeTab;
            rb.value = vt; rb.checked = entry.videoType === vt;
            rb.addEventListener('change', function () { entry.videoType = vt; });
            lbl.appendChild(rb); lbl.appendChild(document.createTextNode(' ' + vt));
            typeGroup.appendChild(lbl);
          });
          body.appendChild(typeGroup);

          // Duration radios
          var durHeading = el('h5', 'checklist-radio-heading', 'Video Duration');
          body.appendChild(durHeading);
          var durGroup = el('div', 'checklist-radio-group');
          VIDEO_DURATIONS.forEach(function (d) {
            var lbl = el('label', 'checklist-radio-label');
            var rb = el('input', ''); rb.type = 'radio'; rb.name = 'videoDuration' + activeTab;
            rb.value = d; rb.checked = entry.videoDuration === d;
            rb.addEventListener('change', function () { entry.videoDuration = d; });
            lbl.appendChild(rb); lbl.appendChild(document.createTextNode(' ' + d));
            durGroup.appendChild(lbl);
          });
          body.appendChild(durGroup);

          // Photographer
          var photoWrap = el('div', 'checklist-checkbox-group');
          var photoLbl = el('label', 'checklist-checkbox-label');
          var photoCb = el('input', ''); photoCb.type = 'checkbox'; photoCb.checked = entry.photographerIncluded;
          photoCb.addEventListener('change', function () { entry.photographerIncluded = photoCb.checked; });
          photoLbl.appendChild(photoCb); photoLbl.appendChild(document.createTextNode(' Photographer Included'));
          photoWrap.appendChild(photoLbl);
          body.appendChild(photoWrap);

          // Other fields
          var fieldGrid = el('div', 'checklist-field-grid');
          fieldGrid.appendChild(makeField('Shoot Days', 'number', entry.shootDays, function (v) { entry.shootDays = parseInt(v, 10) || 0; }));
          fieldGrid.appendChild(makeField('Shoot Hours', 'number', entry.shootHours, function (v) { entry.shootHours = parseInt(v, 10) || 0; }));
          fieldGrid.appendChild(makeField('Location', 'text', entry.location, function (v) { entry.location = v; }));
          body.appendChild(fieldGrid);
          body.appendChild(makeField('Description', 'textarea', entry.description, function (v) { entry.description = v; }));
        }

        renderTabs();
      }, 'video'));
    }

    // ---- Page 8: Website Design ----

    function renderPage8(container) {
      container.appendChild(makeActiveMonths('page8ActiveMonths'));

      container.appendChild(makeToggleSection('Website Design', formData.websiteDesign, 'enabled', function (body) {
        // Type radios
        var typeHeading = el('h5', 'checklist-radio-heading', 'Type');
        body.appendChild(typeHeading);
        var typeGroup = el('div', 'checklist-radio-group');
        var types = [
          { value: 'design', label: 'Design & Dev' },
          { value: 'redesign', label: 'Redesign' },
          { value: 'management', label: 'Monthly Management' }
        ];
        types.forEach(function (t) {
          var lbl = el('label', 'checklist-radio-label');
          var rb = el('input', ''); rb.type = 'radio'; rb.name = 'websiteType';
          rb.value = t.value; rb.checked = formData.websiteDesign.type === t.value;
          rb.addEventListener('change', function () { formData.websiteDesign.type = t.value; });
          lbl.appendChild(rb); lbl.appendChild(document.createTextNode(' ' + t.label));
          typeGroup.appendChild(lbl);
        });
        body.appendChild(typeGroup);

        // Pages radios
        var pagesHeading = el('h5', 'checklist-radio-heading', 'Number of Pages');
        body.appendChild(pagesHeading);
        var pagesGroup = el('div', 'checklist-radio-group');
        var pageOptions = ['1-5', '5-10', '10+'];
        pageOptions.forEach(function (p) {
          var lbl = el('label', 'checklist-radio-label');
          var rb = el('input', ''); rb.type = 'radio'; rb.name = 'websitePages';
          rb.value = p; rb.checked = formData.websiteDesign.numberOfPages === p;
          rb.addEventListener('change', function () { formData.websiteDesign.numberOfPages = p; });
          lbl.appendChild(rb); lbl.appendChild(document.createTextNode(' ' + p));
          pagesGroup.appendChild(lbl);
        });
        body.appendChild(pagesGroup);
      }, 'websiteDesign'));
    }

    // ---- Page 9: Financials ----

    function renderPage9(container) {
      container.appendChild(makeActiveMonths('page9ActiveMonths'));

      var activeMonths = formData.page9ActiveMonths;

      // Initialize monthly financials
      activeMonths.forEach(function (m) {
        if (!formData.monthlyFinancials[m]) {
          formData.monthlyFinancials[m] = { enabled: true, basePrice: 0, discount: 0, subtotal: 0 };
        }
      });

      var cardsWrap = el('div', 'checklist-financial-cards');

      activeMonths.forEach(function (m) {
        var fin = formData.monthlyFinancials[m];
        var card = el('div', 'checklist-financial-card');

        var cardHeader = el('div', 'checklist-financial-card-header');
        var cb = el('input', ''); cb.type = 'checkbox'; cb.checked = fin.enabled;
        var monthLabel = el('span', '', formatMonth(m));
        cardHeader.appendChild(cb);
        cardHeader.appendChild(monthLabel);
        card.appendChild(cardHeader);

        var fields = el('div', 'checklist-financial-fields');

        var baseField = makeField('Base Price', 'number', fin.basePrice, function (v) {
          fin.basePrice = parseFloat(v) || 0;
          fin.subtotal = fin.basePrice - fin.discount;
          subtotalEl.textContent = 'Subtotal: ' + formData.currency + fin.subtotal.toFixed(2);
          updateTotals();
        });
        fields.appendChild(baseField);

        var discField = makeField('Discount', 'number', fin.discount, function (v) {
          fin.discount = parseFloat(v) || 0;
          fin.subtotal = fin.basePrice - fin.discount;
          subtotalEl.textContent = 'Subtotal: ' + formData.currency + fin.subtotal.toFixed(2);
          updateTotals();
        });
        fields.appendChild(discField);

        var subtotalEl = el('div', 'checklist-financial-subtotal', 'Subtotal: ' + formData.currency + fin.subtotal.toFixed(2));
        fields.appendChild(subtotalEl);

        cb.addEventListener('change', function () {
          fin.enabled = cb.checked;
          fields.className = 'checklist-financial-fields' + (fin.enabled ? '' : ' disabled');
          updateTotals();
        });
        fields.className = 'checklist-financial-fields' + (fin.enabled ? '' : ' disabled');

        card.appendChild(fields);
        cardsWrap.appendChild(card);
      });

      container.appendChild(cardsWrap);

      // Totals
      var totalsSection = el('div', 'checklist-financial-totals');

      var currField = makeField('Currency', 'text', formData.currency, function (v) {
        formData.currency = v || 'R';
        updateTotals();
      });
      totalsSection.appendChild(currField);

      var subtotalLine = el('div', 'checklist-total-line');
      var taxLine = el('div', 'checklist-total-line');
      var grandLine = el('div', 'checklist-total-line checklist-grand-total');
      totalsSection.appendChild(subtotalLine);
      totalsSection.appendChild(taxLine);
      totalsSection.appendChild(grandLine);
      container.appendChild(totalsSection);

      function updateTotals() {
        var sub = 0;
        activeMonths.forEach(function (m) {
          var f = formData.monthlyFinancials[m];
          if (f && f.enabled) sub += f.subtotal;
        });
        var tax = sub * 0.15;
        var grand = sub + tax;
        subtotalLine.textContent = 'Subtotal: ' + formData.currency + sub.toFixed(2);
        taxLine.textContent = 'Tax (15%): ' + formData.currency + tax.toFixed(2);
        grandLine.textContent = 'Grand Total: ' + formData.currency + grand.toFixed(2);
      }

      updateTotals();
    }

    // ---- Page 10: Sign-Off ----

    function renderPage10(container) {
      var grid = el('div', 'checklist-field-grid');
      grid.appendChild(makeField('Sign-Off Date', 'date', formData.signOffDate, function (v) { formData.signOffDate = v; }));
      grid.appendChild(makeField('Representative', 'text', formData.representative, function (v) { formData.representative = v; }));
      container.appendChild(grid);

      var note = el('p', 'checklist-signoff-note', 'Click Submit to save this booking form.');
      container.appendChild(note);
    }

    // ---- Submit ----

    function submitForm() {
      nextBtn.disabled = true;
      nextBtn.textContent = 'Submitting...';

      var payload = {
        campaignMonthStart: formData.campaignMonthStart,
        campaignMonthEnd: formData.campaignMonthEnd,
        formData: formData,
        signOffDate: formData.signOffDate || null,
        representative: formData.representative,
        checklistId: checklistId,
        status: 'outline_proposal'
      };

      function createBookingForm(clientId) {
        payload.clientId = clientId;
        return fetch(API_URL + '/booking-forms', {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify(payload)
        }).then(function (r) { return r.json(); });
      }

      function onSuccess(bookingFormResult) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Submit';
        // Show success
        while (content.firstChild) content.removeChild(content.firstChild);
        var msg = el('div', 'checklist-success');
        msg.appendChild(el('h3', '', 'Booking Form Saved'));
        msg.appendChild(el('p', '', 'The booking form has been created successfully.'));

        // Send to editable booking form service
        var bfId = bookingFormResult && bookingFormResult.id;
        if (bfId) {
          var sendingMsg = el('p', 'checklist-sending-msg', 'Generating editable booking form...');
          msg.appendChild(sendingMsg);

          fetch(API_URL + '/booking-forms/' + bfId + '/send-to-editor', {
            method: 'POST',
            headers: authHeaders(true)
          })
            .then(function (r) { return r.json(); })
            .then(function (editorResult) {
              sendingMsg.textContent = '';
              if (editorResult.editableUrl) {
                var link = el('a', 'checklist-editor-link', 'Open Editable Booking Form');
                link.href = editorResult.editableUrl;
                link.target = '_blank';
                link.rel = 'noopener';
                link.style.display = 'inline-block';
                link.style.marginTop = '12px';
                link.style.padding = '10px 24px';
                link.style.background = 'var(--accent-gradient, linear-gradient(to top, #f5a623, #d4791a))';
                link.style.color = '#fff';
                link.style.borderRadius = '6px';
                link.style.textDecoration = 'none';
                link.style.fontWeight = '600';
                msg.insertBefore(link, closeSuccessBtn);
                // Auto-open in new tab
                window.open(editorResult.editableUrl, '_blank');
              } else {
                sendingMsg.textContent = 'Could not generate editable form: ' + (editorResult.error || 'Unknown error');
              }
            })
            .catch(function (err) {
              sendingMsg.textContent = 'Editor generation failed: ' + err.message;
            });
        }

        var closeSuccessBtn = el('button', 'checklist-btn checklist-btn-next', 'Close');
        closeSuccessBtn.addEventListener('click', function () { cleanup(); });
        msg.appendChild(closeSuccessBtn);
        content.appendChild(msg);
        footer.style.display = 'none';
      }

      function onError(err) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Submit';
        showErrors(['Failed to save: ' + (err.error || err.message || 'Unknown error')]);
      }

      if (formData.existingClientId) {
        // Check for existing booking form with same date range
        fetch(API_URL + '/booking-forms/by-client/' + formData.existingClientId, { headers: authHeaders(false) })
          .then(function (r) { return r.json(); })
          .then(function (forms) {
            var match = null;
            if (Array.isArray(forms)) {
              forms.forEach(function (f) {
                if (f.campaignMonthStart === formData.campaignMonthStart && f.campaignMonthEnd === formData.campaignMonthEnd) {
                  match = f;
                }
              });
            }
            if (match) {
              // Update existing
              return fetch(API_URL + '/booking-forms/' + match.id, {
                method: 'PATCH',
                headers: authHeaders(true),
                body: JSON.stringify(payload)
              }).then(function (r) { return r.json(); });
            } else {
              return createBookingForm(formData.existingClientId);
            }
          })
          .then(function (result) {
            if (result && result.error) { onError(result); return; }
            onSuccess(result);
          })
          .catch(function (err) { onError(err); });
      } else {
        // Create new client first
        var clientPayload = {
          name: formData.companyName,
          tradingName: formData.tradingName,
          companyRegNo: formData.companyRegNo,
          vatNumber: formData.vatNumber,
          website: formData.website,
          industryExpertise: formData.industryExpertise,
          physicalAddress: formData.physicalAddress,
          physicalPostalCode: formData.physicalPostalCode,
          postalAddress: formData.postalAddress,
          postalCode: formData.postalCode,
          primaryContact: formData.primaryContact,
          materialContact: formData.materialContact,
          accountsContact: formData.accountsContact
        };

        fetch(API_URL + '/clients', {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify(clientPayload)
        })
          .then(function (r) { return r.json(); })
          .then(function (client) {
            if (client.error) { onError(client); return; }
            formData.existingClientId = client.id;
            return createBookingForm(client.id);
          })
          .then(function (result) {
            if (!result) return;
            if (result.error) { onError(result); return; }
            onSuccess();
          })
          .catch(function (err) { onError(err); });
      }
    }

    // ---- Fill Test Data ----

    function fillTestData() {
      var allMonths = getMonthRange(formData.campaignMonthStart || '2026-04', formData.campaignMonthEnd || '2026-09');

      if (currentPage === 1) {
        formData.companyName = 'Boland Agri Equipment';
        formData.tradingName = 'Boland Agri';
        formData.companyRegNo = '2020/123456/07';
        formData.vatNumber = '4123456789';
        formData.website = 'https://www.bolandagri.co.za';
        formData.industryExpertise = 'Agricultural Equipment & Machinery';
        formData.physicalAddress = '15 Voortrekker Road, Paarl, Western Cape';
        formData.physicalPostalCode = '7646';
        formData.postalAddress = 'PO Box 221, Paarl';
        formData.postalCode = '7620';
        formData.primaryContact = { name: 'Johan van der Merwe', email: 'johan@bolandagri.co.za', cell: '082 555 1234', tel: '021 871 0001' };
        formData.materialContact = { name: 'Anita Botha', email: 'anita@bolandagri.co.za', cell: '083 444 5678', tel: '021 871 0002' };
        formData.accountsContact = { name: 'Pieter Nel', email: 'accounts@bolandagri.co.za', cell: '084 333 9012', tel: '021 871 0003' };
        formData.projectSummary = 'Full digital marketing campaign for new tractor range launch across Southern Africa.';
        formData.campaignMonthStart = '2026-04';
        formData.campaignMonthEnd = '2026-09';
      } else if (currentPage === 2) {
        formData.page2ActiveMonths = allMonths.slice();
        formData.socialLinks = { facebook: 'https://facebook.com/bolandagri', instagram: 'https://instagram.com/bolandagri', linkedin: 'https://linkedin.com/company/bolandagri', youtube: 'https://youtube.com/@bolandagri', tiktok: '', twitter: '' };
        formData.socialMediaManagement = { enabled: true, platforms: { facebook: true, instagram: true, linkedin: true, youtube: false, tiktok: false, twitter: false }, monthlyPosts: 20, adSpend: 5000, googleAds: true, contentCalendar: true };
        formData.ownPageSocialMedia.enabled = true;
        formData.ownPageSocialMedia.items.forEach(function (item) { item.enabled = true; item.amount = 4; item.curated = 2; });
      } else if (currentPage === 3) {
        formData.page3ActiveMonths = allMonths.slice();
        formData.selectedCountries = ['South Africa', 'Namibia', 'Botswana', 'Zimbabwe', 'Zambia', 'Mozambique'];
        formData.agri4all.enabled = true;
        formData.agri4all.items.forEach(function (item) { item.enabled = true; item.amount = 3; item.curated = 1; });
      } else if (currentPage === 4) {
        formData.page4ActiveMonths = allMonths.slice();
        formData.onlineArticles = { enabled: true, proAgriMedia: true, proAgriCoZa: true, amount: 4, curated: 2 };
      } else if (currentPage === 5) {
        formData.page5ActiveMonths = allMonths.slice();
        formData.banners = { enabled: true, agri4all: true, proAgri: true };
      } else if (currentPage === 6) {
        formData.page6ActiveMonths = allMonths.slice();
        formData.magazine = { enabled: true, entries: [{ saDigital: true, africaPrint: true, africaDigital: false, coffeeTableBook: false }] };
      } else if (currentPage === 7) {
        formData.page7ActiveMonths = allMonths.slice();
        formData.video = { enabled: true, entries: [{ videoType: 'Corporate Video', videoDuration: '2 minutes', photographerIncluded: true, shootDays: 2, shootHours: 8, location: 'Paarl, Western Cape', description: 'Showcase new tractor range in vineyard setting.' }] };
      } else if (currentPage === 8) {
        formData.page8ActiveMonths = allMonths.slice();
        formData.websiteDesign = { enabled: true, type: 'redesign', numberOfPages: '5-10' };
      } else if (currentPage === 9) {
        formData.page9ActiveMonths = allMonths.slice();
        allMonths.forEach(function (m) {
          formData.monthlyFinancials[m] = { enabled: true, basePrice: 25000, discount: 2500, subtotal: 22500 };
        });
      } else if (currentPage === 10) {
        formData.signOffDate = '2026-03-30';
        formData.representative = 'Johan van der Merwe';
      }

      renderCurrentPage();
    }

    // ---- Start ----
    renderCurrentPage();
  };

  // ============================================================
  // viewChecklistJson — View booking form JSON in modal
  // ============================================================

  window.viewChecklistJson = function (bookingFormId) {
    fetch((window.API_URL || '/api') + '/booking-forms/' + bookingFormId, {
      headers: (window.getAuthHeaders ? window.getAuthHeaders() : {})
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { alert('Error: ' + data.error); return; }

        var formDataJson = data.formData || data.form_data || data;

        var overlay = el('div', 'checklist-json-overlay');
        var modal = el('div', 'checklist-json-modal');

        var header = el('div', 'checklist-json-header');
        header.appendChild(el('h3', '', 'Booking Form Data'));

        var copyBtn = el('button', 'checklist-btn checklist-btn-next', 'Copy to Clipboard');
        copyBtn.addEventListener('click', function () {
          var text = JSON.stringify(formDataJson, null, 2);
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function () { copyBtn.textContent = 'Copied!'; });
          }
        });
        header.appendChild(copyBtn);

        var closeBtn = el('button', 'checklist-btn checklist-btn-back', 'Close');
        closeBtn.addEventListener('click', function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        });
        header.appendChild(closeBtn);

        modal.appendChild(header);

        var pre = el('pre', 'checklist-json-pre');
        pre.textContent = JSON.stringify(formDataJson, null, 2);
        modal.appendChild(pre);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
      })
      .catch(function (err) {
        alert('Failed to load booking form: ' + err.message);
      });
  };

})();
