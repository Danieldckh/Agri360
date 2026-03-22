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
    // 1. Active Months
    renderActiveMonthsSelector(container, formData, 'page2ActiveMonths');

    // 2. Social Account Links
    var linksSection = document.createElement('div');
    linksSection.className = 'checklist-section';
    var linksTitle = document.createElement('h3');
    linksTitle.className = 'checklist-section-title';
    linksTitle.textContent = 'Social Account Links';
    linksSection.appendChild(linksTitle);

    var linksGrid = document.createElement('div');
    linksGrid.className = 'checklist-form-grid';

    var socialFields = [
      { label: 'Facebook Link', placeholder: 'https://facebook.com/...', key: 'facebook' },
      { label: 'Instagram Link', placeholder: 'https://instagram.com/...', key: 'instagram' },
      { label: 'LinkedIn Link', placeholder: 'https://linkedin.com/...', key: 'linkedin' },
      { label: 'YouTube Link', placeholder: 'https://youtube.com/...', key: 'youtube' },
      { label: 'TikTok Link', placeholder: 'https://tiktok.com/...', key: 'tiktok' },
      { label: 'Twitter / X Link', placeholder: 'https://x.com/...', key: 'twitter' }
    ];

    socialFields.forEach(function(field) {
      linksGrid.appendChild(createFormGroup(field.label, 'text', formData.socialLinks[field.key], function(val) {
        formData.socialLinks[field.key] = val;
      }, { placeholder: field.placeholder }));
    });

    linksSection.appendChild(linksGrid);
    container.appendChild(linksSection);

    // 3. Social Media Management
    function renderSMMBody(body, smm) {
      var platformGrid = document.createElement('div');
      platformGrid.className = 'checklist-form-grid';

      var platforms = [
        { label: 'Facebook', key: 'facebook' },
        { label: 'Instagram', key: 'instagram' },
        { label: 'LinkedIn', key: 'linkedin' },
        { label: 'YouTube', key: 'youtube' },
        { label: 'TikTok', key: 'tiktok' },
        { label: 'Twitter/X', key: 'twitter' }
      ];

      platforms.forEach(function(p) {
        var row = document.createElement('div');
        row.className = 'checklist-checkbox-row';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = smm.platforms[p.key];
        cb.id = 'smm-' + p.key;
        cb.addEventListener('change', function() { smm.platforms[p.key] = cb.checked; });
        var lbl = document.createElement('label');
        lbl.htmlFor = 'smm-' + p.key;
        lbl.textContent = p.label;
        row.appendChild(cb);
        row.appendChild(lbl);
        platformGrid.appendChild(row);
      });

      body.appendChild(platformGrid);

      var fieldsGrid = document.createElement('div');
      fieldsGrid.className = 'checklist-form-grid';

      fieldsGrid.appendChild(createFormGroup('Monthly Posts', 'number', smm.monthlyPosts, function(val) {
        smm.monthlyPosts = parseInt(val, 10) || 0;
      }, { min: 0 }));

      fieldsGrid.appendChild(createFormGroup('Ad Spend', 'number', smm.adSpend, function(val) {
        smm.adSpend = parseInt(val, 10) || 0;
      }, { min: 0 }));

      body.appendChild(fieldsGrid);

      // Google Ads checkbox
      var gaRow = document.createElement('div');
      gaRow.className = 'checklist-checkbox-row';
      var gaCb = document.createElement('input');
      gaCb.type = 'checkbox';
      gaCb.checked = smm.googleAds;
      gaCb.id = 'smm-googleAds';
      gaCb.addEventListener('change', function() { smm.googleAds = gaCb.checked; });
      var gaLbl = document.createElement('label');
      gaLbl.htmlFor = 'smm-googleAds';
      gaLbl.textContent = 'Google Ads';
      gaRow.appendChild(gaCb);
      gaRow.appendChild(gaLbl);
      body.appendChild(gaRow);

      // Content Calendar checkbox
      var ccRow = document.createElement('div');
      ccRow.className = 'checklist-checkbox-row';
      var ccCb = document.createElement('input');
      ccCb.type = 'checkbox';
      ccCb.checked = smm.contentCalendar;
      ccCb.id = 'smm-contentCalendar';
      ccCb.addEventListener('change', function() { smm.contentCalendar = ccCb.checked; });
      var ccLbl = document.createElement('label');
      ccLbl.htmlFor = 'smm-contentCalendar';
      ccLbl.textContent = 'Content Calendar';
      ccRow.appendChild(ccCb);
      ccRow.appendChild(ccLbl);
      body.appendChild(ccRow);
    }

    renderToggleableSection(container, 'Social Media Management', formData.socialMediaManagement, renderSMMBody, clipboard, 'socialMediaManagement');

    // 4. Own Page Social Media
    function renderOPSMBody(body, opsm) {
      opsm.items.forEach(function(item) {
        var row = document.createElement('div');
        row.className = 'checklist-deliverable-row';

        // Checkbox
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = item.enabled;
        cb.addEventListener('change', function() { item.enabled = cb.checked; });
        row.appendChild(cb);

        // Label
        var lbl = document.createElement('span');
        lbl.className = 'checklist-deliverable-label';
        lbl.textContent = item.label;
        row.appendChild(lbl);

        // Amount
        var amtField = document.createElement('div');
        amtField.className = 'checklist-deliverable-field';
        var amtInput = document.createElement('input');
        amtInput.className = 'checklist-input';
        amtInput.type = 'number';
        amtInput.min = '0';
        amtInput.value = item.amount;
        amtInput.placeholder = 'Amt';
        amtInput.addEventListener('input', function() { item.amount = parseInt(amtInput.value, 10) || 0; });
        amtField.appendChild(amtInput);
        row.appendChild(amtField);

        // Curated (if applicable)
        if (item.hasCurated) {
          var curField = document.createElement('div');
          curField.className = 'checklist-deliverable-field';
          var curInput = document.createElement('input');
          curInput.className = 'checklist-input';
          curInput.type = 'number';
          curInput.min = '0';
          curInput.value = item.curated;
          curInput.placeholder = 'Curated';
          curInput.addEventListener('input', function() { item.curated = parseInt(curInput.value, 10) || 0; });
          curField.appendChild(curInput);
          row.appendChild(curField);
        }

        // Timeframe
        var tfField = document.createElement('div');
        tfField.className = 'checklist-deliverable-field';
        tfField.style.width = '120px';
        var tfInput = document.createElement('input');
        tfInput.className = 'checklist-input';
        tfInput.type = 'text';
        tfInput.value = item.timeframe || '';
        tfInput.placeholder = 'Timeframe';
        tfInput.addEventListener('input', function() { item.timeframe = tfInput.value; });
        tfField.appendChild(tfInput);
        row.appendChild(tfField);

        // Campaign checkbox (LinkedIn only)
        if (item.hasCampaign) {
          var campRow = document.createElement('div');
          campRow.className = 'checklist-checkbox-row';
          campRow.style.marginLeft = '8px';
          var campCb = document.createElement('input');
          campCb.type = 'checkbox';
          campCb.checked = item.campaign || false;
          campCb.addEventListener('change', function() { item.campaign = campCb.checked; });
          var campLbl = document.createElement('label');
          campLbl.textContent = 'Campaign';
          campRow.appendChild(campCb);
          campRow.appendChild(campLbl);
          row.appendChild(campRow);
        }

        body.appendChild(row);
      });
    }

    renderToggleableSection(container, 'Own Page Social Media', formData.ownPageSocialMedia, renderOPSMBody, clipboard, 'ownPageSocialMedia');
  }
  function renderPage3(container, formData, clipboard) {
    // 1. Active Months
    renderActiveMonthsSelector(container, formData, 'page3ActiveMonths');

    // 2. Select Countries
    var countriesSection = document.createElement('div');
    countriesSection.className = 'checklist-section';
    var countriesTitle = document.createElement('h3');
    countriesTitle.className = 'checklist-section-title';
    countriesTitle.textContent = 'Select Countries';
    countriesSection.appendChild(countriesTitle);

    var hardcodedCountries = [
      'Algeria', 'Angola', 'Bahrain', 'Benin', 'Botswana', 'Brazil', 'Burkina Faso',
      'Cameroon', 'Canada', 'CAR', 'Cyprus', 'Cote d\'Ivoire', 'Egypt', 'Eswatini',
      'Ethiopia', 'Europe', 'France', 'Ghana', 'Guinea', 'Jordan', 'Kenya', 'Kuwait',
      'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritius',
      'Mexico', 'Morocco', 'Mozambique', 'Namibia', 'Nigeria', 'Qatar',
      'Republic of the Congo', 'Rwanda', 'Saudi Arabia', 'Senegal', 'South Africa',
      'Spain', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'USA', 'Uganda',
      'United Arab Emirates', 'Zambia', 'Zimbabwe'
    ];

    function renderCountryGrid() {
      var existingGrid = countriesSection.querySelector('.checklist-country-grid');
      if (existingGrid) existingGrid.remove();
      var existingAddForm = countriesSection.querySelector('.checklist-add-country-form');
      if (existingAddForm) existingAddForm.remove();
      var existingAddBtn = countriesSection.querySelector('.checklist-add-country-btn');
      if (existingAddBtn) existingAddBtn.remove();

      var allCountries = hardcodedCountries.slice();
      if (formData.customCountries && formData.customCountries.length > 0) {
        formData.customCountries.forEach(function(c) {
          if (allCountries.indexOf(c) === -1) allCountries.push(c);
        });
      }

      var grid = document.createElement('div');
      grid.className = 'checklist-country-grid';

      allCountries.forEach(function(country) {
        var item = document.createElement('div');
        item.className = 'checklist-country-item';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = formData.selectedCountries.indexOf(country) !== -1;
        cb.addEventListener('change', function() {
          var idx = formData.selectedCountries.indexOf(country);
          if (cb.checked && idx === -1) {
            formData.selectedCountries.push(country);
          } else if (!cb.checked && idx !== -1) {
            formData.selectedCountries.splice(idx, 1);
          }
          renderCountryTabs();
        });

        var lbl = document.createElement('label');
        lbl.textContent = country;

        item.appendChild(cb);
        item.appendChild(lbl);
        grid.appendChild(item);
      });

      countriesSection.appendChild(grid);

      // "+ Add Country" button
      var addBtn = document.createElement('button');
      addBtn.className = 'checklist-btn checklist-add-country-btn';
      addBtn.textContent = '+ Add Country';
      addBtn.addEventListener('click', function() {
        addBtn.style.display = 'none';
        var addForm = document.createElement('div');
        addForm.className = 'checklist-add-country-form';
        addForm.style.display = 'flex';
        addForm.style.gap = '8px';
        addForm.style.marginTop = '8px';

        var addInput = document.createElement('input');
        addInput.className = 'checklist-input';
        addInput.type = 'text';
        addInput.placeholder = 'Country name';

        var addConfirmBtn = document.createElement('button');
        addConfirmBtn.className = 'checklist-btn';
        addConfirmBtn.textContent = 'Add';
        addConfirmBtn.addEventListener('click', function() {
          var val = addInput.value.trim();
          if (val) {
            if (!formData.customCountries) formData.customCountries = [];
            if (formData.customCountries.indexOf(val) === -1) {
              formData.customCountries.push(val);
            }
            renderCountryGrid();
          }
        });

        addForm.appendChild(addInput);
        addForm.appendChild(addConfirmBtn);
        countriesSection.appendChild(addForm);
      });
      countriesSection.appendChild(addBtn);
    }

    renderCountryGrid();
    container.appendChild(countriesSection);

    // 3. Agri4All
    function renderAgri4AllBody(body, agri) {
      agri.items.forEach(function(item) {
        var row = document.createElement('div');
        row.className = 'checklist-deliverable-row';

        // Checkbox
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = item.enabled;
        cb.addEventListener('change', function() { item.enabled = cb.checked; });
        row.appendChild(cb);

        // Label
        var lbl = document.createElement('span');
        lbl.className = 'checklist-deliverable-label';
        lbl.textContent = item.label;
        row.appendChild(lbl);

        // Standalone items (like unlimitedProductUploads): just checkbox + label
        if (item.standalone) {
          body.appendChild(row);
          return;
        }

        // Amount
        var amtField = document.createElement('div');
        amtField.className = 'checklist-deliverable-field';
        var amtInput = document.createElement('input');
        amtInput.className = 'checklist-input';
        amtInput.type = 'number';
        amtInput.min = '0';
        amtInput.value = item.amount;
        amtInput.placeholder = 'Amt';
        amtInput.addEventListener('input', function() { item.amount = parseInt(amtInput.value, 10) || 0; });
        amtField.appendChild(amtInput);
        row.appendChild(amtField);

        // Curated (if applicable)
        if (item.hasCurated) {
          var curField = document.createElement('div');
          curField.className = 'checklist-deliverable-field';
          var curInput = document.createElement('input');
          curInput.className = 'checklist-input';
          curInput.type = 'number';
          curInput.min = '0';
          curInput.value = item.curated;
          curInput.placeholder = 'Curated';
          curInput.addEventListener('input', function() { item.curated = parseInt(curInput.value, 10) || 0; });
          curField.appendChild(curInput);
          row.appendChild(curField);
        }

        // Company Campaign checkbox (LinkedIn Article only)
        if (item.hasCampaign) {
          var campRow = document.createElement('div');
          campRow.className = 'checklist-checkbox-row';
          campRow.style.marginLeft = '8px';
          var campCb = document.createElement('input');
          campCb.type = 'checkbox';
          campCb.checked = item.campaign || false;
          campCb.addEventListener('change', function() { item.campaign = campCb.checked; });
          var campLbl = document.createElement('label');
          campLbl.textContent = 'Company Campaign';
          campRow.appendChild(campCb);
          campRow.appendChild(campLbl);
          row.appendChild(campRow);
        }

        body.appendChild(row);
      });
    }

    renderToggleableSection(container, 'Agri4All', formData.agri4all, renderAgri4AllBody, clipboard, 'agri4all');

    // 4. Country Filter Tabs
    var tabsContainer = document.createElement('div');
    tabsContainer.className = 'checklist-tabs';
    container.appendChild(tabsContainer);

    function renderCountryTabs() {
      while (tabsContainer.firstChild) tabsContainer.removeChild(tabsContainer.firstChild);

      var allTab = document.createElement('div');
      allTab.className = 'checklist-tab checklist-tab-active';
      allTab.textContent = 'All';
      tabsContainer.appendChild(allTab);

      formData.selectedCountries.forEach(function(country) {
        var tab = document.createElement('div');
        tab.className = 'checklist-tab';
        tab.textContent = country;
        tabsContainer.appendChild(tab);
      });
    }

    renderCountryTabs();
  }
  function renderPage4(container, formData, clipboard) {
    // 1. Active Months
    renderActiveMonthsSelector(container, formData, 'page4ActiveMonths');

    // 2. Online Articles toggleable section
    function renderOABody(body, oa) {
      // Checkbox rows
      var checkboxes = [
        { label: 'ProAgriMedia.com', key: 'proAgriMedia' },
        { label: 'ProAgri.co.za', key: 'proAgriCoZa' }
      ];

      checkboxes.forEach(function(item) {
        var row = document.createElement('div');
        row.className = 'checklist-checkbox-row';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = oa[item.key];
        cb.id = 'oa-' + item.key;
        cb.addEventListener('change', function() { oa[item.key] = cb.checked; });
        var lbl = document.createElement('label');
        lbl.htmlFor = 'oa-' + item.key;
        lbl.textContent = item.label;
        row.appendChild(cb);
        row.appendChild(lbl);
        body.appendChild(row);
      });

      // 2-col grid: Amount and Curated
      var grid = document.createElement('div');
      grid.className = 'checklist-form-grid';

      grid.appendChild(createFormGroup('Amount', 'number', oa.amount, function(val) {
        oa.amount = parseInt(val, 10) || 0;
      }, { min: 0 }));

      grid.appendChild(createFormGroup('Curated', 'number', oa.curated, function(val) {
        oa.curated = parseInt(val, 10) || 0;
      }, { min: 0 }));

      body.appendChild(grid);
    }

    renderToggleableSection(container, 'Online Articles', formData.onlineArticles, renderOABody, clipboard, 'onlineArticles');
  }
  function renderPage5(container, formData, clipboard) {
    // 1. Active Months
    renderActiveMonthsSelector(container, formData, 'page5ActiveMonths');

    // 2. Banners toggleable section
    function renderBannersBody(body, banners) {
      var checkboxes = [
        { label: 'Agri4All', key: 'agri4all' },
        { label: 'ProAgri', key: 'proAgri' }
      ];

      checkboxes.forEach(function(item) {
        var row = document.createElement('div');
        row.className = 'checklist-checkbox-row';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = banners[item.key];
        cb.id = 'banners-' + item.key;
        cb.addEventListener('change', function() { banners[item.key] = cb.checked; });
        var lbl = document.createElement('label');
        lbl.htmlFor = 'banners-' + item.key;
        lbl.textContent = item.label;
        row.appendChild(cb);
        row.appendChild(lbl);
        body.appendChild(row);
      });
    }

    renderToggleableSection(container, 'Banners', formData.banners, renderBannersBody, clipboard, 'banners');
  }
  function renderPage6(container, formData, clipboard) {
    // 1. Active Months
    renderActiveMonthsSelector(container, formData, 'page6ActiveMonths');

    // 2. Magazine toggleable section
    function renderMagazineBody(body, mag) {
      var activeTab = 0;

      function buildTabs() {
        while (body.firstChild) body.removeChild(body.firstChild);

        var tabBar = document.createElement('div');
        tabBar.className = 'checklist-tabs';

        mag.entries.forEach(function(entry, idx) {
          var tab = document.createElement('button');
          tab.className = 'checklist-tab';
          if (idx === activeTab) tab.classList.add('active');

          var tabText = document.createTextNode('Magazine ' + (idx + 1));
          tab.appendChild(tabText);

          if (idx > 0) {
            var closeSpan = document.createElement('span');
            closeSpan.className = 'checklist-tab-close';
            closeSpan.textContent = '\u00D7';
            closeSpan.addEventListener('click', function(e) {
              e.stopPropagation();
              if (confirm('Remove Magazine ' + (idx + 1) + '?')) {
                mag.entries.splice(idx, 1);
                if (activeTab >= mag.entries.length) activeTab = mag.entries.length - 1;
                buildTabs();
              }
            });
            tab.appendChild(closeSpan);
          }

          tab.addEventListener('click', function() { activeTab = idx; buildTabs(); });
          tabBar.appendChild(tab);
        });

        var addBtn = document.createElement('button');
        addBtn.className = 'checklist-tab-add';
        addBtn.textContent = '+ Add Magazine';
        addBtn.addEventListener('click', function() {
          mag.entries.push(createMagazineEntry());
          activeTab = mag.entries.length - 1;
          buildTabs();
        });
        tabBar.appendChild(addBtn);
        body.appendChild(tabBar);

        // Render active tab content
        var content = document.createElement('div');
        var entry = mag.entries[activeTab];

        var checkboxes = [
          { label: 'SA Digital', key: 'saDigital' },
          { label: 'Africa Print', key: 'africaPrint' },
          { label: 'Africa Digital', key: 'africaDigital' },
          { label: 'Coffee Table Book', key: 'coffeeTableBook' }
        ];

        checkboxes.forEach(function(item) {
          var row = document.createElement('div');
          row.className = 'checklist-checkbox-row';
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = entry[item.key];
          cb.id = 'magazine-' + activeTab + '-' + item.key;
          cb.addEventListener('change', function() { entry[item.key] = cb.checked; });
          var lbl = document.createElement('label');
          lbl.htmlFor = 'magazine-' + activeTab + '-' + item.key;
          lbl.textContent = item.label;
          row.appendChild(cb);
          row.appendChild(lbl);
          content.appendChild(row);
        });

        body.appendChild(content);
      }

      buildTabs();
    }

    renderToggleableSection(container, 'Magazine', formData.magazine, renderMagazineBody, clipboard, 'magazine');
  }
  function renderPage7(container, formData, clipboard) {
    // 1. Active Months
    renderActiveMonthsSelector(container, formData, 'page7ActiveMonths');

    // 2. Video toggleable section
    function renderVideoBody(body, vid) {
      var activeTab = 0;

      function buildTabs() {
        while (body.firstChild) body.removeChild(body.firstChild);

        var tabBar = document.createElement('div');
        tabBar.className = 'checklist-tabs';

        vid.entries.forEach(function(entry, idx) {
          var tab = document.createElement('button');
          tab.className = 'checklist-tab';
          if (idx === activeTab) tab.classList.add('active');

          var tabText = document.createTextNode('Video ' + (idx + 1));
          tab.appendChild(tabText);

          if (idx > 0) {
            var closeSpan = document.createElement('span');
            closeSpan.className = 'checklist-tab-close';
            closeSpan.textContent = '\u00D7';
            closeSpan.addEventListener('click', function(e) {
              e.stopPropagation();
              if (confirm('Remove Video ' + (idx + 1) + '?')) {
                vid.entries.splice(idx, 1);
                if (activeTab >= vid.entries.length) activeTab = vid.entries.length - 1;
                buildTabs();
              }
            });
            tab.appendChild(closeSpan);
          }

          tab.addEventListener('click', function() { activeTab = idx; buildTabs(); });
          tabBar.appendChild(tab);
        });

        var addBtn = document.createElement('button');
        addBtn.className = 'checklist-tab-add';
        addBtn.textContent = '+ Add Video';
        addBtn.addEventListener('click', function() {
          vid.entries.push(createVideoEntry());
          activeTab = vid.entries.length - 1;
          buildTabs();
        });
        tabBar.appendChild(addBtn);
        body.appendChild(tabBar);

        // Render active tab content
        var content = document.createElement('div');
        var entry = vid.entries[activeTab];

        // Video Type radio group
        var typeLabel = document.createElement('label');
        typeLabel.className = 'checklist-label';
        typeLabel.textContent = 'Video Type';
        content.appendChild(typeLabel);

        var typeGroup = document.createElement('div');
        typeGroup.className = 'checklist-radio-group';
        var videoTypes = [
          'Promotional / Advertising', 'Informative / Educational', 'Testimonial / Case Study',
          'Entertainment / Creative', 'Interactive / Event Coverage', 'Hype / Invitation',
          'Highlights / Recap', 'Practical demonstrations', 'Proven results',
          'Problem solving', 'New technologies and innovation', 'Tips and best practices',
          'Humoristic short from ads', 'Photographer', 'Other'
        ];
        videoTypes.forEach(function(optionValue) {
          var radioLabel = document.createElement('label');
          radioLabel.className = 'checklist-radio-label';
          var radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'videoType-' + activeTab;
          radio.value = optionValue;
          radio.checked = entry.videoType === optionValue;
          radio.addEventListener('change', function() { entry.videoType = radio.value; });
          radioLabel.appendChild(radio);
          var span = document.createElement('span');
          span.textContent = optionValue;
          radioLabel.appendChild(span);
          typeGroup.appendChild(radioLabel);
        });
        content.appendChild(typeGroup);

        // Video Duration radio group
        var durationLabel = document.createElement('label');
        durationLabel.className = 'checklist-label';
        durationLabel.textContent = 'Video Duration';
        content.appendChild(durationLabel);

        var durationGroup = document.createElement('div');
        durationGroup.className = 'checklist-radio-group';
        var durations = ['1-2 min', '3-5 min', '5-10 min', '10-15 min', '15+ min'];
        durations.forEach(function(optionValue) {
          var radioLabel = document.createElement('label');
          radioLabel.className = 'checklist-radio-label';
          var radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'videoDuration-' + activeTab;
          radio.value = optionValue;
          radio.checked = entry.videoDuration === optionValue;
          radio.addEventListener('change', function() { entry.videoDuration = radio.value; });
          radioLabel.appendChild(radio);
          var span = document.createElement('span');
          span.textContent = optionValue;
          radioLabel.appendChild(span);
          durationGroup.appendChild(radioLabel);
        });
        content.appendChild(durationGroup);

        // Other fields in 2-col grid
        var grid = document.createElement('div');
        grid.className = 'checklist-grid-2col';

        // Photographer Included checkbox
        var cbGroup = document.createElement('div');
        cbGroup.className = 'checklist-form-group';
        var cbRow = document.createElement('div');
        cbRow.className = 'checklist-checkbox-row';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = entry.photographerIncluded;
        cb.id = 'video-' + activeTab + '-photographerIncluded';
        cb.addEventListener('change', function() { entry.photographerIncluded = cb.checked; });
        var cbLbl = document.createElement('label');
        cbLbl.htmlFor = 'video-' + activeTab + '-photographerIncluded';
        cbLbl.textContent = 'Photographer Included';
        cbRow.appendChild(cb);
        cbRow.appendChild(cbLbl);
        cbGroup.appendChild(cbRow);
        grid.appendChild(cbGroup);

        grid.appendChild(createFormGroup('Video Shoot Duration \u2014 Days', 'number', entry.shootDays, function(v) { entry.shootDays = v; }));
        grid.appendChild(createFormGroup('Video Shoot Duration \u2014 Hours', 'number', entry.shootHours, function(v) { entry.shootHours = v; }));
        grid.appendChild(createFormGroup('Video Shoot Location', 'text', entry.location, function(v) { entry.location = v; }));
        grid.appendChild(createFormGroup('Video Description', 'textarea', entry.description, function(v) { entry.description = v; }, { fullWidth: true, placeholder: 'Add any additional details...' }));

        content.appendChild(grid);
        body.appendChild(content);
      }

      buildTabs();
    }

    renderToggleableSection(container, 'Video', formData.video, renderVideoBody, clipboard, 'video');
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
    } else if (page === 2) {
      formData.page2ActiveMonths = getActiveMonthsList(formData);
      formData.socialLinks.facebook = 'https://facebook.com/agrisolutions';
      formData.socialLinks.instagram = 'https://instagram.com/agrisolutions';
      formData.socialLinks.linkedin = 'https://linkedin.com/company/agrisolutions';
      formData.socialMediaManagement.enabled = true;
      formData.socialMediaManagement.platforms.facebook = true;
      formData.socialMediaManagement.platforms.instagram = true;
      formData.socialMediaManagement.platforms.linkedin = true;
      formData.socialMediaManagement.monthlyPosts = 12;
      formData.socialMediaManagement.adSpend = 5000;
      formData.ownPageSocialMedia.enabled = true;
      formData.ownPageSocialMedia.items[0].enabled = true;
      formData.ownPageSocialMedia.items[0].amount = 8;
      formData.ownPageSocialMedia.items[0].curated = 2;
      formData.ownPageSocialMedia.items[3].enabled = true;
      formData.ownPageSocialMedia.items[3].amount = 6;
      formData.ownPageSocialMedia.items[3].curated = 2;
    } else if (page === 3) {
      formData.page3ActiveMonths = getActiveMonthsList(formData);
      formData.selectedCountries = ['South Africa', 'Namibia', 'Botswana', 'Kenya'];
      formData.agri4all.enabled = true;
      formData.agri4all.items[0].enabled = true;
      formData.agri4all.items[0].amount = 4;
      formData.agri4all.items[0].curated = 1;
      formData.agri4all.items[3].enabled = true;
      formData.agri4all.items[3].amount = 4;
      formData.agri4all.items[3].curated = 1;
      formData.agri4all.items[9].enabled = true;
      formData.agri4all.items[9].amount = 2;
    } else if (page === 4) {
      formData.page4ActiveMonths = getActiveMonthsList(formData);
      formData.onlineArticles.enabled = true;
      formData.onlineArticles.proAgriMedia = true;
      formData.onlineArticles.proAgriCoZa = true;
      formData.onlineArticles.amount = 3;
      formData.onlineArticles.curated = 1;
    } else if (page === 5) {
      formData.page5ActiveMonths = getActiveMonthsList(formData);
      formData.banners.enabled = true;
      formData.banners.agri4all = true;
      formData.banners.proAgri = true;
    } else if (page === 6) {
      formData.page6ActiveMonths = getActiveMonthsList(formData);
      formData.magazine.enabled = true;
      formData.magazine.entries = [
        { saDigital: true, africaPrint: false, africaDigital: true, coffeeTableBook: false },
        { saDigital: false, africaPrint: true, africaDigital: false, coffeeTableBook: false }
      ];
    } else if (page === 7) {
      formData.page7ActiveMonths = getActiveMonthsList(formData);
      formData.video.enabled = true;
      formData.video.entries[0].videoType = 'Promotional / Advertising';
      formData.video.entries[0].videoDuration = '3-5 min';
      formData.video.entries[0].photographerIncluded = true;
      formData.video.entries[0].shootDays = 2;
      formData.video.entries[0].shootHours = 0;
      formData.video.entries[0].location = 'Stellenbosch Wine Estate';
      formData.video.entries[0].description = 'Promotional video showcasing product range for the 2026 season.';
    }
  }
  function submitWizard(formData, onClose) { onClose(); }

})();
