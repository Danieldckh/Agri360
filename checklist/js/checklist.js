(function() {
  'use strict';

  var API_URL = 'http://localhost:3001/api';

  function authHeaders(json) {
    var h = window.getAuthHeaders ? window.getAuthHeaders() : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  // ========== Admin Page ==========
  window.renderAdminPage = function(container) {
    // Clear container
    while (container.firstChild) container.removeChild(container.firstChild);
    container.style.display = 'block';
    container.style.alignItems = '';
    container.style.justifyContent = '';

    var section = document.createElement('div');
    section.className = 'checklist-admin-section';

    var header = document.createElement('div');
    header.className = 'checklist-admin-header';

    var title = document.createElement('h2');
    title.textContent = 'Admin';
    header.appendChild(title);

    var newBtn = document.createElement('button');
    newBtn.className = 'checklist-new-btn';
    newBtn.textContent = '+ New Booking';
    newBtn.addEventListener('click', function() { openChecklistWizard(); });
    header.appendChild(newBtn);

    section.appendChild(header);
    container.appendChild(section);
  };

  // ========== Modal System ==========
  function openChecklistWizard(existingFormData) {
    var currentPage = 1;
    var maxVisitedPage = 1;
    var formData = existingFormData || createDefaultFormData();
    var clipboard = { type: null, data: null };

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'checklist-overlay';

    var modal = document.createElement('div');
    modal.className = 'checklist-modal';

    // Header
    var modalHeader = document.createElement('div');
    modalHeader.className = 'checklist-modal-header';

    var modalTitle = document.createElement('span');
    modalTitle.className = 'checklist-modal-title';
    modalTitle.textContent = 'New Client Booking';
    modalHeader.appendChild(modalTitle);

    var stepDots = document.createElement('div');
    stepDots.className = 'checklist-step-dots';
    modalHeader.appendChild(stepDots);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'checklist-close-btn';
    closeBtn.textContent = '\u00D7'; // × character
    closeBtn.addEventListener('click', function() { confirmClose(); });
    modalHeader.appendChild(closeBtn);

    modal.appendChild(modalHeader);

    // Content
    var modalContent = document.createElement('div');
    modalContent.className = 'checklist-modal-content';
    modal.appendChild(modalContent);

    // Footer
    var modalFooter = document.createElement('div');
    modalFooter.className = 'checklist-modal-footer';

    var backBtn = document.createElement('button');
    backBtn.className = 'checklist-back-btn';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', function() { goBack(); });
    modalFooter.appendChild(backBtn);

    var fillBtn = document.createElement('button');
    fillBtn.className = 'checklist-fill-btn';
    fillBtn.textContent = 'Fill Test Data';
    fillBtn.addEventListener('click', function() {
      fillTestData(currentPage, formData);
      renderCurrentPage();
    });
    modalFooter.appendChild(fillBtn);

    var nextBtn = document.createElement('button');
    nextBtn.className = 'checklist-next-btn';
    nextBtn.textContent = 'Next';
    nextBtn.addEventListener('click', function() { goNext(); });
    modalFooter.appendChild(nextBtn);

    modal.appendChild(modalFooter);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Keyboard shortcuts
    function onKeyDown(e) {
      if (e.key === 'Escape') { confirmClose(); }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    }
    document.addEventListener('keydown', onKeyDown);

    // Navigation
    function goBack() {
      if (currentPage > 1) { currentPage--; renderCurrentPage(); }
    }

    function goNext() {
      if (currentPage === 1 && !validatePage1(formData, modalContent)) return;
      if (currentPage < 10) {
        currentPage++;
        if (currentPage > maxVisitedPage) maxVisitedPage = currentPage;
        renderCurrentPage();
      } else {
        submitWizard(formData, closeWizard);
      }
    }

    function renderCurrentPage() {
      updateStepDots();
      updateFooterButtons();
      while (modalContent.firstChild) modalContent.removeChild(modalContent.firstChild);

      var pages = [null, renderPage1, renderPage2, renderPage3, renderPage4, renderPage5,
                   renderPage6, renderPage7, renderPage8, renderPage9, renderPage10];
      if (pages[currentPage]) pages[currentPage](modalContent, formData, clipboard);
    }

    function updateStepDots() {
      while (stepDots.firstChild) stepDots.removeChild(stepDots.firstChild);
      for (var i = 1; i <= 10; i++) {
        var dot = document.createElement('button');
        dot.className = 'checklist-step-dot';
        if (i === currentPage) dot.classList.add('active');
        if (i <= maxVisitedPage) dot.classList.add('visited');
        dot.textContent = String(i);
        dot.disabled = i > maxVisitedPage;
        (function(pageNum) {
          dot.addEventListener('click', function() {
            if (pageNum <= maxVisitedPage) {
              currentPage = pageNum;
              renderCurrentPage();
            }
          });
        })(i);
        stepDots.appendChild(dot);
      }
    }

    function updateFooterButtons() {
      backBtn.style.visibility = currentPage === 1 ? 'hidden' : 'visible';
      nextBtn.textContent = currentPage === 10 ? 'Submit' : 'Next';
    }

    function confirmClose() {
      var hasData = formData.companyName || formData.campaignMonthStart;
      if (!hasData) { closeWizard(); return; }

      var confirmOverlay = document.createElement('div');
      confirmOverlay.className = 'checklist-confirm-overlay';

      var dialog = document.createElement('div');
      dialog.className = 'checklist-confirm-dialog';

      var msg = document.createElement('p');
      msg.textContent = 'You have unsaved data. Are you sure you want to close?';
      dialog.appendChild(msg);

      var actions = document.createElement('div');
      actions.className = 'checklist-confirm-actions';

      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'checklist-back-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', function() { confirmOverlay.remove(); });
      actions.appendChild(cancelBtn);

      var confirmBtn = document.createElement('button');
      confirmBtn.className = 'checklist-next-btn';
      confirmBtn.textContent = 'Close';
      confirmBtn.addEventListener('click', function() { confirmOverlay.remove(); closeWizard(); });
      actions.appendChild(confirmBtn);

      dialog.appendChild(actions);
      confirmOverlay.appendChild(dialog);
      document.body.appendChild(confirmOverlay);
    }

    function closeWizard() {
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
    }

    renderCurrentPage();
  }

  // ========== Default Form Data ==========
  function createDefaultFormData() {
    return {
      companyName: '', tradingName: '', companyRegNo: '', vatNumber: '',
      website: '', industryExpertise: '',
      physicalAddress: '', physicalPostalCode: '', postalAddress: '', postalCode: '',
      primaryContact: { name: '', email: '', cell: '', tel: '' },
      materialContact: { name: '', email: '', cell: '', tel: '' },
      accountsContact: { name: '', email: '', cell: '', tel: '' },
      projectSummary: '', campaignMonthStart: '', campaignMonthEnd: '',
      existingClientId: null,

      page2ActiveMonths: [], page3ActiveMonths: [], page4ActiveMonths: [],
      page5ActiveMonths: [], page6ActiveMonths: [], page7ActiveMonths: [],
      page8ActiveMonths: [], page9ActiveMonths: [],

      socialLinks: { facebook: '', instagram: '', linkedin: '', youtube: '', tiktok: '', twitter: '' },
      socialMediaManagement: {
        enabled: false,
        platforms: { facebook: false, instagram: false, linkedin: false, youtube: false, tiktok: false, twitter: false },
        monthlyPosts: 10, adSpend: 0, googleAds: false, contentCalendar: false
      },
      ownPageSocialMedia: { enabled: false, items: createOwnPageItems() },

      selectedCountries: ['South Africa'],
      customCountries: [],
      agri4all: { enabled: false, items: createAgri4AllItems() },

      onlineArticles: { enabled: false, proAgriMedia: false, proAgriCoZa: false, amount: 1, curated: 0 },
      banners: { enabled: false, agri4all: false, proAgri: false },
      magazine: { enabled: false, entries: [createMagazineEntry()] },
      video: { enabled: false, entries: [createVideoEntry()] },
      websiteDesign: { enabled: false, type: '', numberOfPages: '' },

      currency: 'R',
      monthlyFinancials: {},

      signOffDate: '', representative: ''
    };
  }

  // ========== Item Creators ==========
  function createOwnPageItems() {
    return [
      { type: 'facebookPosts', label: 'Facebook Posts', enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: true, hasCampaign: false },
      { type: 'facebookStories', label: 'Facebook Stories', enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: false, hasCampaign: false },
      { type: 'facebookVideoPosts', label: 'Facebook Video Posts', enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: true, hasCampaign: false },
      { type: 'instagramPosts', label: 'Instagram Posts', enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: true, hasCampaign: false },
      { type: 'instagramStories', label: 'Instagram Stories', enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: false, hasCampaign: false },
      { type: 'tiktokShorts', label: 'TikTok Shorts', enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: false, hasCampaign: false },
      { type: 'youtubeShorts', label: 'YouTube Shorts', enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: false, hasCampaign: false },
      { type: 'youtubeVideo', label: 'YouTube Video', enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: false, hasCampaign: false },
      { type: 'linkedinArticle', label: 'LinkedIn Article', enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: false, hasCampaign: true },
      { type: 'twitterPosts', label: 'Twitter/X Posts', enabled: false, amount: 0, curated: 0, timeframe: '', hasCurated: false, hasCampaign: false }
    ];
  }

  function createAgri4AllItems() {
    return [
      { type: 'facebookPosts', label: 'Facebook Posts', enabled: false, amount: 0, curated: 0, hasCurated: true },
      { type: 'facebookStories', label: 'Facebook Stories', enabled: false, amount: 0, curated: 0, hasCurated: false },
      { type: 'facebookVideoPosts', label: 'Facebook Video Posts', enabled: false, amount: 0, curated: 0, hasCurated: true },
      { type: 'instagramPosts', label: 'Instagram Posts', enabled: false, amount: 0, curated: 0, hasCurated: true },
      { type: 'instagramStories', label: 'Instagram Stories', enabled: false, amount: 0, curated: 0, hasCurated: false },
      { type: 'tiktokShorts', label: 'TikTok Shorts', enabled: false, amount: 0, curated: 0, hasCurated: false },
      { type: 'youtubeShorts', label: 'YouTube Shorts', enabled: false, amount: 0, curated: 0, hasCurated: false },
      { type: 'youtubeVideo', label: 'YouTube Video', enabled: false, amount: 0, curated: 0, hasCurated: false },
      { type: 'linkedinArticle', label: 'LinkedIn Article', enabled: false, amount: 0, curated: 0, hasCurated: false, hasCampaign: true },
      { type: 'newsletterFeature', label: 'Newsletter Feature', enabled: false, amount: 0, curated: 0, hasCurated: false },
      { type: 'newsletterBanner', label: 'Newsletter Banner', enabled: false, amount: 0, curated: 0, hasCurated: false },
      { type: 'unlimitedProductUploads', label: 'Unlimited Product Uploads', enabled: false, amount: 0, curated: 0, hasCurated: false, standalone: true },
      { type: 'agri4allProductUploads', label: 'Agri4All Product Uploads', enabled: false, amount: 0, curated: 0, hasCurated: false }
    ];
  }

  function createMagazineEntry() {
    return { saDigital: false, africaPrint: false, africaDigital: false, coffeeTableBook: false };
  }

  function createVideoEntry() {
    return { videoType: '', videoDuration: '', photographerIncluded: false, shootDays: 0, shootHours: 0, location: '', description: '' };
  }

  // ========== Shared Helpers ==========
  function getActiveMonthsList(formData) {
    if (!formData.campaignMonthStart || !formData.campaignMonthEnd) return [];
    var start = formData.campaignMonthStart.split('-');
    var end = formData.campaignMonthEnd.split('-');
    var startYear = parseInt(start[0], 10);
    var startMonth = parseInt(start[1], 10);
    var endYear = parseInt(end[0], 10);
    var endMonth = parseInt(end[1], 10);
    var months = [];
    var y = startYear, m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      months.push(y + '-' + (m < 10 ? '0' + m : '' + m));
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return months;
  }

  function renderActiveMonthsSelector(container, formData, pageKey) {
    var allMonths = getActiveMonthsList(formData);
    if (allMonths.length === 0) return;

    var section = document.createElement('div');
    section.className = 'checklist-section';

    var titleEl = document.createElement('div');
    titleEl.className = 'checklist-section-title';
    titleEl.textContent = 'Select Active Months';
    section.appendChild(titleEl);

    var pills = document.createElement('div');
    pills.className = 'checklist-month-pills';
    section.appendChild(pills);
    container.appendChild(section);

    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    function buildPills() {
      while (pills.firstChild) pills.removeChild(pills.firstChild);

      var selectAll = document.createElement('button');
      selectAll.className = 'checklist-month-pill checklist-month-pill-select-all';
      if (formData[pageKey].length === allMonths.length && allMonths.length > 0) selectAll.classList.add('active');
      selectAll.textContent = 'Select All';
      selectAll.addEventListener('click', function() {
        if (formData[pageKey].length === allMonths.length) {
          formData[pageKey] = [];
        } else {
          formData[pageKey] = allMonths.slice();
        }
        buildPills();
      });
      pills.appendChild(selectAll);

      allMonths.forEach(function(monthStr) {
        var parts = monthStr.split('-');
        var label = monthNames[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
        var pill = document.createElement('button');
        pill.className = 'checklist-month-pill';
        if (formData[pageKey].indexOf(monthStr) !== -1) pill.classList.add('active');
        pill.textContent = label;
        pill.addEventListener('click', function() {
          var idx = formData[pageKey].indexOf(monthStr);
          if (idx === -1) { formData[pageKey].push(monthStr); } else { formData[pageKey].splice(idx, 1); }
          buildPills();
        });
        pills.appendChild(pill);
      });
    }

    buildPills();
  }

  function renderToggleableSection(container, title, dataObj, renderBody, clipboard, sectionType) {
    var section = document.createElement('div');
    section.className = 'checklist-section';

    var header = document.createElement('div');
    header.className = 'checklist-section-header';

    var toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'checklist-section-toggle';
    toggle.checked = dataObj.enabled;
    header.appendChild(toggle);

    var titleEl = document.createElement('span');
    titleEl.className = 'checklist-section-header-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    var actions = document.createElement('div');
    actions.className = 'checklist-section-actions';

    var copyBtn = document.createElement('button');
    copyBtn.className = 'checklist-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', function() {
      clipboard.type = sectionType;
      clipboard.data = JSON.parse(JSON.stringify(dataObj));
      pasteBtn.disabled = false;
    });
    actions.appendChild(copyBtn);

    var pasteBtn = document.createElement('button');
    pasteBtn.className = 'checklist-paste-btn';
    pasteBtn.textContent = 'Paste';
    pasteBtn.disabled = !(clipboard.type === sectionType && clipboard.data);
    pasteBtn.addEventListener('click', function() {
      if (clipboard.type === sectionType && clipboard.data) {
        Object.keys(clipboard.data).forEach(function(key) {
          dataObj[key] = JSON.parse(JSON.stringify(clipboard.data[key]));
        });
        rebuildBody();
        toggle.checked = dataObj.enabled;
        updateBodyState();
      }
    });
    actions.appendChild(pasteBtn);

    header.appendChild(actions);
    section.appendChild(header);

    var body = document.createElement('div');
    body.className = 'checklist-section-body';
    if (!dataObj.enabled) body.classList.add('disabled');
    section.appendChild(body);

    function updateBodyState() {
      if (dataObj.enabled) { body.classList.remove('disabled'); } else { body.classList.add('disabled'); }
    }

    function rebuildBody() {
      while (body.firstChild) body.removeChild(body.firstChild);
      renderBody(body, dataObj);
    }

    toggle.addEventListener('change', function() {
      dataObj.enabled = toggle.checked;
      updateBodyState();
    });

    rebuildBody();
    container.appendChild(section);
  }

  function createFormGroup(labelText, inputType, value, onChange, opts) {
    opts = opts || {};
    var group = document.createElement('div');
    group.className = 'checklist-form-group';
    if (opts.fullWidth) group.classList.add('full-width');

    var label = document.createElement('label');
    label.className = 'checklist-label';
    label.textContent = labelText;
    group.appendChild(label);

    var input;
    if (inputType === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'checklist-textarea';
      input.value = value || '';
      if (opts.placeholder) input.placeholder = opts.placeholder;
      if (opts.disabled) input.disabled = true;
      input.addEventListener('input', function() { onChange(input.value); });
    } else if (inputType === 'select') {
      input = document.createElement('select');
      input.className = 'checklist-select';
      if (opts.options) {
        opts.options.forEach(function(opt) {
          var option = document.createElement('option');
          option.value = opt.value !== undefined ? opt.value : opt;
          option.textContent = opt.label !== undefined ? opt.label : opt;
          if (option.value === value) option.selected = true;
          input.appendChild(option);
        });
      }
      if (opts.disabled) input.disabled = true;
      input.addEventListener('change', function() { onChange(input.value); });
    } else {
      input = document.createElement('input');
      input.className = 'checklist-input';
      input.type = inputType || 'text';
      input.value = value || '';
      if (opts.placeholder) input.placeholder = opts.placeholder;
      if (opts.min !== undefined) input.min = opts.min;
      if (opts.max !== undefined) input.max = opts.max;
      if (opts.disabled) input.disabled = true;
      input.addEventListener('input', function() {
        onChange(inputType === 'number' ? parseFloat(input.value) || 0 : input.value);
      });
    }

    group.appendChild(input);
    return group;
  }

  // ========== Page Stubs ==========
  function renderPage1(container, formData, clipboard) {
    var p = document.createElement('p');
    p.textContent = 'Page 1: Client Information \u2014 coming soon';
    container.appendChild(p);
  }
  function renderPage2(container, formData, clipboard) {
    var p = document.createElement('p');
    p.textContent = 'Page 2: Social Media \u2014 coming soon';
    container.appendChild(p);
  }
  function renderPage3(container, formData, clipboard) {
    var p = document.createElement('p');
    p.textContent = 'Page 3: Countries & Agri4All \u2014 coming soon';
    container.appendChild(p);
  }
  function renderPage4(container, formData, clipboard) {
    var p = document.createElement('p');
    p.textContent = 'Page 4: Online Articles \u2014 coming soon';
    container.appendChild(p);
  }
  function renderPage5(container, formData, clipboard) {
    var p = document.createElement('p');
    p.textContent = 'Page 5: Banners \u2014 coming soon';
    container.appendChild(p);
  }
  function renderPage6(container, formData, clipboard) {
    var p = document.createElement('p');
    p.textContent = 'Page 6: Magazine \u2014 coming soon';
    container.appendChild(p);
  }
  function renderPage7(container, formData, clipboard) {
    var p = document.createElement('p');
    p.textContent = 'Page 7: Video \u2014 coming soon';
    container.appendChild(p);
  }
  function renderPage8(container, formData, clipboard) {
    var p = document.createElement('p');
    p.textContent = 'Page 8: Website Design \u2014 coming soon';
    container.appendChild(p);
  }
  function renderPage9(container, formData, clipboard) {
    var p = document.createElement('p');
    p.textContent = 'Page 9: Financials \u2014 coming soon';
    container.appendChild(p);
  }
  function renderPage10(container, formData, clipboard) {
    var p = document.createElement('p');
    p.textContent = 'Page 10: Sign-Off \u2014 coming soon';
    container.appendChild(p);
  }

  // ========== Stub Functions ==========
  function validatePage1(formData, container) { return true; }
  function fillTestData(page, formData) {}
  function submitWizard(formData, onClose) { onClose(); }

})();
