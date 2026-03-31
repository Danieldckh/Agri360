/* Messaging Module — WhatsApp-style layout */
(function () {
  var MSG_API = (window.API_URL || '/api') + '/messaging';
  var DEFAULT_AVATAR = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(128,128,128,0.4)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>');

  // State
  var activeChannelId = null;
  var pollingIntervals = [];
  var employeeCache = null;
  var channelList = [];
  var lastMessageId = 0;
  var mainContainer = null;
  var convPane = null;
  var chatPane = null;
  var searchDebounceTimer = null;
  var sidebarFilter = 'all'; // 'all' | 'channels' | 'dms' | 'clients'
  var isMobileChat = false;
  var currentChannelMembers = [];

  // ========== HELPERS ==========

  function getUser() {
    var u = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!u) return { id: 1, username: 'admin', role: 'admin', firstName: 'Admin', lastName: 'User' };
    return u;
  }

  function authHeaders() {
    var h = window.getAuthHeaders ? window.getAuthHeaders() : {};
    return h;
  }

  function jsonHeaders() {
    var h = authHeaders();
    h['Content-Type'] = 'application/json';
    return h;
  }

  function apiGet(path) {
    return fetch(MSG_API + path, { headers: authHeaders() }).then(function (r) { return r.json(); });
  }

  function apiPost(path, body) {
    return fetch(MSG_API + path, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (err) { return Promise.reject(err); });
      return r.json();
    });
  }

  function apiPatch(path, body) {
    return fetch(MSG_API + path, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (err) { return Promise.reject(err); });
      return r.json();
    });
  }

  function apiDelete(path) {
    return fetch(MSG_API + path, {
      method: 'DELETE',
      headers: authHeaders()
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (err) { return Promise.reject(err); });
      return r.json();
    });
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[d.getDay()] + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString();
  }

  function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function createSvgButton(pathD, className, size) {
    var btn = document.createElement('button');
    btn.className = className || '';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(size || 18));
    svg.setAttribute('height', String(size || 18));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathD);
    svg.appendChild(p);
    btn.appendChild(svg);
    return btn;
  }

  function makeSvg(pathD, size) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(size || 16));
    svg.setAttribute('height', String(size || 16));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathD);
    svg.appendChild(p);
    return svg;
  }

  function fetchEmployees() {
    if (employeeCache) return Promise.resolve(employeeCache);
    return fetch((window.API_URL || '/api') + '/employees', { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        employeeCache = Array.isArray(data) ? data : [];
        return employeeCache;
      })
      .catch(function () {
        return [];
      });
  }

  function findChannel(id) {
    for (var i = 0; i < channelList.length; i++) {
      if (channelList[i].id === id) return channelList[i];
      if (channelList[i].children) {
        for (var j = 0; j < channelList[i].children.length; j++) {
          if (channelList[i].children[j].id === id) return channelList[i].children[j];
        }
      }
    }
    return null;
  }

  function getDmOtherName(ch) {
    if (ch.dm_partner) {
      return (ch.dm_partner.first_name || '') + ' ' + (ch.dm_partner.last_name || '');
    }
    var user = getUser();
    if (ch.latest_message) {
      var senderId = ch.latest_message.sender_id;
      var senderFirst = ch.latest_message.sender_first_name || '';
      var senderLast = ch.latest_message.sender_last_name || '';
      if (senderId !== user.id && senderFirst) {
        return senderFirst + ' ' + senderLast;
      }
    }
    return ch.name || 'Direct Message';
  }

  function getDmOtherPhoto(ch) {
    if (ch.dm_partner && ch.dm_partner.photo_url) {
      return '/uploads/photos/' + ch.dm_partner.photo_url;
    }
    var user = getUser();
    if (ch.latest_message && ch.latest_message.sender_id !== user.id && ch.latest_message.sender_photo_url) {
      return '/uploads/photos/' + ch.latest_message.sender_photo_url;
    }
    return null;
  }

  function flattenChannels(channels) {
    var result = [];
    channels.forEach(function (ch) {
      result.push(ch);
      if (ch.children && ch.children.length > 0) {
        ch.children.forEach(function (sub) {
          result.push(sub);
        });
      }
    });
    return result;
  }

  // ========== RENDER MAIN SECTION (template-based) ==========

  function renderMessagingSection(container) {
    mainContainer = container;
    container.style.display = 'flex';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.flexDirection = 'row';
    container.style.height = '100%';
    container.style.gap = '0';
    container.style.padding = '0';

    var card = container.closest('.card');
    if (card) {
      card.dataset.prevPadding = card.style.padding;
      card.style.padding = '0';
      card.style.overflow = 'hidden';
    }

    window.insertTemplate(container, 'pages/messaging.html', function () {
      convPane = container.querySelector('#msgConvPane');
      chatPane = container.querySelector('#msgChatPane');

      var searchInput = container.querySelector('#msgSearchInput');
      var newBtn = container.querySelector('#msgNewBtn');

      // Search filtering
      searchInput.addEventListener('input', function () {
        clearTimeout(searchDebounceTimer);
        var q = searchInput.value.trim().toLowerCase();
        searchDebounceTimer = setTimeout(function () {
          renderConversationList(q);
        }, 150);
      });

      newBtn.addEventListener('click', function () {
        showNewConversationMenu(newBtn);
      });

      loadConversationList();
      startUnreadPolling();
    });
  }

  function renderWelcomeState() {
    chatPane.innerHTML =
      '<div class="msg-welcome">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="msg-welcome-icon"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>' +
        '<h3 class="msg-welcome-title">Welcome to Messaging</h3>' +
        '<p class="msg-welcome-desc">Select a conversation to get started.</p>' +
      '</div>';
  }

  // ========== NEW CONVERSATION MENU ==========

  function showNewConversationMenu(anchorBtn) {
    var existing = document.querySelector('.msg-new-menu');
    if (existing) {
      existing.parentNode.removeChild(existing);
      return;
    }

    var menu = document.createElement('div');
    menu.className = 'msg-new-menu';

    var chBtn = document.createElement('button');
    chBtn.className = 'msg-new-menu-item';
    chBtn.textContent = 'New Channel';
    chBtn.addEventListener('click', function () {
      menu.parentNode.removeChild(menu);
      renderChannelCreateModal();
    });
    menu.appendChild(chBtn);

    var dmBtn = document.createElement('button');
    dmBtn.className = 'msg-new-menu-item';
    dmBtn.textContent = 'New Direct Message';
    dmBtn.addEventListener('click', function () {
      menu.parentNode.removeChild(menu);
      renderDmCreateModal();
    });
    menu.appendChild(dmBtn);

    anchorBtn.parentNode.style.position = 'relative';
    anchorBtn.parentNode.appendChild(menu);

    function closeMenu(e) {
      if (!menu.contains(e.target) && e.target !== anchorBtn) {
        if (menu.parentNode) menu.parentNode.removeChild(menu);
        document.removeEventListener('click', closeMenu);
      }
    }
    setTimeout(function () {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  // ========== CONVERSATION LIST ==========

  function loadConversationList() {
    apiGet('/channels').then(function (data) {
      if (!Array.isArray(data)) {
        channelList = [];
        renderConversationList('');
        return;
      }
      channelList = data;
      renderConversationList('');
    }).catch(function () {
      channelList = [];
      renderConversationList('');
    });
  }

  function renderConversationList(searchQuery) {
    var listEl = document.getElementById('msgConvList');
    if (!listEl) return;
    clearEl(listEl);

    var allChannels = flattenChannels(channelList);

    // Apply sidebar filter
    if (sidebarFilter === 'channels') {
      allChannels = allChannels.filter(function (c) { return c.type !== 'dm' && c.type !== 'client'; });
    } else if (sidebarFilter === 'dms') {
      allChannels = allChannels.filter(function (c) { return c.type === 'dm'; });
    } else if (sidebarFilter === 'clients') {
      allChannels = allChannels.filter(function (c) { return c.type === 'client'; });
    }

    // Apply search filter
    if (searchQuery) {
      allChannels = allChannels.filter(function (ch) {
        var name = ch.type === 'dm' ? getDmOtherName(ch) : (ch.name || '');
        return name.toLowerCase().indexOf(searchQuery) !== -1;
      });
    }

    // Sort by latest message date descending
    allChannels.sort(function (a, b) {
      var aTime = (a.latest_message && a.latest_message.created_at) ? new Date(a.latest_message.created_at).getTime() : 0;
      var bTime = (b.latest_message && b.latest_message.created_at) ? new Date(b.latest_message.created_at).getTime() : 0;
      return bTime - aTime;
    });

    if (allChannels.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'msg-empty';
      empty.textContent = searchQuery ? 'No conversations found.' : 'No conversations yet.';
      listEl.appendChild(empty);
      return;
    }

    allChannels.forEach(function (ch) {
      listEl.appendChild(renderConversationRow(ch));
    });
  }

  function renderConversationRow(channel) {
    var row = document.createElement('div');
    row.className = 'msg-conv-row';
    row.dataset.channelId = channel.id;
    if (activeChannelId === channel.id) {
      row.classList.add('active');
    }

    // Avatar
    var avatarDiv = document.createElement('div');
    avatarDiv.className = 'msg-conv-avatar';

    if (channel.type === 'dm') {
      var photoUrl = getDmOtherPhoto(channel);
      if (photoUrl) {
        var img = document.createElement('img');
        img.src = photoUrl;
        img.alt = '';
        avatarDiv.appendChild(img);
      } else {
        avatarDiv.appendChild(makeSvg('M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', 20));
      }
    } else {
      if (channel.emoji) {
        var emojiSpan = document.createElement('span');
        emojiSpan.className = 'msg-conv-avatar-emoji';
        emojiSpan.textContent = channel.emoji;
        avatarDiv.appendChild(emojiSpan);
      } else if (channel.icon && window.EmojiIconPicker) {
        var svgEl = window.EmojiIconPicker.getIconSvg(channel.icon, 20);
        if (svgEl) {
          avatarDiv.appendChild(svgEl);
        } else {
          var hash = document.createElement('span');
          hash.className = 'msg-conv-avatar-emoji';
          hash.textContent = '#';
          avatarDiv.appendChild(hash);
        }
      } else {
        var hashFallback = document.createElement('span');
        hashFallback.className = 'msg-conv-avatar-emoji';
        hashFallback.textContent = '#';
        avatarDiv.appendChild(hashFallback);
      }
    }
    row.appendChild(avatarDiv);

    // Info section
    var info = document.createElement('div');
    info.className = 'msg-conv-info';

    var topRow = document.createElement('div');
    topRow.className = 'msg-conv-top';

    var nameEl = document.createElement('span');
    nameEl.className = 'msg-conv-name';
    nameEl.textContent = channel.type === 'dm' ? getDmOtherName(channel) : (channel.name || 'Unnamed');
    topRow.appendChild(nameEl);

    var timeEl = document.createElement('span');
    timeEl.className = 'msg-conv-time';
    if (channel.latest_message) {
      timeEl.textContent = formatTime(channel.latest_message.created_at);
    }
    topRow.appendChild(timeEl);

    info.appendChild(topRow);

    var bottomRow = document.createElement('div');
    bottomRow.className = 'msg-conv-bottom';

    var preview = document.createElement('span');
    preview.className = 'msg-conv-preview';
    if (channel.latest_message) {
      var previewText = '';
      if (channel.type !== 'dm' && channel.latest_message.sender_first_name) {
        var user = getUser();
        if (channel.latest_message.sender_id === user.id) {
          previewText = 'You: ';
        } else {
          previewText = channel.latest_message.sender_first_name + ': ';
        }
      }
      var content = (channel.latest_message.content || '').replace(/@\[[^\]]+\]\(employee:\d+\)/g, function (m) {
        var name = m.match(/@\[([^\]]+)\]/);
        return name ? '@' + name[1] : m;
      });
      previewText += content;
      if (previewText.length > 40) previewText = previewText.substring(0, 40) + '...';
      preview.textContent = previewText;
    }
    bottomRow.appendChild(preview);

    if (channel.unread_count > 0) {
      var badge = document.createElement('span');
      badge.className = 'msg-unread-badge';
      badge.textContent = String(channel.unread_count);
      bottomRow.appendChild(badge);
    }

    info.appendChild(bottomRow);
    row.appendChild(info);

    row.addEventListener('click', function () {
      selectChannel(channel.id);
    });

    return row;
  }

  function highlightConversationRow() {
    var listEl = document.getElementById('msgConvList');
    if (!listEl) return;
    var rows = listEl.querySelectorAll('.msg-conv-row');
    rows.forEach(function (r) {
      r.classList.toggle('active', r.dataset.channelId === String(activeChannelId));
    });
  }

  // ========== SELECT CHANNEL ==========

  function selectChannel(channelId) {
    activeChannelId = channelId;
    lastMessageId = 0;
    highlightConversationRow();
    stopMessagePolling();

    if (window.innerWidth <= 768) {
      isMobileChat = true;
      if (convPane) convPane.style.display = 'none';
      if (chatPane) chatPane.style.display = 'flex';
    }

    renderChatView(channelId);
    startMessagePolling(channelId);
  }

  function goBackToConversations() {
    isMobileChat = false;
    if (convPane) convPane.style.display = '';
    if (chatPane) chatPane.style.display = '';
    activeChannelId = null;
    highlightConversationRow();
    renderWelcomeState();
  }

  // ========== CHAT VIEW ==========

  var peoplePanel = null;
  var peoplePanelVisible = false;

  function renderChatView(channelId) {
    clearEl(chatPane);

    var chInfo = findChannel(channelId);

    // Wrap chat content and people panel in a flex container
    var chatWrapper = document.createElement('div');
    chatWrapper.className = 'msg-chat-wrapper';

    var chatMain = document.createElement('div');
    chatMain.className = 'msg-chat-main';

    // Header
    var header = document.createElement('div');
    header.className = 'msg-chat-header';

    if (window.innerWidth <= 768) {
      var backBtn = createSvgButton('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z', 'msg-chat-back-btn', 20);
      backBtn.addEventListener('click', goBackToConversations);
      header.appendChild(backBtn);
    }

    var headerAvatar = document.createElement('div');
    headerAvatar.className = 'msg-chat-header-avatar';
    if (chInfo) {
      if (chInfo.type === 'dm') {
        var photoUrl = getDmOtherPhoto(chInfo);
        if (photoUrl) {
          var img = document.createElement('img');
          img.src = photoUrl;
          img.alt = '';
          headerAvatar.appendChild(img);
        } else {
          headerAvatar.appendChild(makeSvg('M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', 20));
        }
      } else {
        if (chInfo.emoji) {
          var emojiSpan = document.createElement('span');
          emojiSpan.textContent = chInfo.emoji;
          headerAvatar.appendChild(emojiSpan);
        } else if (chInfo.icon && window.EmojiIconPicker) {
          var svgEl = window.EmojiIconPicker.getIconSvg(chInfo.icon, 18);
          if (svgEl) headerAvatar.appendChild(svgEl);
          else headerAvatar.textContent = '#';
        } else {
          headerAvatar.textContent = '#';
        }
      }
    }
    header.appendChild(headerAvatar);

    var headerInfo = document.createElement('div');
    headerInfo.className = 'msg-chat-header-info';

    var headerName = document.createElement('span');
    headerName.className = 'msg-chat-header-name';
    if (chInfo) {
      headerName.textContent = chInfo.type === 'dm' ? getDmOtherName(chInfo) : (chInfo.name || 'Channel');
    } else {
      headerName.textContent = 'Channel';
    }
    headerInfo.appendChild(headerName);

    if (chInfo && chInfo.type !== 'dm') {
      var headerSub = document.createElement('span');
      headerSub.className = 'msg-chat-header-sub';
      headerSub.textContent = 'Channel';
      headerInfo.appendChild(headerSub);
    }

    header.appendChild(headerInfo);

    // People toggle button in header
    var peopleToggle = createSvgButton('M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', 'msg-people-toggle', 20);
    peopleToggle.title = 'People';
    peopleToggle.addEventListener('click', function () {
      peoplePanelVisible = !peoplePanelVisible;
      if (peoplePanel) {
        peoplePanel.classList.toggle('msg-people--visible', peoplePanelVisible);
      }
      peopleToggle.classList.toggle('active', peoplePanelVisible);
    });
    header.appendChild(peopleToggle);

    chatMain.appendChild(header);

    // Messages container
    var messagesDiv = document.createElement('div');
    messagesDiv.className = 'msg-messages';
    messagesDiv.id = 'msgMessagesContainer';

    var loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg-loading';
    loadingMsg.textContent = 'Loading messages...';
    messagesDiv.appendChild(loadingMsg);

    chatMain.appendChild(messagesDiv);

    // Message input
    var inputBar = renderMessageInputEl(channelId);
    chatMain.appendChild(inputBar);

    chatWrapper.appendChild(chatMain);

    // People panel (right side)
    peoplePanel = document.createElement('div');
    peoplePanel.className = 'msg-people-panel' + (peoplePanelVisible ? ' msg-people--visible' : '');

    var peopleTitleRow = document.createElement('div');
    peopleTitleRow.className = 'msg-people-title-row';
    var peopleTitle = document.createElement('h3');
    peopleTitle.className = 'msg-people-title';
    peopleTitle.textContent = 'People';
    peopleTitleRow.appendChild(peopleTitle);

    var inviteBtn = document.createElement('button');
    inviteBtn.className = 'msg-people-invite-btn';
    inviteBtn.title = 'Add people';
    inviteBtn.textContent = '+';
    inviteBtn.addEventListener('click', function () {
      var memberIds = currentChannelMembers.map(function (m) { return m.employee_id; });
      renderInviteModal(channelId, memberIds);
    });
    peopleTitleRow.appendChild(inviteBtn);

    peoplePanel.appendChild(peopleTitleRow);

    var peopleList = document.createElement('div');
    peopleList.className = 'msg-people-list';
    peopleList.id = 'msgPeopleList';

    var loadingPeople = document.createElement('div');
    loadingPeople.className = 'msg-loading';
    loadingPeople.textContent = 'Loading...';
    peopleList.appendChild(loadingPeople);
    peoplePanel.appendChild(peopleList);

    chatWrapper.appendChild(peoplePanel);
    chatPane.appendChild(chatWrapper);

    // Load messages
    fetch(MSG_API + '/channels/' + channelId + '/messages?limit=50', { headers: authHeaders() }).then(function (r) {
      if (r.status === 403) {
        clearEl(messagesDiv);
        var forbidden = document.createElement('div');
        forbidden.className = 'msg-empty';
        forbidden.textContent = 'You do not have access to this channel.';
        messagesDiv.appendChild(forbidden);
        return;
      }
      return r.json().then(function (messages) {
        clearEl(messagesDiv);
        if (!Array.isArray(messages)) messages = [];

        messages.forEach(function (msg) {
          messagesDiv.appendChild(createMessageBubble(msg));
        });

        if (messages.length > 0) {
          lastMessageId = messages[messages.length - 1].id;
        }

        setTimeout(function () {
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 50);
      });
    }).catch(function () {
      clearEl(messagesDiv);
      var err = document.createElement('div');
      err.className = 'msg-empty';
      err.textContent = 'Failed to load messages.';
      messagesDiv.appendChild(err);
    });

    // Load members for header count and people panel
    apiGet('/channels/' + channelId + '/members').then(function (members) {
      if (!Array.isArray(members)) return;
      currentChannelMembers = members;

      // Update header sub text
      if (chInfo && chInfo.type !== 'dm') {
        var headerSubEl = chatMain.querySelector('.msg-chat-header-sub');
        if (headerSubEl) {
          headerSubEl.textContent = members.length + ' member' + (members.length !== 1 ? 's' : '');
        }
      }

      // Render people list
      clearEl(peopleList);
      members.forEach(function (member) {
        var row = document.createElement('div');
        row.className = 'msg-people-row';
        row.tabIndex = 0;

        var avatar = document.createElement('div');
        avatar.className = 'msg-people-avatar';
        if (member.photo_url) {
          var avatarImg = document.createElement('img');
          avatarImg.src = '/uploads/photos/' + member.photo_url;
          avatarImg.alt = '';
          avatar.appendChild(avatarImg);
        } else {
          avatar.appendChild(makeSvg('M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', 18));
        }
        row.appendChild(avatar);

        var info = document.createElement('div');
        info.className = 'msg-people-info';

        var name = document.createElement('span');
        name.className = 'msg-people-name';
        name.textContent = (member.first_name || '') + ' ' + (member.last_name || '');
        info.appendChild(name);

        if (member.role === 'admin') {
          var roleBadge = document.createElement('span');
          roleBadge.className = 'msg-people-role';
          roleBadge.textContent = 'Admin';
          info.appendChild(roleBadge);
        }

        row.appendChild(info);

        // Click to DM this person
        var userId = getUser().id;
        if (member.employee_id !== userId) {
          row.style.cursor = 'pointer';
          row.addEventListener('click', function () {
            apiGet('/dm/' + member.employee_id).then(function (dmChannel) {
              if (dmChannel && dmChannel.id) {
                selectChannel(dmChannel.id);
                loadConversationList();
              }
            });
          });
        }

        peopleList.appendChild(row);
      });
    }).catch(function () {
      clearEl(peopleList);
      var err = document.createElement('div');
      err.className = 'msg-loading';
      err.textContent = 'Could not load members.';
      peopleList.appendChild(err);
    });
  }

  // ========== MESSAGE BUBBLES ==========

  function createMessageBubble(msg) {
    var user = getUser();
    var isOwn = msg.sender_id === user.id;

    var bubble = document.createElement('div');
    bubble.className = 'msg-bubble' + (isOwn ? ' msg-bubble-own' : '');
    bubble.dataset.messageId = msg.id;

    if (!isOwn) {
      var avatar = document.createElement('img');
      avatar.className = 'msg-bubble-avatar';
      avatar.alt = '';
      if (msg.sender_photo_url) {
        avatar.src = '/uploads/photos/' + msg.sender_photo_url;
      } else {
        avatar.src = DEFAULT_AVATAR;
      }
      bubble.appendChild(avatar);
    }

    var body = document.createElement('div');
    body.className = 'msg-bubble-body';

    var meta = document.createElement('div');
    meta.className = 'msg-bubble-meta';

    var senderName = document.createElement('span');
    senderName.className = 'msg-bubble-sender';
    senderName.textContent = (msg.sender_first_name || '') + ' ' + (msg.sender_last_name || '');
    meta.appendChild(senderName);

    var ts = document.createElement('span');
    ts.className = 'msg-bubble-time';
    ts.textContent = formatTime(msg.created_at);
    meta.appendChild(ts);

    if (msg.is_pinned) {
      var pinIcon = makeSvg('M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z', 12);
      pinIcon.classList.add('msg-pin-indicator');
      meta.appendChild(pinIcon);
    }

    body.appendChild(meta);

    var contentEl = document.createElement('div');
    contentEl.className = 'msg-bubble-content';
    renderMentionContent(contentEl, msg.content || '');
    body.appendChild(contentEl);

    if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      msg.attachments.forEach(function (att) {
        var attEl = document.createElement('div');
        attEl.className = 'msg-attachment';

        if (att.mime_type && att.mime_type.indexOf('image/') === 0) {
          var img = document.createElement('img');
          img.className = 'msg-attachment-img';
          img.src = '/uploads/attachments/' + att.filename;
          img.alt = att.original_name || 'Image';
          attEl.appendChild(img);
        } else {
          var link = document.createElement('a');
          link.className = 'msg-attachment-link';
          link.href = '/uploads/attachments/' + att.filename;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          var fileIcon = makeSvg('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z', 14);
          link.appendChild(fileIcon);
          var fname = document.createElement('span');
          fname.textContent = att.original_name || att.filename;
          link.appendChild(fname);
          attEl.appendChild(link);
        }

        body.appendChild(attEl);
      });
    }

    bubble.appendChild(body);
    return bubble;
  }

  function renderMentionContent(el, content) {
    var mentionRegex = /@\[([^\]]+)\]\(employee:(\d+)\)/g;
    var lastIndex = 0;
    var match;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        var textBefore = document.createTextNode(content.substring(lastIndex, match.index));
        el.appendChild(textBefore);
      }

      var mentionSpan = document.createElement('span');
      mentionSpan.className = 'msg-mention';
      mentionSpan.textContent = '@' + match[1];
      mentionSpan.dataset.employeeId = match[2];
      el.appendChild(mentionSpan);

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      var remaining = document.createTextNode(content.substring(lastIndex));
      el.appendChild(remaining);
    }

    if (!el.firstChild) {
      el.appendChild(document.createTextNode(content));
    }
  }

  // ========== MESSAGE INPUT ==========

  function renderMessageInputEl(channelId) {
    var inputBar = document.createElement('div');
    inputBar.className = 'msg-input-bar';

    var attachBtn = createSvgButton('M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H9.5v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S6.5 2.79 6.5 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6H16.5z', 'msg-attach-btn', 20);
    attachBtn.title = 'Attach file';
    inputBar.appendChild(attachBtn);

    var textarea = document.createElement('textarea');
    textarea.className = 'msg-textarea';
    textarea.placeholder = 'Type a message...';
    textarea.rows = 1;
    inputBar.appendChild(textarea);

    var sendBtn = createSvgButton('M2.01 21L23 12 2.01 3 2 10l15 2-15 2z', 'msg-send-btn', 20);
    sendBtn.title = 'Send';
    inputBar.appendChild(sendBtn);

    var mentionDropdown = document.createElement('div');
    mentionDropdown.className = 'msg-mention-dropdown';
    mentionDropdown.style.display = 'none';
    inputBar.appendChild(mentionDropdown);

    textarea.addEventListener('input', function () {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      sendBtn.classList.toggle('active', textarea.value.trim().length > 0);
      handleMentionTrigger(textarea, mentionDropdown);
    });

    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (textarea.value.trim()) {
          sendMessage(channelId, textarea);
        }
      }
    });

    sendBtn.addEventListener('click', function () {
      if (textarea.value.trim()) {
        sendMessage(channelId, textarea);
      }
    });

    attachBtn.addEventListener('click', function () {
      handleFileAttachment(channelId);
    });

    return inputBar;
  }

  // ========== MENTION HANDLING ==========

  function handleMentionTrigger(textarea, dropdown) {
    var val = textarea.value;
    var cursorPos = textarea.selectionStart;
    var textBeforeCursor = val.substring(0, cursorPos);
    var atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (!atMatch) {
      dropdown.style.display = 'none';
      return;
    }

    var query = atMatch[1].toLowerCase();

    fetchEmployees().then(function (employees) {
      var filtered = employees.filter(function (emp) {
        var full = (emp.first_name + ' ' + emp.last_name).toLowerCase();
        return full.indexOf(query) !== -1 || emp.username.toLowerCase().indexOf(query) !== -1;
      }).slice(0, 8);

      if (filtered.length === 0) {
        dropdown.style.display = 'none';
        return;
      }

      clearEl(dropdown);
      filtered.forEach(function (emp, idx) {
        var item = document.createElement('div');
        item.className = 'msg-mention-item' + (idx === 0 ? ' active' : '');

        var name = document.createElement('span');
        name.className = 'msg-mention-item-name';
        name.textContent = emp.first_name + ' ' + emp.last_name;
        item.appendChild(name);

        var uname = document.createElement('span');
        uname.className = 'msg-mention-item-username';
        uname.textContent = '@' + emp.username;
        item.appendChild(uname);

        item.addEventListener('click', function () {
          insertMention(textarea, atMatch, emp);
          dropdown.style.display = 'none';
        });

        item.addEventListener('mouseenter', function () {
          var active = dropdown.querySelector('.msg-mention-item.active');
          if (active) active.classList.remove('active');
          item.classList.add('active');
        });

        dropdown.appendChild(item);
      });

      dropdown.style.display = '';
    });
  }

  function navigateMentionDropdown(dropdown, direction) {
    var items = dropdown.querySelectorAll('.msg-mention-item');
    if (items.length === 0) return;

    var currentIdx = -1;
    items.forEach(function (it, i) {
      if (it.classList.contains('active')) currentIdx = i;
    });

    var newIdx = currentIdx + direction;
    if (newIdx < 0) newIdx = items.length - 1;
    if (newIdx >= items.length) newIdx = 0;

    items.forEach(function (it) { it.classList.remove('active'); });
    items[newIdx].classList.add('active');
  }

  function insertMention(textarea, atMatch, emp) {
    var val = textarea.value;
    var cursorPos = textarea.selectionStart;
    var beforeAt = val.substring(0, cursorPos - atMatch[0].length);
    var afterCursor = val.substring(cursorPos);
    var mention = '@[' + emp.first_name + ' ' + emp.last_name + '](employee:' + emp.id + ') ';
    textarea.value = beforeAt + mention + afterCursor;
    var newPos = beforeAt.length + mention.length;
    textarea.selectionStart = newPos;
    textarea.selectionEnd = newPos;
    textarea.focus();

    var sendBtn = textarea.parentNode.querySelector('.msg-send-btn');
    if (sendBtn) {
      sendBtn.disabled = !textarea.value.trim();
      sendBtn.classList.toggle('active', !!textarea.value.trim());
    }
  }

  // ========== SEND MESSAGE ==========

  function sendMessage(channelId, textarea, mentionDropdown) {
    var content = textarea.value.trim();
    if (!content) return;

    var mentionRegex = /@\[[^\]]+\]\(employee:(\d+)\)/g;
    var mentions = [];
    var match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(parseInt(match[1], 10));
    }

    textarea.value = '';
    textarea.style.height = 'auto';
    var sendBtn = textarea.parentNode.querySelector('.msg-send-btn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.classList.remove('active');
    }
    if (mentionDropdown) mentionDropdown.style.display = 'none';

    var user = getUser();
    var optimisticMsg = {
      id: Date.now(),
      channel_id: channelId,
      sender_id: user.id,
      sender_first_name: user.firstName,
      sender_last_name: user.lastName,
      sender_photo_url: null,
      content: content,
      created_at: new Date().toISOString(),
      attachments: []
    };

    var container = document.getElementById('msgMessagesContainer');
    if (container) {
      container.appendChild(createMessageBubble(optimisticMsg));
      container.scrollTop = container.scrollHeight;
    }

    apiPost('/channels/' + channelId + '/messages', { content: content, mentions: mentions })
      .then(function (msg) {
        if (msg && msg.id) {
          lastMessageId = Math.max(lastMessageId, msg.id);
        }
        loadConversationList();
      })
      .catch(function () {});
  }

  // ========== FILE ATTACHMENT ==========

  function handleFileAttachment(channelId) {
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', function () {
      if (!fileInput.files || !fileInput.files[0]) {
        document.body.removeChild(fileInput);
        return;
      }

      var file = fileInput.files[0];

      apiPost('/channels/' + channelId + '/messages', { content: '[File: ' + file.name + ']' })
        .then(function (msg) {
          if (!msg || !msg.id) return;

          var formData = new FormData();
          formData.append('file', file);

          return fetch(MSG_API + '/messages/' + msg.id + '/attachments', {
            method: 'POST',
            headers: authHeaders(),
            body: formData
          }).then(function (r) { return r.json(); }).then(function () {
            lastMessageId = Math.max(lastMessageId, msg.id);
            if (activeChannelId === channelId) {
              renderChatView(channelId);
            }
            loadConversationList();
          });
        })
        .catch(function () {})
        .finally(function () {
          if (fileInput.parentNode) {
            document.body.removeChild(fileInput);
          }
        });
    });

    fileInput.click();
  }

  // ========== CHANNEL CREATE MODAL ==========

  function renderChannelCreateModal() {
    var overlay = document.createElement('div');
    overlay.className = 'msg-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'msg-modal';

    var modalTitle = document.createElement('h3');
    modalTitle.className = 'msg-modal-title';
    modalTitle.textContent = 'Create Channel';
    modal.appendChild(modalTitle);

    var emojiRow = document.createElement('div');
    emojiRow.className = 'msg-modal-row';

    var emojiLabel = document.createElement('label');
    emojiLabel.className = 'msg-modal-label';
    emojiLabel.textContent = 'Icon';
    emojiRow.appendChild(emojiLabel);

    var selectedEmoji = { type: null, value: null };

    var emojiBtn = document.createElement('button');
    emojiBtn.className = 'msg-emoji-trigger';
    emojiBtn.textContent = '#';

    emojiBtn.addEventListener('click', function () {
      window.EmojiIconPicker.open(emojiBtn, function (selection) {
        selectedEmoji = selection;
        clearEl(emojiBtn);
        if (selection.type === 'emoji') {
          emojiBtn.textContent = selection.value;
        } else {
          var ic = window.EmojiIconPicker.getIconSvg(selection.value, 20);
          if (ic) {
            emojiBtn.appendChild(ic);
          } else {
            emojiBtn.textContent = '#';
          }
        }
      });
    });
    emojiRow.appendChild(emojiBtn);
    modal.appendChild(emojiRow);

    var nameRow = document.createElement('div');
    nameRow.className = 'msg-modal-row';
    var nameLabel = document.createElement('label');
    nameLabel.className = 'msg-modal-label';
    nameLabel.textContent = 'Channel Name';
    nameRow.appendChild(nameLabel);
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'msg-modal-input';
    nameInput.placeholder = 'e.g. general';
    nameRow.appendChild(nameInput);
    modal.appendChild(nameRow);

    var parentRow = document.createElement('div');
    parentRow.className = 'msg-modal-row';
    var parentLabel = document.createElement('label');
    parentLabel.className = 'msg-modal-label';
    parentLabel.textContent = 'Parent Channel (optional)';
    parentRow.appendChild(parentLabel);
    var parentSelect = document.createElement('select');
    parentSelect.className = 'msg-modal-input';
    var emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'None';
    parentSelect.appendChild(emptyOption);

    channelList.filter(function (c) { return c.type !== 'dm'; }).forEach(function (ch) {
      var opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = ch.name || 'Unnamed';
      parentSelect.appendChild(opt);
    });

    parentRow.appendChild(parentSelect);
    modal.appendChild(parentRow);

    var memberRow = document.createElement('div');
    memberRow.className = 'msg-modal-row';
    var memberLabel = document.createElement('label');
    memberLabel.className = 'msg-modal-label';
    memberLabel.textContent = 'Members';
    memberRow.appendChild(memberLabel);

    var memberSearch = document.createElement('input');
    memberSearch.type = 'text';
    memberSearch.className = 'msg-modal-input';
    memberSearch.placeholder = 'Search employees...';
    memberRow.appendChild(memberSearch);

    var memberList = document.createElement('div');
    memberList.className = 'msg-modal-member-list';
    memberRow.appendChild(memberList);

    modal.appendChild(memberRow);

    var selectedMembers = {};

    function renderMemberList(filter) {
      clearEl(memberList);
      fetchEmployees().then(function (employees) {
        var lf = (filter || '').toLowerCase();
        employees.forEach(function (emp) {
          var full = emp.first_name + ' ' + emp.last_name;
          if (lf && full.toLowerCase().indexOf(lf) === -1 && emp.username.toLowerCase().indexOf(lf) === -1) return;

          var row = document.createElement('label');
          row.className = 'msg-modal-member-row';

          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!selectedMembers[emp.id];
          cb.addEventListener('change', function () {
            if (cb.checked) {
              selectedMembers[emp.id] = true;
            } else {
              delete selectedMembers[emp.id];
            }
          });
          row.appendChild(cb);

          var empName = document.createElement('span');
          empName.textContent = full;
          row.appendChild(empName);

          memberList.appendChild(row);
        });
      });
    }

    renderMemberList('');
    memberSearch.addEventListener('input', function () {
      renderMemberList(memberSearch.value);
    });

    var btnRow = document.createElement('div');
    btnRow.className = 'msg-modal-btns';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'msg-modal-btn msg-modal-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      document.body.removeChild(overlay);
    });
    btnRow.appendChild(cancelBtn);

    var createBtn = document.createElement('button');
    createBtn.className = 'msg-modal-btn msg-modal-btn-create';
    createBtn.textContent = 'Create';
    createBtn.addEventListener('click', function () {
      var name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }

      var body = {
        name: name,
        type: 'channel',
        memberIds: Object.keys(selectedMembers).map(Number)
      };

      if (selectedEmoji.type === 'emoji') {
        body.emoji = selectedEmoji.value;
      } else if (selectedEmoji.type === 'icon') {
        body.icon = selectedEmoji.value;
      }

      if (parentSelect.value) {
        body.parentId = parseInt(parentSelect.value, 10);
      }

      apiPost('/channels', body).then(function () {
        document.body.removeChild(overlay);
        loadConversationList();
      }).catch(function () {
        document.body.removeChild(overlay);
      });
    });
    btnRow.appendChild(createBtn);

    modal.appendChild(btnRow);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    nameInput.focus();
  }

  // ========== DM CREATE MODAL ==========

  function renderDmCreateModal() {
    var overlay = document.createElement('div');
    overlay.className = 'msg-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'msg-modal';

    var modalTitle = document.createElement('h3');
    modalTitle.className = 'msg-modal-title';
    modalTitle.textContent = 'New Direct Message';
    modal.appendChild(modalTitle);

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'msg-modal-input';
    searchInput.placeholder = 'Search people...';
    modal.appendChild(searchInput);

    var personList = document.createElement('div');
    personList.className = 'msg-modal-member-list';
    modal.appendChild(personList);

    function renderPeople(filter) {
      clearEl(personList);
      fetchEmployees().then(function (employees) {
        var user = getUser();
        var lf = (filter || '').toLowerCase();
        employees.forEach(function (emp) {
          if (emp.id === user.id) return;
          var full = emp.first_name + ' ' + emp.last_name;
          if (lf && full.toLowerCase().indexOf(lf) === -1) return;

          var row = document.createElement('button');
          row.className = 'msg-modal-person-row';

          var name = document.createElement('span');
          name.textContent = full;
          row.appendChild(name);

          row.addEventListener('click', function () {
            fetch(MSG_API + '/dm/' + emp.id, { headers: authHeaders() })
              .then(function (r) { return r.json(); })
              .then(function (dm) {
                document.body.removeChild(overlay);
                if (dm && dm.id) {
                  loadConversationList();
                  selectChannel(dm.id);
                }
              });
          });

          personList.appendChild(row);
        });
      });
    }

    renderPeople('');
    searchInput.addEventListener('input', function () {
      renderPeople(searchInput.value);
    });

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'msg-modal-btn msg-modal-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.marginTop = '12px';
    cancelBtn.addEventListener('click', function () {
      document.body.removeChild(overlay);
    });
    modal.appendChild(cancelBtn);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    searchInput.focus();
  }

  // ========== INVITE PEOPLE MODAL ==========

  function renderInviteModal(channelId, currentMemberIds) {
    var overlay = document.createElement('div');
    overlay.className = 'msg-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'msg-modal';

    var title = document.createElement('h3');
    title.className = 'msg-modal-title';
    title.textContent = 'Add People';
    modal.appendChild(title);

    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'msg-modal-input';
    searchInput.placeholder = 'Search people...';
    modal.appendChild(searchInput);

    var memberList = document.createElement('div');
    memberList.className = 'msg-modal-member-list';
    modal.appendChild(memberList);

    var selectedIds = {};

    function renderEmployeeList(filter) {
      clearEl(memberList);
      fetchEmployees().then(function (employees) {
        var lf = (filter || '').toLowerCase();
        var shown = 0;
        employees.forEach(function (emp) {
          if (currentMemberIds.indexOf(emp.id) !== -1) return;
          var full = emp.first_name + ' ' + emp.last_name;
          if (lf && full.toLowerCase().indexOf(lf) === -1 && emp.username.toLowerCase().indexOf(lf) === -1) return;

          var row = document.createElement('label');
          row.className = 'msg-modal-member-row';

          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!selectedIds[emp.id];
          cb.addEventListener('change', function () {
            if (cb.checked) {
              selectedIds[emp.id] = true;
            } else {
              delete selectedIds[emp.id];
            }
          });
          row.appendChild(cb);

          var empName = document.createElement('span');
          empName.textContent = full;
          row.appendChild(empName);

          memberList.appendChild(row);
          shown++;
        });
        if (shown === 0) {
          var empty = document.createElement('div');
          empty.className = 'msg-loading';
          empty.textContent = filter ? 'No matching people found.' : 'No more people to add.';
          memberList.appendChild(empty);
        }
      });
    }

    renderEmployeeList('');
    searchInput.addEventListener('input', function () {
      renderEmployeeList(searchInput.value);
    });

    var btnRow = document.createElement('div');
    btnRow.className = 'msg-modal-btns';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'msg-modal-btn msg-modal-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      document.body.removeChild(overlay);
    });
    btnRow.appendChild(cancelBtn);

    var addBtn = document.createElement('button');
    addBtn.className = 'msg-modal-btn msg-modal-btn-create';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', function () {
      var ids = Object.keys(selectedIds).map(Number);
      if (ids.length === 0) return;
      apiPost('/channels/' + channelId + '/invite', { employeeIds: ids }).then(function () {
        document.body.removeChild(overlay);
        loadConversationList();
        if (activeChannelId === channelId) {
          renderChatView(channelId);
        }
      }).catch(function () {
        document.body.removeChild(overlay);
      });
    });
    btnRow.appendChild(addBtn);

    modal.appendChild(btnRow);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    searchInput.focus();
  }

  // ========== POLLING ==========

  function startMessagePolling(channelId) {
    stopMessagePolling();
    var intervalId = setInterval(function () {
      if (activeChannelId !== channelId) {
        clearInterval(intervalId);
        return;
      }
      if (!lastMessageId) return;

      apiGet('/channels/' + channelId + '/messages?after=' + lastMessageId).then(function (messages) {
        if (!Array.isArray(messages) || messages.length === 0) return;
        var container = document.getElementById('msgMessagesContainer');
        if (!container) return;

        var shouldScroll = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

        messages.forEach(function (msg) {
          if (container.querySelector('[data-message-id="' + msg.id + '"]')) return;
          container.appendChild(createMessageBubble(msg));
          lastMessageId = Math.max(lastMessageId, msg.id);
        });

        if (shouldScroll) {
          container.scrollTop = container.scrollHeight;
        }
      }).catch(function () {});
    }, 5000);

    pollingIntervals.push(intervalId);
  }

  function stopMessagePolling() {
    pollingIntervals.forEach(function (id) { clearInterval(id); });
    pollingIntervals = [];
  }

  function startUnreadPolling() {
    var intervalId = setInterval(function () {
      apiGet('/unread-counts').then(function (counts) {
        if (!Array.isArray(counts)) return;
        var listEl = document.getElementById('msgConvList');
        if (!listEl) return;

        counts.forEach(function (c) {
          var row = listEl.querySelector('[data-channel-id="' + c.channelId + '"]');
          if (!row) return;

          var existing = row.querySelector('.msg-unread-badge');
          if (c.count > 0) {
            if (existing) {
              existing.textContent = String(c.count);
            } else {
              var badge = document.createElement('span');
              badge.className = 'msg-unread-badge';
              badge.textContent = String(c.count);
              var bottomRow = row.querySelector('.msg-conv-bottom');
              if (bottomRow) bottomRow.appendChild(badge);
            }
          } else {
            if (existing) existing.parentNode.removeChild(existing);
          }
        });
      }).catch(function () {});
    }, 15000);

    pollingIntervals.push(intervalId);
  }

  // ========== SIDEBAR ACTIVATION ==========

  var savedMsgNavHTML = null;

  function makeMsgNavSvg(pathD) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  function activateMessagingSidebar() {
    var nav = document.querySelector('#sidebar nav');
    if (!nav) return;

    if (window.expandSidebarIfCollapsed) window.expandSidebarIfCollapsed();

    if (!savedMsgNavHTML) {
      savedMsgNavHTML = nav.cloneNode(true);
    }

    nav.style.transition = 'opacity 0.2s ease';
    nav.style.opacity = '0';

    setTimeout(function () {
      while (nav.firstChild) nav.removeChild(nav.firstChild);

      // Back button
      var backItem = document.createElement('a');
      backItem.className = 'nav-item';
      backItem.tabIndex = 0;
      backItem.style.cursor = 'pointer';
      var backIcon = document.createElement('span');
      backIcon.className = 'nav-icon';
      backIcon.appendChild(makeMsgNavSvg('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'));
      backItem.appendChild(backIcon);
      var backLabel = document.createElement('span');
      backLabel.className = 'nav-label';
      backLabel.textContent = 'Messaging';
      backItem.appendChild(backLabel);
      backItem.addEventListener('click', function () {
        deactivateMessagingSidebar();
        var myViewItem = document.querySelector('.nav-item[data-page="my-view"]');
        if (myViewItem) myViewItem.click();
      });
      nav.appendChild(backItem);

      // Separator
      var sep = document.createElement('div');
      sep.style.height = '1px';
      sep.style.background = 'rgba(0,0,0,0.08)';
      sep.style.margin = '8px 12px';
      nav.appendChild(sep);

      // Filter items: All, Channels, Direct Messages
      var filters = [
        { id: 'all', label: 'All' },
        { id: 'channels', label: 'Channels' },
        { id: 'dms', label: 'Direct Messages' },
        { id: 'clients', label: 'Clients' }
      ];

      filters.forEach(function (f) {
        var item = document.createElement('a');
        item.className = 'nav-item' + (sidebarFilter === f.id ? ' active' : '');
        item.tabIndex = 0;
        item.style.cursor = 'pointer';
        var label = document.createElement('span');
        label.className = 'nav-label';
        label.textContent = f.label;
        item.appendChild(label);
        item.addEventListener('click', function () {
          sidebarFilter = f.id;
          nav.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
          item.classList.add('active');
          renderConversationList('');
        });
        nav.appendChild(item);
      });

      // Separator
      var sep2 = document.createElement('div');
      sep2.style.height = '1px';
      sep2.style.background = 'rgba(0,0,0,0.08)';
      sep2.style.margin = '8px 12px';
      nav.appendChild(sep2);

      // Action items: New Channel, New DM
      var newChItem = document.createElement('a');
      newChItem.className = 'nav-item';
      newChItem.tabIndex = 0;
      newChItem.style.cursor = 'pointer';
      var chIcon = document.createElement('span');
      chIcon.className = 'nav-icon';
      chIcon.appendChild(makeMsgNavSvg('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'));
      newChItem.appendChild(chIcon);
      var chLabel = document.createElement('span');
      chLabel.className = 'nav-label';
      chLabel.textContent = 'New Channel';
      newChItem.appendChild(chLabel);
      newChItem.addEventListener('click', function () {
        renderChannelCreateModal();
      });
      nav.appendChild(newChItem);

      var newDmItem = document.createElement('a');
      newDmItem.className = 'nav-item';
      newDmItem.tabIndex = 0;
      newDmItem.style.cursor = 'pointer';
      var dmIcon = document.createElement('span');
      dmIcon.className = 'nav-icon';
      dmIcon.appendChild(makeMsgNavSvg('M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z'));
      newDmItem.appendChild(dmIcon);
      var dmLabel = document.createElement('span');
      dmLabel.className = 'nav-label';
      dmLabel.textContent = 'New DM';
      newDmItem.appendChild(dmLabel);
      newDmItem.addEventListener('click', function () {
        renderDmCreateModal();
      });
      nav.appendChild(newDmItem);

      nav.style.opacity = '1';
    }, 200);
  }

  function deactivateMessagingSidebar() {
    var nav = document.querySelector('#sidebar nav');
    if (!nav || !savedMsgNavHTML) return;

    nav.style.transition = 'opacity 0.2s ease';
    nav.style.opacity = '0';

    setTimeout(function () {
      while (nav.firstChild) nav.removeChild(nav.firstChild);
      while (savedMsgNavHTML.firstChild) {
        nav.appendChild(savedMsgNavHTML.firstChild);
      }
      savedMsgNavHTML = null;
      nav.style.opacity = '1';

      if (window.restoreSidebarCollapsed) window.restoreSidebarCollapsed();
      if (window.rebindNavItems) window.rebindNavItems();
    }, 200);
  }

  // ========== CLEANUP ==========

  function cleanupMessaging() {
    stopMessagePolling();
    activeChannelId = null;
    lastMessageId = 0;
    sidebarFilter = 'all';
    isMobileChat = false;
    clearTimeout(searchDebounceTimer);

    if (mainContainer) {
      var card = mainContainer.closest('.card');
      if (card) {
        card.style.padding = card.dataset.prevPadding || '';
        card.style.overflow = '';
        delete card.dataset.prevPadding;
      }
    }

    convPane = null;
    chatPane = null;
    mainContainer = null;
  }

  // ========== PUBLIC API ==========

  window.renderMessagingSection = renderMessagingSection;
  window.cleanupMessaging = cleanupMessaging;
  window.activateMessagingSidebar = activateMessagingSidebar;
  window.deactivateMessagingSidebar = deactivateMessagingSidebar;
})();
