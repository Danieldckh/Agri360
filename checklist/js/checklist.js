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

  // ========== Contact Section Helper ==========
  function renderContactSection(container, title, contactObj) {
    var section = document.createElement('div');
    section.className = 'checklist-section';
    var titleEl = document.createElement('div');
    titleEl.className = 'checklist-section-title';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    var grid = document.createElement('div');
    grid.className = 'checklist-form-grid';
    grid.appendChild(createFormGroup('Name', 'text', contactObj.name, function(v) { contactObj.name = v; }));
    grid.appendChild(createFormGroup('Email Address', 'email', contactObj.email, function(v) { contactObj.email = v; }));
    grid.appendChild(createFormGroup('Cell Number', 'tel', contactObj.cell, function(v) { contactObj.cell = v; }));
    grid.appendChild(createFormGroup('Tel Number', 'tel', contactObj.tel, function(v) { contactObj.tel = v; }));
    section.appendChild(grid);
    container.appendChild(section);
  }

  // ========== Page 1: Client Information ==========
  function renderPage1(container, formData, clipboard) {
    // Company Details
    var companySection = document.createElement('div');
    companySection.className = 'checklist-section';
    var companyTitle = document.createElement('div');
    companyTitle.className = 'checklist-section-title';
    companyTitle.textContent = 'Company Details';
    companySection.appendChild(companyTitle);

    var companyGrid = document.createElement('div');
    companyGrid.className = 'checklist-form-grid';

    // Company Name with typeahead
    var companyNameGroup = createFormGroup('Company Name *', 'text', formData.companyName, function(v) { formData.companyName = v; });
    var companyNameInput = companyNameGroup.querySelector('input');

    var typeaheadWrap = document.createElement('div');
    typeaheadWrap.className = 'checklist-typeahead-wrap';
    companyNameGroup.removeChild(companyNameInput);
    typeaheadWrap.appendChild(companyNameInput);
    companyNameGroup.appendChild(typeaheadWrap);

    var debounceTimer = null;
    companyNameInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      var val = companyNameInput.value;
      formData.companyName = val;
      debounceTimer = setTimeout(function() {
        if (!val.trim()) {
          var existingDd = typeaheadWrap.querySelector('.checklist-typeahead-dropdown');
          if (existingDd) existingDd.remove();
          return;
        }
        fetch(API_URL + '/clients?search=' + encodeURIComponent(val), { headers: authHeaders(true) })
          .then(function(res) { return res.json(); })
          .then(function(clients) {
            var existingDd = typeaheadWrap.querySelector('.checklist-typeahead-dropdown');
            if (existingDd) existingDd.remove();
            if (!clients || clients.length === 0) return;

            var dropdown = document.createElement('div');
            dropdown.className = 'checklist-typeahead-dropdown';

            clients.forEach(function(client) {
              var item = document.createElement('div');
              item.className = 'checklist-typeahead-item';
              item.textContent = client.companyName || client.name || '';
              item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                formData.existingClientId = client._id || client.id;
                if (client.companyName) formData.companyName = client.companyName;
                if (client.tradingName) formData.tradingName = client.tradingName;
                if (client.companyRegNo) formData.companyRegNo = client.companyRegNo;
                if (client.vatNumber) formData.vatNumber = client.vatNumber;
                if (client.website) formData.website = client.website;
                if (client.industryExpertise) formData.industryExpertise = client.industryExpertise;
                if (client.physicalAddress) formData.physicalAddress = client.physicalAddress;
                if (client.physicalPostalCode) formData.physicalPostalCode = client.physicalPostalCode;
                if (client.postalAddress) formData.postalAddress = client.postalAddress;
                if (client.postalCode) formData.postalCode = client.postalCode;
                if (client.primaryContact) formData.primaryContact = client.primaryContact;
                if (client.materialContact) formData.materialContact = client.materialContact;
                if (client.accountsContact) formData.accountsContact = client.accountsContact;
                while (container.firstChild) container.removeChild(container.firstChild);
                renderPage1(container, formData, clipboard);
              });
              dropdown.appendChild(item);
            });

            typeaheadWrap.appendChild(dropdown);
          })
          .catch(function() {});
      }, 300);
    });

    companyNameInput.addEventListener('blur', function() {
      setTimeout(function() {
        var dd = typeaheadWrap.querySelector('.checklist-typeahead-dropdown');
        if (dd) dd.remove();
      }, 200);
    });

    companyNameInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var dd = typeaheadWrap.querySelector('.checklist-typeahead-dropdown');
        if (dd) dd.remove();
      }
    });

    companyGrid.appendChild(companyNameGroup);
    companyGrid.appendChild(createFormGroup('Trading Name', 'text', formData.tradingName, function(v) { formData.tradingName = v; }));
    companyGrid.appendChild(createFormGroup('Company Reg No', 'text', formData.companyRegNo, function(v) { formData.companyRegNo = v; }, { placeholder: '2025/000001/07' }));
    companyGrid.appendChild(createFormGroup('VAT Number', 'text', formData.vatNumber, function(v) { formData.vatNumber = v; }, { placeholder: '4123456789' }));
    companyGrid.appendChild(createFormGroup('Website', 'url', formData.website, function(v) { formData.website = v; }, { placeholder: 'https://' }));
    companyGrid.appendChild(createFormGroup('Industry / Expertise', 'text', formData.industryExpertise, function(v) { formData.industryExpertise = v; }));
    companySection.appendChild(companyGrid);
    container.appendChild(companySection);

    // Addresses
    var addrSection = document.createElement('div');
    addrSection.className = 'checklist-section';
    var addrTitle = document.createElement('div');
    addrTitle.className = 'checklist-section-title';
    addrTitle.textContent = 'Addresses';
    addrSection.appendChild(addrTitle);

    var addrGrid = document.createElement('div');
    addrGrid.className = 'checklist-form-grid';
    addrGrid.appendChild(createFormGroup('Physical Address', 'text', formData.physicalAddress, function(v) { formData.physicalAddress = v; }));
    addrGrid.appendChild(createFormGroup('Physical Postal Code', 'text', formData.physicalPostalCode, function(v) { formData.physicalPostalCode = v; }));
    addrGrid.appendChild(createFormGroup('Postal Address', 'text', formData.postalAddress, function(v) { formData.postalAddress = v; }));
    addrGrid.appendChild(createFormGroup('Postal Code', 'text', formData.postalCode, function(v) { formData.postalCode = v; }));
    addrSection.appendChild(addrGrid);
    container.appendChild(addrSection);

    // Contact sections
    renderContactSection(container, 'Primary Contact Person', formData.primaryContact);
    renderContactSection(container, 'Material Contact Person', formData.materialContact);
    renderContactSection(container, 'Accounts Contact Person', formData.accountsContact);

    // Project Summary
    var summarySection = document.createElement('div');
    summarySection.className = 'checklist-section';
    var summaryTitle = document.createElement('div');
    summaryTitle.className = 'checklist-section-title';
    summaryTitle.textContent = 'Project Summary';
    summarySection.appendChild(summaryTitle);
    summarySection.appendChild(createFormGroup('Project Summary', 'textarea', formData.projectSummary, function(v) { formData.projectSummary = v; }, { fullWidth: true }));
    container.appendChild(summarySection);

    // Campaign Dates
    var datesSection = document.createElement('div');
    datesSection.className = 'checklist-section';
    var datesTitle = document.createElement('div');
    datesTitle.className = 'checklist-section-title';
    datesTitle.textContent = 'Campaign Dates';
    datesSection.appendChild(datesTitle);

    var datesGrid = document.createElement('div');
    datesGrid.className = 'checklist-form-grid';
    datesGrid.appendChild(createFormGroup('Campaign Month Start *', 'month', formData.campaignMonthStart, function(v) { formData.campaignMonthStart = v; }));
    datesGrid.appendChild(createFormGroup('Campaign Month End *', 'month', formData.campaignMonthEnd, function(v) { formData.campaignMonthEnd = v; }));
    datesSection.appendChild(datesGrid);
    container.appendChild(datesSection);
  }

  // ========== Page Stubs ==========
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

  // ========== Validation & Helpers ==========
  function validatePage1(formData, container) {
    var missing = [];
    if (!formData.companyName.trim()) missing.push('Company Name');
    if (!formData.campaignMonthStart) missing.push('Campaign Month Start');
    if (!formData.campaignMonthEnd) missing.push('Campaign Month End');

    // Remove existing error
    var existing = container.querySelector('.checklist-error-banner');
    if (existing) existing.remove();

    if (missing.length > 0) {
      var banner = document.createElement('div');
      banner.className = 'checklist-error-banner';
      banner.textContent = 'Please fill in required fields: ' + missing.join(', ');
      container.insertBefore(banner, container.firstChild);
      container.scrollTop = 0;
      return false;
    }
    return true;
  }

  function fillTestData(page, formData) {
    if (page === 1) {
      formData.companyName = 'Agri Solutions (Pty) Ltd';
      formData.tradingName = 'AgriSol';
      formData.companyRegNo = '2025/123456/07';
      formData.vatNumber = '4987654321';
      formData.website = 'https://agrisolutions.co.za';
      formData.industryExpertise = 'Crop Protection & Seeds';
      formData.physicalAddress = '123 Farm Road, Centurion, Gauteng';
      formData.physicalPostalCode = '0157';
      formData.postalAddress = 'PO Box 456, Centurion';
      formData.postalCode = '0046';
      formData.primaryContact = { name: 'Jan van der Merwe', email: 'jan@agrisol.co.za', cell: '082 555 1234', tel: '012 345 6789' };
      formData.materialContact = { name: 'Elna Botha', email: 'elna@agrisol.co.za', cell: '083 444 5678', tel: '012 345 6780' };
      formData.accountsContact = { name: 'Pieter Joubert', email: 'pieter@agrisol.co.za', cell: '084 333 9012', tel: '012 345 6781' };
      formData.projectSummary = 'Full digital marketing campaign for 2026 season including social media management, online articles, and video production.';
      formData.campaignMonthStart = '2026-02';
      formData.campaignMonthEnd = '2026-06';
    }
  }
  function submitWizard(formData, onClose) { onClose(); }

})();
