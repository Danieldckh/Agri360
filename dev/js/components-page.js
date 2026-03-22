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
    svg.setAttribute('fill', 'rgba(255,255,255,0.3)');
    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z');
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

    // ===== Buttons =====
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

    // ===== Inputs =====
    var inputSection = createSection('Inputs');
    var inputPreview = createPreview();

    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = 'Text input';
    textInput.style.width = '200px';
    textInput.style.background = 'rgba(255, 255, 255, 0.08)';
    textInput.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    textInput.style.borderRadius = '10px';
    textInput.style.color = '#fff';
    textInput.style.padding = '12px 16px';
    textInput.style.fontSize = '14px';
    textInput.style.outline = 'none';
    inputPreview.appendChild(textInput);

    var textarea = document.createElement('textarea');
    textarea.placeholder = 'Textarea';
    textarea.rows = 3;
    textarea.style.width = '200px';
    textarea.style.background = 'rgba(255, 255, 255, 0.08)';
    textarea.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    textarea.style.borderRadius = '10px';
    textarea.style.color = '#fff';
    textarea.style.padding = '12px 16px';
    textarea.style.fontSize = '14px';
    textarea.style.outline = 'none';
    textarea.style.resize = 'vertical';
    textarea.style.fontFamily = 'inherit';
    inputPreview.appendChild(textarea);

    var select = document.createElement('select');
    select.style.width = '200px';
    select.style.background = 'rgba(255, 255, 255, 0.08)';
    select.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    select.style.borderRadius = '10px';
    select.style.color = '#fff';
    select.style.padding = '12px 16px';
    select.style.fontSize = '14px';
    select.style.outline = 'none';
    select.style.cursor = 'pointer';

    var defaultOpt = document.createElement('option');
    defaultOpt.textContent = 'Select option';
    defaultOpt.value = '';
    select.appendChild(defaultOpt);

    ['Option A', 'Option B', 'Option C'].forEach(function (text) {
      var opt = document.createElement('option');
      opt.textContent = text;
      opt.value = text;
      select.appendChild(opt);
    });

    inputPreview.appendChild(select);

    inputSection.appendChild(inputPreview);
    inputSection.appendChild(createClassNote('.form-input  .form-select  (auth/css/auth.css pattern)'));
    page.appendChild(inputSection);

    // ===== Badges =====
    var badgeSection = createSection('Badges');
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
    unreadBadge.style.display = 'inline-flex';
    unreadBadge.style.alignItems = 'center';
    unreadBadge.style.justifyContent = 'center';
    unreadBadge.style.minWidth = '20px';
    unreadBadge.style.height = '20px';
    unreadBadge.style.padding = '0 6px';
    unreadBadge.style.borderRadius = '10px';
    unreadBadge.style.background = 'linear-gradient(to top, var(--color-accent-light), var(--color-accent-dark))';
    unreadBadge.style.color = '#fff';
    unreadBadge.style.fontSize = '11px';
    unreadBadge.style.fontWeight = '600';
    unreadBadge.textContent = '3';
    badgePreview.appendChild(unreadBadge);

    badgeSection.appendChild(badgePreview);
    badgeSection.appendChild(createClassNote('.role-admin  .role-employee  .status-approved  .status-pending  .status-declined  (unread pill)'));
    page.appendChild(badgeSection);

    // ===== Avatars =====
    var avatarSection = createSection('Avatars');
    var avatarPreview = createPreview();

    [32, 48, 72].forEach(function (size) {
      var wrapper = document.createElement('div');
      wrapper.style.width = size + 'px';
      wrapper.style.height = size + 'px';
      wrapper.style.borderRadius = '50%';
      wrapper.style.background = 'rgba(255, 255, 255, 0.08)';
      wrapper.style.border = '2px solid rgba(255, 255, 255, 0.1)';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.overflow = 'hidden';
      wrapper.style.flexShrink = '0';

      var svgSize = Math.round(size * 0.6);
      var svg = createAvatarSvg(svgSize);
      wrapper.appendChild(svg);

      avatarPreview.appendChild(wrapper);
    });

    var avatarLabel = document.createElement('span');
    avatarLabel.style.color = '#888';
    avatarLabel.style.fontSize = '12px';
    avatarLabel.textContent = '32px / 48px / 72px';
    avatarPreview.appendChild(avatarLabel);

    avatarSection.appendChild(avatarPreview);
    avatarSection.appendChild(createClassNote('.employee-photo  (32px, 48px, 72px circles)'));
    page.appendChild(avatarSection);

    // ===== Cards =====
    var cardSection = createSection('Cards');
    var cardPreview = createPreview();

    var sampleCard = document.createElement('div');
    sampleCard.style.background = 'rgba(255, 255, 255, 0.06)';
    sampleCard.style.borderRadius = '16px';
    sampleCard.style.padding = '24px';
    sampleCard.style.textAlign = 'center';
    sampleCard.style.width = '260px';
    sampleCard.style.transition = 'transform 0.2s, box-shadow 0.2s';

    var cardAvatar = document.createElement('div');
    cardAvatar.style.width = '72px';
    cardAvatar.style.height = '72px';
    cardAvatar.style.borderRadius = '50%';
    cardAvatar.style.background = 'rgba(255, 255, 255, 0.08)';
    cardAvatar.style.border = '2px solid rgba(255, 255, 255, 0.1)';
    cardAvatar.style.margin = '0 auto';
    cardAvatar.style.display = 'flex';
    cardAvatar.style.alignItems = 'center';
    cardAvatar.style.justifyContent = 'center';
    cardAvatar.appendChild(createAvatarSvg(40));
    sampleCard.appendChild(cardAvatar);

    var cardName = document.createElement('div');
    cardName.style.color = '#fff';
    cardName.style.fontSize = '16px';
    cardName.style.fontWeight = '600';
    cardName.style.marginTop = '14px';
    cardName.textContent = 'Johan van der Merwe';
    sampleCard.appendChild(cardName);

    var cardRole = document.createElement('span');
    cardRole.className = 'employee-role role-admin';
    cardRole.style.marginTop = '8px';
    cardRole.textContent = 'Admin';
    sampleCard.appendChild(cardRole);

    var cardStatus = document.createElement('div');
    var statusBadge = document.createElement('span');
    statusBadge.className = 'employee-status status-approved';
    statusBadge.style.marginTop = '6px';
    statusBadge.textContent = 'Approved';
    cardStatus.appendChild(statusBadge);
    sampleCard.appendChild(cardStatus);

    cardPreview.appendChild(sampleCard);

    cardSection.appendChild(cardPreview);
    cardSection.appendChild(createClassNote('.employee-card  (employees/css/employees.css pattern)'));
    page.appendChild(cardSection);

    container.appendChild(page);
  };
})();
