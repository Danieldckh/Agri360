(function () {
  'use strict';

  function createSection(labelText) {
    var section = document.createElement('div');
    section.className = 'dev-component-section';
    var label = document.createElement('div');
    label.className = 'dev-component-label';
    label.textContent = labelText;
    section.appendChild(label);
    return section;
  }

  function createPreview() {
    var preview = document.createElement('div');
    preview.className = 'dev-component-preview';
    return preview;
  }

  function createFullPreview() {
    var preview = document.createElement('div');
    preview.className = 'dev-component-preview-full';
    return preview;
  }

  function createClassNote(text) {
    var note = document.createElement('div');
    note.className = 'dev-component-classes';
    note.textContent = text;
    return note;
  }

  function createAvatarSvg(size) {
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'rgba(128,128,128,0.4)');
    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z');
    svg.appendChild(path);
    return svg;
  }

  function makeSvg(pathD, size) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(size || 18));
    svg.setAttribute('height', String(size || 18));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  window.renderComponentsPage = function (container) {
    var page = document.createElement('div');
    page.className = 'dev-page';

    // Header
    var header = document.createElement('div');
    header.className = 'dev-page-header';
    var title = document.createElement('h1');
    title.className = 'dev-page-title';
    title.textContent = 'Components';
    header.appendChild(title);
    page.appendChild(header);

    // ===== 1. ProAgri Sheet (TOP) =====
    var sheetSection = createSection('ProAgri Sheet');
    var sheetPreview = createFullPreview();
    sheetPreview.style.border = '1px solid rgba(128,128,128,0.12)';
    sheetPreview.style.borderRadius = '12px';
    sheetPreview.style.overflow = 'hidden';

    if (window.renderSheet) {
      window.renderSheet(sheetPreview, {
        columns: [
          { key: 'title', label: 'Task', sortable: true, isName: true, type: 'text', editable: true },
          { key: 'status', label: 'Status', sortable: true, type: 'status', editable: true,
            options: ['pending', 'in_progress', 'completed', 'overdue'] },
          { key: 'assigned_to', label: 'Assigned', type: 'person', editable: true, multiple: true },
          { key: 'priority', label: 'Priority', sortable: true, type: 'status', editable: true,
            options: ['low', 'medium', 'high', 'urgent'] },
          { key: 'due_date', label: 'Due Date', sortable: true, type: 'date', editable: true },
          { key: 'tags', label: 'Tags', type: 'multiselect', editable: true,
            options: ['design', 'content', 'review', 'urgent', 'client-facing'] },
          { key: 'budget', label: 'Budget', sortable: true, type: 'number', editable: true },
          { key: 'done', label: 'Done', type: 'checkbox', editable: true, width: 'sm' }
        ],
        data: [
          { id: 1, title: 'Homepage Redesign', status: 'in_progress', assigned_to: [], priority: 'high', due_date: '2026-04-15', tags: ['design', 'client-facing'], budget: 15000, done: false },
          { id: 2, title: 'Social Media Campaign', status: 'pending', assigned_to: [], priority: 'medium', due_date: '2026-04-20', tags: ['content'], budget: 5000, done: false },
          { id: 3, title: 'Client Onboarding Pack', status: 'completed', assigned_to: [], priority: 'low', due_date: '2026-03-25', tags: ['review'], budget: 2500, done: true },
          { id: 4, title: 'Magazine Layout Q2', status: 'in_progress', assigned_to: [], priority: 'high', due_date: '2026-04-10', tags: ['design', 'review'], budget: 8000, done: false },
          { id: 5, title: 'Newsletter Template', status: 'overdue', assigned_to: [], priority: 'urgent', due_date: '2026-03-20', tags: ['content', 'urgent'], budget: 1200, done: false }
        ],
        radialActions: [
          { id: 'view', label: 'View Details', action: function () {} },
          { id: 'edit', label: 'Edit', action: function () {} },
          { id: 'delete', label: 'Delete', action: function () {}, highlight: true }
        ],
        searchable: true
      });
    }

    sheetSection.appendChild(sheetPreview);
    sheetSection.appendChild(createClassNote('window.renderSheet(container, config) — ui/js/proagri-sheet.js  |  Types: text, status, date, person, multiselect, number, checkbox'));
    page.appendChild(sheetSection);

    // ===== 2. Sheet Status Badges =====
    var statusSection = createSection('Sheet Status Badges');
    var statusPreview = createPreview();
    var statuses = ['pending', 'in_progress', 'completed', 'done', 'overdue', 'active', 'inactive', 'lead', 'low', 'medium', 'high', 'urgent', 'draft'];
    statuses.forEach(function (s) {
      var badge = document.createElement('span');
      badge.className = 'proagri-sheet-status proagri-sheet-status-' + s;
      badge.textContent = s.split(/[_\s]+/).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
      statusPreview.appendChild(badge);
    });
    statusSection.appendChild(statusPreview);
    statusSection.appendChild(createClassNote('.proagri-sheet-status-{key} — ui/css/proagri-sheet.css'));
    page.appendChild(statusSection);

    // ===== 3. Buttons =====
    var btnSection = createSection('Buttons');
    var btnPreview = createPreview();

    var btnPrimary = document.createElement('button');
    btnPrimary.className = 'dev-btn dev-btn-primary';
    btnPrimary.textContent = 'Primary';
    btnPreview.appendChild(btnPrimary);

    var btnGhost = document.createElement('button');
    btnGhost.className = 'dev-btn dev-btn-ghost';
    btnGhost.textContent = 'Ghost';
    btnPreview.appendChild(btnGhost);

    var btnApprove = document.createElement('button');
    btnApprove.className = 'btn-approve';
    btnApprove.textContent = 'Approve';
    btnPreview.appendChild(btnApprove);

    var btnDecline = document.createElement('button');
    btnDecline.className = 'btn-decline';
    btnDecline.textContent = 'Decline';
    btnPreview.appendChild(btnDecline);

    var btnRole = document.createElement('button');
    btnRole.className = 'btn-role';
    btnRole.textContent = 'Toggle Role';
    btnPreview.appendChild(btnRole);

    btnSection.appendChild(btnPreview);
    btnSection.appendChild(createClassNote('.dev-btn-primary  .dev-btn-ghost  .btn-approve  .btn-decline  .btn-role'));
    page.appendChild(btnSection);

    // ===== 4. Inputs =====
    var inputSection = createSection('Inputs');
    var inputPreview = createPreview();

    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = 'Text input';
    textInput.className = 'form-input';
    textInput.style.width = '200px';
    inputPreview.appendChild(textInput);

    var textarea = document.createElement('textarea');
    textarea.placeholder = 'Textarea';
    textarea.rows = 3;
    textarea.className = 'form-input';
    textarea.style.width = '200px';
    textarea.style.resize = 'vertical';
    textarea.style.fontFamily = 'inherit';
    inputPreview.appendChild(textarea);

    var selectEl = document.createElement('select');
    selectEl.className = 'form-select';
    selectEl.style.width = '200px';
    var defaultOpt = document.createElement('option');
    defaultOpt.textContent = 'Select option';
    defaultOpt.value = '';
    selectEl.appendChild(defaultOpt);
    ['Option A', 'Option B', 'Option C'].forEach(function (text) {
      var opt = document.createElement('option');
      opt.textContent = text;
      opt.value = text;
      selectEl.appendChild(opt);
    });
    inputPreview.appendChild(selectEl);

    inputSection.appendChild(inputPreview);
    inputSection.appendChild(createClassNote('.form-input  .form-select  (auth/css/auth.css)'));
    page.appendChild(inputSection);

    // ===== 5. Badges (Employee) =====
    var badgeSection = createSection('Employee Badges');
    var badgePreview = createPreview();

    var roleAdmin = document.createElement('span');
    roleAdmin.className = 'employee-role role-admin';
    roleAdmin.textContent = 'Admin';
    badgePreview.appendChild(roleAdmin);

    var roleEmployee = document.createElement('span');
    roleEmployee.className = 'employee-role role-employee';
    roleEmployee.textContent = 'Employee';
    badgePreview.appendChild(roleEmployee);

    var statusApproved = document.createElement('span');
    statusApproved.className = 'employee-status status-approved';
    statusApproved.textContent = 'Approved';
    badgePreview.appendChild(statusApproved);

    var statusPending = document.createElement('span');
    statusPending.className = 'employee-status status-pending';
    statusPending.textContent = 'Pending';
    badgePreview.appendChild(statusPending);

    var statusDeclined = document.createElement('span');
    statusDeclined.className = 'employee-status status-declined';
    statusDeclined.textContent = 'Declined';
    badgePreview.appendChild(statusDeclined);

    var unreadBadge = document.createElement('span');
    unreadBadge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:linear-gradient(to top,var(--color-accent-light),var(--color-accent-dark));color:#fff;font-size:11px;font-weight:600';
    unreadBadge.textContent = '3';
    badgePreview.appendChild(unreadBadge);

    badgeSection.appendChild(badgePreview);
    badgeSection.appendChild(createClassNote('.role-admin  .role-employee  .status-approved  .status-pending  .status-declined'));
    page.appendChild(badgeSection);

    // ===== 6. Avatars =====
    var avatarSection = createSection('Avatars');
    var avatarPreview = createPreview();

    [32, 48, 72].forEach(function (size) {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:rgba(128,128,128,0.1);border:2px solid rgba(128,128,128,0.15);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0';
      wrapper.appendChild(createAvatarSvg(Math.round(size * 0.6)));
      avatarPreview.appendChild(wrapper);
    });

    var avatarLabel = document.createElement('span');
    avatarLabel.style.cssText = 'color:#888;font-size:12px';
    avatarLabel.textContent = '32px / 48px / 72px';
    avatarPreview.appendChild(avatarLabel);

    avatarSection.appendChild(avatarPreview);
    avatarSection.appendChild(createClassNote('.employee-photo  (employees/css/employees.css)'));
    page.appendChild(avatarSection);

    // ===== 7. Cards =====
    var cardSection = createSection('Cards');
    var cardPreview = createPreview();

    var sampleCard = document.createElement('div');
    sampleCard.style.cssText = 'background:rgba(128,128,128,0.08);border-radius:16px;padding:24px;text-align:center;width:260px;transition:transform 0.2s,box-shadow 0.2s';

    var cardAvatar = document.createElement('div');
    cardAvatar.style.cssText = 'width:72px;height:72px;border-radius:50%;background:rgba(128,128,128,0.1);border:2px solid rgba(128,128,128,0.15);margin:0 auto;display:flex;align-items:center;justify-content:center';
    cardAvatar.appendChild(createAvatarSvg(40));
    sampleCard.appendChild(cardAvatar);

    var cardName = document.createElement('div');
    cardName.style.cssText = 'color:var(--text-primary);font-size:16px;font-weight:600;margin-top:14px';
    cardName.textContent = 'Johan van der Merwe';
    sampleCard.appendChild(cardName);

    var cardRole = document.createElement('span');
    cardRole.className = 'employee-role role-admin';
    cardRole.style.marginTop = '8px';
    cardRole.textContent = 'Admin';
    sampleCard.appendChild(cardRole);

    var cardStatusDiv = document.createElement('div');
    var cardStatusBadge = document.createElement('span');
    cardStatusBadge.className = 'employee-status status-approved';
    cardStatusBadge.style.marginTop = '6px';
    cardStatusBadge.textContent = 'Approved';
    cardStatusDiv.appendChild(cardStatusBadge);
    sampleCard.appendChild(cardStatusDiv);

    cardPreview.appendChild(sampleCard);
    cardSection.appendChild(cardPreview);
    cardSection.appendChild(createClassNote('.employee-card  (employees/css/employees.css)'));
    page.appendChild(cardSection);

    // ===== 8. Form Elements (Auth pattern) =====
    var formSection = createSection('Form Elements');
    var formPreview = createPreview();
    formPreview.style.flexDirection = 'column';
    formPreview.style.maxWidth = '320px';
    formPreview.style.gap = '0';

    var fg1 = document.createElement('div');
    fg1.className = 'form-group';
    var fl1 = document.createElement('label');
    fl1.className = 'form-label';
    fl1.textContent = 'Username';
    fg1.appendChild(fl1);
    var fi1 = document.createElement('input');
    fi1.className = 'form-input';
    fi1.type = 'text';
    fi1.placeholder = 'Enter username';
    fg1.appendChild(fi1);
    formPreview.appendChild(fg1);

    var fg2 = document.createElement('div');
    fg2.className = 'form-group';
    var fl2 = document.createElement('label');
    fl2.className = 'form-label';
    fl2.textContent = 'Security Question';
    fg2.appendChild(fl2);
    var fs2 = document.createElement('select');
    fs2.className = 'form-select';
    var dopt = document.createElement('option');
    dopt.textContent = 'Select a question...';
    fs2.appendChild(dopt);
    ['What city were you born in?', 'What is your pet\'s name?'].forEach(function (q) {
      var o = document.createElement('option');
      o.textContent = q;
      fs2.appendChild(o);
    });
    fg2.appendChild(fs2);
    formPreview.appendChild(fg2);

    var formBtn = document.createElement('button');
    formBtn.className = 'btn-primary';
    formBtn.type = 'button';
    formBtn.textContent = 'Submit';
    formBtn.style.marginTop = '8px';
    formPreview.appendChild(formBtn);

    formSection.appendChild(formPreview);
    formSection.appendChild(createClassNote('.form-group  .form-label  .form-input  .form-select  .btn-primary  (auth/css/auth.css)'));
    page.appendChild(formSection);

    // ===== 9. Loading & Empty States =====
    var statesSection = createSection('Loading & Empty States');
    var statesPreview = createPreview();
    statesPreview.style.flexDirection = 'column';
    statesPreview.style.gap = '0';

    var loadingEl = document.createElement('div');
    loadingEl.className = 'proagri-sheet-loading';
    loadingEl.textContent = 'Loading';
    statesPreview.appendChild(loadingEl);

    var emptyEl = document.createElement('div');
    emptyEl.className = 'proagri-sheet-empty';
    emptyEl.textContent = 'No items to display';
    statesPreview.appendChild(emptyEl);

    statesSection.appendChild(statesPreview);
    statesSection.appendChild(createClassNote('.proagri-sheet-loading  .proagri-sheet-empty  (ui/css/proagri-sheet.css)'));
    page.appendChild(statesSection);

    // ===== 10. Modal Dialog =====
    var modalSection = createSection('Modal Dialog');
    var modalPreview = createFullPreview();
    modalPreview.style.position = 'relative';
    modalPreview.style.height = '280px';
    modalPreview.style.borderRadius = '12px';
    modalPreview.style.overflow = 'hidden';

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;border-radius:12px';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--color-secondary,#fff);border-radius:16px;padding:24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,0.2)';

    var modalTitle = document.createElement('h3');
    modalTitle.style.cssText = 'font-size:16px;font-weight:600;color:var(--text-primary);margin:0 0 16px 0';
    modalTitle.textContent = 'Create Channel';
    modal.appendChild(modalTitle);

    var modalInput = document.createElement('input');
    modalInput.type = 'text';
    modalInput.placeholder = 'Channel name';
    modalInput.style.cssText = 'width:100%;padding:10px 14px;border:1px solid rgba(128,128,128,0.2);border-radius:10px;background:rgba(128,128,128,0.06);color:var(--text-primary);font-size:14px;outline:none;box-sizing:border-box;margin-bottom:16px;font-family:inherit';
    modal.appendChild(modalInput);

    var modalActions = document.createElement('div');
    modalActions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'padding:8px 20px;border-radius:8px;border:none;background:rgba(128,128,128,0.1);color:var(--text-secondary);cursor:pointer;font-size:13px;font-family:inherit';
    cancelBtn.textContent = 'Cancel';
    modalActions.appendChild(cancelBtn);

    var createBtn = document.createElement('button');
    createBtn.style.cssText = 'padding:8px 20px;border-radius:8px;border:none;background:var(--color-accent-light);color:#fff;cursor:pointer;font-size:13px;font-weight:500;font-family:inherit';
    createBtn.textContent = 'Create';
    modalActions.appendChild(createBtn);

    modal.appendChild(modalActions);
    overlay.appendChild(modal);
    modalPreview.appendChild(overlay);

    modalSection.appendChild(modalPreview);
    modalSection.appendChild(createClassNote('.msg-modal-overlay  .msg-modal  (messaging/css/messaging.css pattern)'));
    page.appendChild(modalSection);

    // ===== 11. User Dropdown =====
    var dropdownSection = createSection('User Dropdown');
    var dropdownPreview = createPreview();

    var dd = document.createElement('div');
    dd.style.cssText = 'background:var(--color-secondary,#fff);border:1px solid rgba(128,128,128,0.12);border-radius:16px;padding:16px;width:240px;box-shadow:0 8px 24px rgba(0,0,0,0.12)';

    var ddPhoto = document.createElement('div');
    ddPhoto.style.cssText = 'width:56px;height:56px;border-radius:50%;background:rgba(128,128,128,0.1);border:2px solid rgba(128,128,128,0.15);margin:0 auto 12px;display:flex;align-items:center;justify-content:center';
    ddPhoto.appendChild(createAvatarSvg(32));
    dd.appendChild(ddPhoto);

    var ddName = document.createElement('div');
    ddName.style.cssText = 'text-align:center;font-size:14px;font-weight:600;color:var(--text-primary)';
    ddName.textContent = 'Admin User';
    dd.appendChild(ddName);

    var ddUsername = document.createElement('div');
    ddUsername.style.cssText = 'text-align:center;font-size:12px;color:var(--text-muted);margin-bottom:12px';
    ddUsername.textContent = '@admin';
    dd.appendChild(ddUsername);

    var ddDivider = document.createElement('div');
    ddDivider.style.cssText = 'height:1px;background:rgba(128,128,128,0.12);margin:8px 0';
    dd.appendChild(ddDivider);

    var ddEdit = document.createElement('div');
    ddEdit.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px;color:var(--text-secondary)';
    ddEdit.appendChild(makeSvg('M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z'));
    var ddEditLabel = document.createElement('span');
    ddEditLabel.textContent = 'Edit Profile';
    ddEdit.appendChild(ddEditLabel);
    dd.appendChild(ddEdit);

    var ddDivider2 = document.createElement('div');
    ddDivider2.style.cssText = 'height:1px;background:rgba(128,128,128,0.12);margin:8px 0';
    dd.appendChild(ddDivider2);

    var ddSignout = document.createElement('div');
    ddSignout.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px;color:#e74c3c';
    ddSignout.appendChild(makeSvg('M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z'));
    var ddSignoutLabel = document.createElement('span');
    ddSignoutLabel.textContent = 'Sign Out';
    ddSignout.appendChild(ddSignoutLabel);
    dd.appendChild(ddSignout);

    dropdownPreview.appendChild(dd);
    dropdownSection.appendChild(dropdownPreview);
    dropdownSection.appendChild(createClassNote('.user-dropdown  (ui/css/styles.css — app.js createDropdown())'));
    page.appendChild(dropdownSection);

    container.appendChild(page);
  };
})();
