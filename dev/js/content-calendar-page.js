(function () {
  'use strict';

  var API_BASE = '/api/dashboards';

  function getHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (window.getAuthHeaders) {
      var auth = window.getAuthHeaders();
      for (var key in auth) {
        if (auth.hasOwnProperty(key)) headers[key] = auth[key];
      }
    }
    return headers;
  }

  function openImageLightbox(filesArray, startIdx) {
    var idx = startIdx;

    var overlay = document.createElement('div');
    overlay.className = 'cc-lightbox-overlay';

    var content = document.createElement('div');
    content.className = 'cc-lightbox-content';

    var media = document.createElement('div');
    media.className = 'cc-lightbox-media';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'cc-lightbox-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function () { overlay.remove(); });

    var prevBtn = document.createElement('button');
    prevBtn.className = 'cc-carousel-arrow cc-carousel-prev cc-lightbox-arrow';
    prevBtn.innerHTML = '&lsaquo;';

    var nextBtn = document.createElement('button');
    nextBtn.className = 'cc-carousel-arrow cc-carousel-next cc-lightbox-arrow';
    nextBtn.innerHTML = '&rsaquo;';

    var counter = document.createElement('span');
    counter.className = 'cc-lightbox-counter';

    function show(i) {
      idx = i;
      media.innerHTML = '';
      var file = filesArray[idx];
      if (file.type.startsWith('video/')) {
        var vid = document.createElement('video');
        vid.src = URL.createObjectURL(file);
        vid.className = 'cc-lightbox-img';
        vid.controls = true;
        vid.autoplay = true;
        vid.muted = true;
        media.appendChild(vid);
      } else {
        var img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = 'cc-lightbox-img';
        media.appendChild(img);
      }
      counter.textContent = (idx + 1) + ' / ' + filesArray.length;
      prevBtn.style.display = idx > 0 ? '' : 'none';
      nextBtn.style.display = idx < filesArray.length - 1 ? '' : 'none';
      counter.style.display = filesArray.length > 1 ? '' : 'none';
    }

    prevBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (idx > 0) show(idx - 1);
    });
    nextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (idx < filesArray.length - 1) show(idx + 1);
    });

    content.appendChild(media);
    content.appendChild(closeBtn);
    content.appendChild(prevBtn);
    content.appendChild(nextBtn);
    content.appendChild(counter);
    overlay.appendChild(content);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    function onKey(e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
      if (e.key === 'ArrowLeft' && idx > 0) show(idx - 1);
      if (e.key === 'ArrowRight' && idx < filesArray.length - 1) show(idx + 1);
    }
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    show(idx);
  }

  function insertFileIntoEditor(editor, file) {
    if (file.type.startsWith('image/')) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'cc-cr-inline-img';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '6px';
        img.style.margin = '4px 0';
        img.style.display = 'block';
        editor.appendChild(img);
        // Add a line break after so user can keep typing
        var br = document.createElement('br');
        editor.appendChild(br);
        editor.focus();
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      var reader2 = new FileReader();
      reader2.onload = function (e) {
        var vid = document.createElement('video');
        vid.src = e.target.result;
        vid.controls = true;
        vid.muted = true;
        vid.className = 'cc-cr-inline-vid';
        vid.style.maxWidth = '100%';
        vid.style.borderRadius = '6px';
        vid.style.margin = '4px 0';
        vid.style.display = 'block';
        editor.appendChild(vid);
        var br = document.createElement('br');
        editor.appendChild(br);
        editor.focus();
      };
      reader2.readAsDataURL(file);
    } else {
      // Non-media file: show as attachment chip
      var chip = document.createElement('span');
      chip.className = 'cc-cr-file-chip';
      chip.textContent = file.name;
      chip.contentEditable = 'false';
      editor.appendChild(chip);
      var space = document.createTextNode(' ');
      editor.appendChild(space);
      editor.focus();
    }
  }

  function openChangesPopup(mediaFiles, changeRequests, changeFiles, drawings, updateCount) {
    // Overlay
    var overlay = document.createElement('div');
    overlay.className = 'cc-popup-overlay';

    var popup = document.createElement('div');
    popup.className = 'cc-popup';

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.className = 'cc-popup-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function () {
      overlay.remove();
    });
    popup.appendChild(closeBtn);

    // Header
    var popupHeader = document.createElement('div');
    popupHeader.className = 'cc-popup-header';
    popupHeader.textContent = 'Change Requests';
    popup.appendChild(popupHeader);

    // Body — left (image) + right (checklist)
    var body = document.createElement('div');
    body.className = 'cc-popup-body';

    // === LEFT: Image preview with drawing ===
    var leftPanel = document.createElement('div');
    leftPanel.className = 'cc-popup-left';

    var currentMediaIdx = 0;

    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'cc-canvas-wrap';

    var imgEl = document.createElement('img');
    imgEl.className = 'cc-popup-img';

    var canvas = document.createElement('canvas');
    canvas.className = 'cc-draw-canvas';

    canvasWrap.appendChild(imgEl);
    canvasWrap.appendChild(canvas);

    // Drawing state
    var isDrawing = false;
    var drawColor = '#e74c3c';
    var drawSize = 3;
    var ctx = canvas.getContext('2d');

    function loadMedia(idx) {
      if (!mediaFiles || mediaFiles.length === 0) {
        imgEl.src = '';
        imgEl.alt = 'No media uploaded';
        canvasWrap.classList.add('cc-no-media');
        return;
      }
      canvasWrap.classList.remove('cc-no-media');
      currentMediaIdx = idx;
      var file = mediaFiles[idx];
      imgEl.src = URL.createObjectURL(file);
      imgEl.onload = function () {
        canvas.width = imgEl.naturalWidth;
        canvas.height = imgEl.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Restore saved drawing
        if (drawings[idx]) {
          var img2 = new Image();
          img2.onload = function () { ctx.drawImage(img2, 0, 0); };
          img2.src = drawings[idx];
        }
      };
      updateMediaNav();
    }

    // Save drawing before switching
    function saveDrawing() {
      if (mediaFiles && mediaFiles.length > 0) {
        drawings[currentMediaIdx] = canvas.toDataURL();
      }
    }

    // Canvas drawing handlers
    canvas.addEventListener('mousedown', function (e) {
      isDrawing = true;
      ctx.beginPath();
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    });
    canvas.addEventListener('mousemove', function (e) {
      if (!isDrawing) return;
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      ctx.lineWidth = drawSize;
      ctx.lineCap = 'round';
      ctx.strokeStyle = drawColor;
      ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
      ctx.stroke();
    });
    canvas.addEventListener('mouseup', function () {
      isDrawing = false;
      saveDrawing();
    });
    canvas.addEventListener('mouseleave', function () {
      if (isDrawing) {
        isDrawing = false;
        saveDrawing();
      }
    });

    // Touch support
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      isDrawing = true;
      ctx.beginPath();
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      var touch = e.touches[0];
      ctx.moveTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      if (!isDrawing) return;
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      var touch = e.touches[0];
      ctx.lineWidth = drawSize;
      ctx.lineCap = 'round';
      ctx.strokeStyle = drawColor;
      ctx.lineTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
      ctx.stroke();
    }, { passive: false });
    canvas.addEventListener('touchend', function () {
      isDrawing = false;
      saveDrawing();
    });

    leftPanel.appendChild(canvasWrap);

    // Drawing toolbar
    var drawToolbar = document.createElement('div');
    drawToolbar.className = 'cc-draw-toolbar';

    var colors = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#ffffff', '#000000'];
    colors.forEach(function (c) {
      var swatch = document.createElement('button');
      swatch.className = 'cc-draw-color' + (c === drawColor ? ' active' : '');
      swatch.style.background = c;
      swatch.addEventListener('click', function () {
        drawColor = c;
        drawToolbar.querySelectorAll('.cc-draw-color').forEach(function (s) { s.classList.remove('active'); });
        swatch.classList.add('active');
      });
      drawToolbar.appendChild(swatch);
    });

    var sizeLabel = document.createElement('span');
    sizeLabel.className = 'cc-draw-size-label';
    sizeLabel.textContent = 'Size:';
    drawToolbar.appendChild(sizeLabel);

    var sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.min = '1';
    sizeSlider.max = '12';
    sizeSlider.value = drawSize;
    sizeSlider.className = 'cc-draw-slider';
    sizeSlider.addEventListener('input', function () {
      drawSize = parseInt(sizeSlider.value, 10);
    });
    drawToolbar.appendChild(sizeSlider);

    var clearBtn2 = document.createElement('button');
    clearBtn2.className = 'cc-draw-clear';
    clearBtn2.textContent = 'Clear';
    clearBtn2.addEventListener('click', function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      delete drawings[currentMediaIdx];
    });
    drawToolbar.appendChild(clearBtn2);

    leftPanel.appendChild(drawToolbar);

    // Media navigation (prev/next)
    var mediaNav = document.createElement('div');
    mediaNav.className = 'cc-media-nav';

    var prevBtn = document.createElement('button');
    prevBtn.className = 'cc-media-nav-btn';
    prevBtn.innerHTML = '&larr;';
    prevBtn.addEventListener('click', function () {
      if (currentMediaIdx > 0) {
        saveDrawing();
        loadMedia(currentMediaIdx - 1);
      }
    });
    mediaNav.appendChild(prevBtn);

    var mediaCounter = document.createElement('span');
    mediaCounter.className = 'cc-media-counter';
    mediaNav.appendChild(mediaCounter);

    var nextBtn = document.createElement('button');
    nextBtn.className = 'cc-media-nav-btn';
    nextBtn.innerHTML = '&rarr;';
    nextBtn.addEventListener('click', function () {
      if (mediaFiles && currentMediaIdx < mediaFiles.length - 1) {
        saveDrawing();
        loadMedia(currentMediaIdx + 1);
      }
    });
    mediaNav.appendChild(nextBtn);

    leftPanel.appendChild(mediaNav);

    function updateMediaNav() {
      if (!mediaFiles || mediaFiles.length === 0) {
        mediaNav.style.display = 'none';
        return;
      }
      mediaNav.style.display = 'flex';
      mediaCounter.textContent = (currentMediaIdx + 1) + ' / ' + mediaFiles.length;
      prevBtn.disabled = currentMediaIdx === 0;
      nextBtn.disabled = currentMediaIdx === mediaFiles.length - 1;
    }

    body.appendChild(leftPanel);

    // === RIGHT: Rich text editor with inline file uploads ===
    var rightPanel = document.createElement('div');
    rightPanel.className = 'cc-popup-right';

    var editorLabel = document.createElement('div');
    editorLabel.className = 'cc-popup-section-title';
    editorLabel.textContent = 'Change Requests';
    rightPanel.appendChild(editorLabel);

    // Toolbar
    var toolbar = document.createElement('div');
    toolbar.className = 'cc-cr-toolbar';

    var toolbarBtns = [
      { label: 'B', cmd: 'bold', title: 'Bold' },
      { label: 'I', cmd: 'italic', title: 'Italic' },
      { label: 'U', cmd: 'underline', title: 'Underline' },
      { label: 'S', cmd: 'strikeThrough', title: 'Strikethrough' },
      { sep: true },
      { label: '&#8226;', cmd: 'insertUnorderedList', title: 'Bullet list' },
      { label: '1.', cmd: 'insertOrderedList', title: 'Numbered list' },
      { sep: true },
      { label: '&#128206;', cmd: 'insertFile', title: 'Insert file' }
    ];

    var crFileInput = document.createElement('input');
    crFileInput.type = 'file';
    crFileInput.multiple = true;
    crFileInput.accept = 'image/*,video/*,.pdf';
    crFileInput.style.display = 'none';

    toolbarBtns.forEach(function (btn) {
      if (btn.sep) {
        var sep = document.createElement('div');
        sep.className = 'cc-cr-toolbar-sep';
        toolbar.appendChild(sep);
        return;
      }
      var b = document.createElement('button');
      b.className = 'cc-toolbar-btn';
      b.innerHTML = btn.label;
      b.title = btn.title;
      b.addEventListener('mousedown', function (e) {
        e.preventDefault(); // preserve selection
        if (btn.cmd === 'insertFile') {
          crFileInput.click();
        } else {
          document.execCommand(btn.cmd, false, null);
        }
      });
      toolbar.appendChild(b);
    });
    rightPanel.appendChild(toolbar);

    // Editable area
    var crEditor = document.createElement('div');
    crEditor.className = 'cc-cr-editor';
    crEditor.contentEditable = 'true';
    crEditor.setAttribute('data-placeholder', 'Describe change requests here...\n\nYou can format text, add lists, and insert images inline.');

    // Restore saved content
    if (changeRequests.length > 0 && changeRequests[0].html) {
      crEditor.innerHTML = changeRequests[0].html;
    }

    // Save on input
    crEditor.addEventListener('input', function () {
      if (changeRequests.length === 0) {
        changeRequests.push({ html: crEditor.innerHTML });
      } else {
        changeRequests[0].html = crEditor.innerHTML;
      }
      updateCount();
    });

    // Handle file insert
    crFileInput.addEventListener('change', function () {
      for (var i = 0; i < crFileInput.files.length; i++) {
        insertFileIntoEditor(crEditor, crFileInput.files[i]);
      }
      crFileInput.value = '';
      // trigger save
      crEditor.dispatchEvent(new Event('input'));
    });

    // Handle paste with images
    crEditor.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          var file = items[i].getAsFile();
          insertFileIntoEditor(crEditor, file);
          crEditor.dispatchEvent(new Event('input'));
          break;
        }
      }
    });

    // Handle drag & drop files into editor
    crEditor.addEventListener('dragover', function (e) {
      e.preventDefault();
    });
    crEditor.addEventListener('drop', function (e) {
      if (e.dataTransfer.files.length > 0) {
        e.preventDefault();
        for (var i = 0; i < e.dataTransfer.files.length; i++) {
          insertFileIntoEditor(crEditor, e.dataTransfer.files[i]);
        }
        crEditor.dispatchEvent(new Event('input'));
      }
    });

    rightPanel.appendChild(crEditor);
    rightPanel.appendChild(crFileInput);

    body.appendChild(rightPanel);
    popup.appendChild(body);
    overlay.appendChild(popup);

    // Close on overlay click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    // Close on Escape
    function onKey(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
      }
    }
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);

    // Load first media
    loadMedia(0);
  }

  function buildChatPanel(clientName, deliverableName) {
    var wrap = document.createElement('div');
    wrap.className = 'cc-chat';
    var channelId = null;
    var currentUserId = null;
    var MSG_API = '/api/messaging';

    // Header
    var header = document.createElement('div');
    header.className = 'cc-chat-header';
    header.innerHTML = '<span class="cc-chat-title">Messages</span>' +
      '<span class="cc-chat-subtitle">' + (clientName || 'Client') + ' - ' + (deliverableName || 'Content Calendar') + '</span>';
    wrap.appendChild(header);

    // Messages area
    var messagesEl = document.createElement('div');
    messagesEl.className = 'cc-chat-messages';
    messagesEl.innerHTML = '<div class="cc-chat-loading">Loading messages...</div>';
    wrap.appendChild(messagesEl);

    // Input area
    var inputArea = document.createElement('div');
    inputArea.className = 'cc-chat-input-area';

    var attachBtn = document.createElement('button');
    attachBtn.className = 'cc-chat-attach-btn';
    attachBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>';
    attachBtn.title = 'Attach file';
    inputArea.appendChild(attachBtn);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'cc-chat-input';
    input.placeholder = 'Type a message...';

    var sendBtn = document.createElement('button');
    sendBtn.className = 'cc-chat-send-btn';
    sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    sendBtn.title = 'Send';

    function getAuthHeaders() {
      var headers = { 'Content-Type': 'application/json' };
      if (window.getAuthHeaders) {
        var auth = window.getAuthHeaders();
        for (var key in auth) {
          if (auth.hasOwnProperty(key)) headers[key] = auth[key];
        }
      }
      return headers;
    }

    function formatTime(iso) {
      if (!iso) return '';
      var d = new Date(iso);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function getInitials(firstName, lastName) {
      return ((firstName || '')[0] || '') + ((lastName || '')[0] || '');
    }

    var avatarColors = ['#4285f4', '#9b59b6', '#1abc9c', '#e67e22', '#e74c3c', '#2ecc71', '#3498db'];
    function colorForId(id) {
      return avatarColors[(id || 0) % avatarColors.length];
    }

    function renderBubble(msg, isSelf) {
      var bubble = document.createElement('div');
      bubble.className = 'cc-chat-bubble' + (isSelf ? ' cc-chat-self' : '');

      if (!isSelf) {
        var avatar = document.createElement('span');
        avatar.className = 'cc-chat-avatar';
        avatar.style.background = colorForId(msg.sender_employee_id || msg.senderEmployeeId);
        avatar.textContent = getInitials(msg.sender_first_name || msg.senderFirstName, msg.sender_last_name || msg.senderLastName);
        bubble.appendChild(avatar);
      }

      var content = document.createElement('div');
      content.className = 'cc-chat-content';

      if (!isSelf) {
        var name = document.createElement('div');
        name.className = 'cc-chat-name';
        name.textContent = (msg.sender_first_name || msg.senderFirstName || '') + ' ' + (msg.sender_last_name || msg.senderLastName || '');
        content.appendChild(name);
      }

      var text = document.createElement('div');
      text.className = 'cc-chat-text';
      text.textContent = msg.content;
      content.appendChild(text);

      var time = document.createElement('div');
      time.className = 'cc-chat-time';
      time.textContent = formatTime(msg.created_at || msg.createdAt);
      content.appendChild(time);

      bubble.appendChild(content);
      return bubble;
    }

    function loadMessages() {
      if (!channelId) return;
      fetch(MSG_API + '/channels/' + channelId + '/messages?limit=50', { headers: getAuthHeaders() })
        .then(function (res) { return res.json(); })
        .then(function (msgs) {
          messagesEl.innerHTML = '';
          if (msgs.length === 0) {
            messagesEl.innerHTML = '<div class="cc-chat-empty">No messages yet. Start the conversation!</div>';
            return;
          }
          // Messages come newest-first, reverse for display
          msgs.reverse().forEach(function (msg) {
            var isSelf = (msg.sender_employee_id || msg.senderEmployeeId) === currentUserId;
            messagesEl.appendChild(renderBubble(msg, isSelf));
          });
          messagesEl.scrollTop = messagesEl.scrollHeight;
        })
        .catch(function () {
          messagesEl.innerHTML = '<div class="cc-chat-empty">Could not load messages</div>';
        });
    }

    function sendMessage() {
      var text = input.value.trim();
      if (!text || !channelId) return;

      // Optimistic UI
      var bubble = document.createElement('div');
      bubble.className = 'cc-chat-bubble cc-chat-self cc-chat-new';
      var content = document.createElement('div');
      content.className = 'cc-chat-content';
      var textEl = document.createElement('div');
      textEl.className = 'cc-chat-text';
      textEl.textContent = text;
      content.appendChild(textEl);
      var time = document.createElement('div');
      time.className = 'cc-chat-time';
      time.textContent = formatTime(new Date().toISOString());
      content.appendChild(time);
      bubble.appendChild(content);
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      var msgText = text;
      input.value = '';
      input.focus();

      // Send to API
      fetch(MSG_API + '/channels/' + channelId + '/messages', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: msgText })
      }).catch(function () {
        bubble.style.opacity = '0.5';
      });
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendMessage();
    });

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);
    wrap.appendChild(inputArea);

    // Find or create the client channel for this deliverable
    var channelName = (clientName || 'Client') + ' - ' + (deliverableName || 'Content Calendar');

    fetch(MSG_API + '/channels', { headers: getAuthHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (channels) {
        // Try to get current user ID from the response
        if (channels.length > 0 && channels[0].members) {
          // Not available here, we'll get it from a message
        }

        // Find existing client channel with this name
        var existing = channels.find(function (c) {
          return c.type === 'client' && c.name === channelName;
        });

        if (existing) {
          channelId = existing.id;
          loadMessages();
        } else {
          // Create the client channel
          fetch(MSG_API + '/channels', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              name: channelName,
              type: 'client',
              description: 'Messages for ' + channelName
            })
          })
            .then(function (res) { return res.json(); })
            .then(function (ch) {
              channelId = ch.id;
              messagesEl.innerHTML = '<div class="cc-chat-empty">No messages yet. Start the conversation!</div>';
            })
            .catch(function () {
              messagesEl.innerHTML = '<div class="cc-chat-empty">Could not create message channel</div>';
            });
        }
      })
      .catch(function () {
        messagesEl.innerHTML = '<div class="cc-chat-empty">Could not connect to messaging</div>';
      });

    // Try to get current user ID
    fetch('/api/employees/me', { headers: getAuthHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (user) { currentUserId = user.id; })
      .catch(function () {});

    return wrap;
  }

  function buildActivityTimeline() {
    var wrap = document.createElement('div');
    wrap.className = 'cc-timeline';

    var title = document.createElement('div');
    title.className = 'cc-timeline-title';
    title.textContent = 'Activity Timeline';
    wrap.appendChild(title);

    var sampleEvents = [
      {
        initials: 'JS', color: '#4285f4',
        dot: '#2ecc71',
        category: 'Content Calendar', client: 'ProAgri (Pty) Ltd',
        action: 'Caption updated',
        tags: [{ text: 'Draft', color: '#e67e22' }, { text: 'Review', color: '#3498db' }],
        user: 'Jane Smith', date: 'Mar 4, 2026, 12:30 PM'
      },
      {
        initials: 'SF', color: '#9b59b6',
        dot: '#3498db',
        category: 'Content Calendar', client: 'Veld & Vlei Co.',
        action: 'Sandra Fourie assigned Mark van der Berg',
        user: 'Sandra Fourie', date: 'Mar 3, 2026, 04:00 PM'
      },
      {
        initials: 'PL', color: '#1abc9c',
        dot: '#9b59b6',
        category: 'Content Calendar', client: 'Graan SA',
        action: 'New images uploaded (3 files)',
        user: 'Pieter Louw', date: 'Mar 3, 2026, 01:20 PM'
      },
      {
        initials: 'JS', color: '#4285f4',
        dot: '#e74c3c',
        category: 'Content Calendar', client: 'Boerdery Direct',
        action: 'Change request added',
        user: 'Jane Smith', date: 'Mar 2, 2026, 06:45 PM'
      },
      {
        initials: 'MV', color: '#e67e22',
        dot: '#2ecc71',
        category: 'Content Calendar', client: 'AgriMark',
        action: 'Row approved',
        user: 'Mark van der Berg', date: 'Mar 2, 2026, 03:10 PM'
      }
    ];

    var list = document.createElement('div');
    list.className = 'cc-timeline-list';

    sampleEvents.forEach(function (evt, idx) {
      var item = document.createElement('div');
      item.className = 'cc-timeline-item';
      item.style.animationDelay = (idx * 0.08) + 's';

      // Dot + line
      var dotCol = document.createElement('div');
      dotCol.className = 'cc-timeline-dot-col';

      var dot = document.createElement('span');
      dot.className = 'cc-timeline-dot';
      dot.style.background = evt.dot;
      dotCol.appendChild(dot);

      if (idx < sampleEvents.length - 1) {
        var line = document.createElement('span');
        line.className = 'cc-timeline-line';
        dotCol.appendChild(line);
      }

      item.appendChild(dotCol);

      // Avatar
      var avatar = document.createElement('span');
      avatar.className = 'cc-timeline-avatar';
      avatar.style.background = evt.color;
      avatar.textContent = evt.initials;
      item.appendChild(avatar);

      // Content
      var content = document.createElement('div');
      content.className = 'cc-timeline-content';

      // Top row: category + client
      var topRow = document.createElement('div');
      topRow.className = 'cc-timeline-top';
      var cat = document.createElement('span');
      cat.className = 'cc-timeline-category';
      cat.textContent = evt.category;
      topRow.appendChild(cat);
      var client = document.createElement('span');
      client.className = 'cc-timeline-client';
      client.textContent = evt.client;
      topRow.appendChild(client);
      content.appendChild(topRow);

      // Action
      var actionRow = document.createElement('div');
      actionRow.className = 'cc-timeline-action';

      if (evt.tags) {
        evt.tags.forEach(function (tag, i) {
          var tagEl = document.createElement('span');
          tagEl.className = 'cc-timeline-tag';
          tagEl.style.color = tag.color;
          tagEl.style.border = '1px solid ' + tag.color;
          tagEl.textContent = tag.text;
          actionRow.appendChild(tagEl);
          if (i < evt.tags.length - 1) {
            var arrow = document.createElement('span');
            arrow.className = 'cc-timeline-arrow';
            arrow.textContent = '\u2192';
            actionRow.appendChild(arrow);
          }
        });
      } else {
        actionRow.textContent = evt.action;
      }
      content.appendChild(actionRow);

      // Footer: user + date
      var footer = document.createElement('div');
      footer.className = 'cc-timeline-footer';
      var userName = document.createElement('span');
      userName.className = 'cc-timeline-user';
      userName.textContent = evt.user;
      footer.appendChild(userName);
      var dateEl = document.createElement('span');
      dateEl.className = 'cc-timeline-date';
      dateEl.textContent = evt.date;
      footer.appendChild(dateEl);
      content.appendChild(footer);

      item.appendChild(content);
      list.appendChild(item);
    });

    wrap.appendChild(list);
    return wrap;
  }

  var teamMembers = [
    { name: 'Jane Smith', initials: 'JS', color: '#4285f4', role: 'Content Manager', email: 'jane@proagri.co.za', phone: '+27 82 123 4567' },
    { name: 'Sandra Fourie', initials: 'SF', color: '#9b59b6', role: 'Designer', email: 'sandra@proagri.co.za', phone: '+27 83 234 5678' },
    { name: 'Pieter Louw', initials: 'PL', color: '#1abc9c', role: 'Copywriter', email: 'pieter@proagri.co.za', phone: '+27 84 345 6789' },
    { name: 'Mark van der Berg', initials: 'MV', color: '#e67e22', role: 'Account Manager', email: 'mark@proagri.co.za', phone: '+27 85 456 7890' }
  ];

  function buildClientHeader() {
    var header = document.createElement('div');
    header.className = 'cc-client-header';

    // Left side: client name
    var left = document.createElement('div');
    left.className = 'cc-client-header-left';

    var clientName = document.createElement('span');
    clientName.className = 'cc-client-name';
    clientName.textContent = 'Client Name';
    left.appendChild(clientName);

    header.appendChild(left);

    // Right side: team avatars + group message
    var right = document.createElement('div');
    right.className = 'cc-header-right';

    // Group message button
    var groupBtn = document.createElement('button');
    groupBtn.className = 'cc-group-msg-btn';
    groupBtn.title = 'Message entire team';
    groupBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-left:2px"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>';
    right.appendChild(groupBtn);

    // Avatar stack
    var avatarStack = document.createElement('div');
    avatarStack.className = 'cc-avatar-stack';

    teamMembers.forEach(function (member) {
      var avatarWrap = document.createElement('div');
      avatarWrap.className = 'cc-avatar-wrap';

      var avatar = document.createElement('div');
      avatar.className = 'cc-team-avatar';
      avatar.style.background = member.color;
      avatar.textContent = member.initials;
      avatarWrap.appendChild(avatar);

      // Popup
      var popup = document.createElement('div');
      popup.className = 'cc-avatar-popup';

      popup.innerHTML =
        '<div class="cc-popup-member-header">' +
          '<div class="cc-popup-member-avatar" style="background:' + member.color + '">' + member.initials + '</div>' +
          '<div class="cc-popup-member-info">' +
            '<div class="cc-popup-member-name">' + member.name + '</div>' +
            '<div class="cc-popup-member-role">' + member.role + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="cc-popup-member-details">' +
          '<div class="cc-popup-detail-row">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>' +
            '<span>' + member.email + '</span>' +
          '</div>' +
          '<div class="cc-popup-detail-row">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>' +
            '<span>' + member.phone + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="cc-popup-actions">' +
          '<button class="cc-popup-action-btn cc-popup-dm" title="Direct message">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>' +
            '<span>DM</span>' +
          '</button>' +
          '<button class="cc-popup-action-btn cc-popup-email" title="Send email">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>' +
            '<span>Email</span>' +
          '</button>' +
          '<button class="cc-popup-action-btn cc-popup-call" title="Call">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>' +
            '<span>Call</span>' +
          '</button>' +
        '</div>';

      avatarWrap.appendChild(popup);
      avatarStack.appendChild(avatarWrap);
    });

    right.appendChild(avatarStack);
    header.appendChild(right);

    return header;
  }

  function buildCalendarTable() {
    var card = document.createElement('div');
    card.className = 'cc-table-card';

    var table = document.createElement('table');
    table.className = 'cc-table';

    // Table header
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    ['Date', 'Caption', 'File Upload', 'Change Requests', ''].forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body with sample rows
    var tbody = document.createElement('tbody');
    for (var i = 0; i < 5; i++) {
      tbody.appendChild(buildTableRow());
    }
    table.appendChild(tbody);

    card.appendChild(table);

    // Add row button
    var addRowWrap = document.createElement('div');
    addRowWrap.className = 'cc-add-row-wrap';
    var addBtn = document.createElement('button');
    addBtn.className = 'cc-add-row-btn';
    addBtn.textContent = '+ Add Row';
    addBtn.addEventListener('click', function () {
      tbody.appendChild(buildTableRow());
    });
    addRowWrap.appendChild(addBtn);
    card.appendChild(addRowWrap);

    return card;
  }

  function buildTableRow() {
    var tr = document.createElement('tr');

    // Date cell
    var tdDate = document.createElement('td');
    var dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'cc-input cc-date-input';
    tdDate.appendChild(dateInput);
    tr.appendChild(tdDate);

    // Caption cell (rich text)
    var tdCaption = document.createElement('td');
    var captionEditor = document.createElement('div');
    captionEditor.className = 'cc-caption-editor';

    var toolbar = document.createElement('div');
    toolbar.className = 'cc-editor-toolbar';
    var buttons = [
      { label: 'B', cmd: 'bold', title: 'Bold' },
      { label: 'I', cmd: 'italic', title: 'Italic' },
      { label: 'U', cmd: 'underline', title: 'Underline' },
      { label: '🔗', cmd: 'createLink', title: 'Link' }
    ];
    buttons.forEach(function (btn) {
      var b = document.createElement('button');
      b.className = 'cc-toolbar-btn';
      b.innerHTML = btn.label;
      b.title = btn.title;
      b.addEventListener('click', function (e) {
        e.preventDefault();
        if (btn.cmd === 'createLink') {
          var url = prompt('Enter URL:');
          if (url) document.execCommand(btn.cmd, false, url);
        } else {
          document.execCommand(btn.cmd, false, null);
        }
      });
      toolbar.appendChild(b);
    });
    captionEditor.appendChild(toolbar);

    var editable = document.createElement('div');
    editable.className = 'cc-editable';
    editable.contentEditable = 'true';
    editable.setAttribute('data-placeholder', 'Write caption...');
    captionEditor.appendChild(editable);

    tdCaption.appendChild(captionEditor);
    tr.appendChild(tdCaption);

    // File upload cell
    var tdFile = document.createElement('td');
    var fileWrap = document.createElement('div');
    fileWrap.className = 'cc-file-wrap';

    // Drop zone
    var dropZone = document.createElement('div');
    dropZone.className = 'cc-drop-zone';

    var dropLabel = document.createElement('label');
    dropLabel.className = 'cc-drop-label';
    dropLabel.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>' +
      '<span>Drop or click to upload</span>';

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.className = 'cc-file-input';
    fileInput.accept = 'image/*,video/*';
    fileInput.multiple = true;
    dropLabel.appendChild(fileInput);
    dropZone.appendChild(dropLabel);
    fileWrap.appendChild(dropZone);

    // Thumbnail grid
    var thumbGrid = document.createElement('div');
    thumbGrid.className = 'cc-thumb-grid';
    fileWrap.appendChild(thumbGrid);

    var filesArray = [];
    var isInternalDrag = false;

    function addFiles(newFiles) {
      for (var i = 0; i < newFiles.length; i++) {
        filesArray.push(newFiles[i]);
      }
      renderPreviews();
    }

    function renderPreviews() {
      thumbGrid.innerHTML = '';

      if (filesArray.length === 0) {
        dropLabel.classList.remove('cc-drop-label-compact');
        thumbGrid.style.display = 'none';
        return;
      }

      dropLabel.classList.add('cc-drop-label-compact');
      thumbGrid.style.display = 'grid';

      filesArray.forEach(function (file, idx) {
        var thumb = document.createElement('div');
        thumb.className = 'cc-thumb';
        thumb.draggable = true;
        thumb.dataset.idx = idx;

        if (file.type.startsWith('image/')) {
          var img = document.createElement('img');
          img.src = URL.createObjectURL(file);
          img.className = 'cc-thumb-img';
          thumb.appendChild(img);
        } else if (file.type.startsWith('video/')) {
          var vid = document.createElement('video');
          vid.src = URL.createObjectURL(file);
          vid.className = 'cc-thumb-img';
          vid.muted = true;
          thumb.appendChild(vid);
          var badge = document.createElement('span');
          badge.className = 'cc-thumb-badge';
          badge.textContent = 'VIDEO';
          thumb.appendChild(badge);
        }

        var removeBtn = document.createElement('button');
        removeBtn.className = 'cc-thumb-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          filesArray.splice(idx, 1);
          renderPreviews();
        });
        thumb.appendChild(removeBtn);

        var orderLabel = document.createElement('span');
        orderLabel.className = 'cc-thumb-order';
        orderLabel.textContent = idx + 1;
        thumb.appendChild(orderLabel);

        // Drag to reorder
        thumb.addEventListener('dragstart', function (e) {
          isInternalDrag = true;
          e.dataTransfer.setData('text/plain', idx);
          thumb.classList.add('cc-dragging');
        });
        thumb.addEventListener('dragend', function () {
          isInternalDrag = false;
          thumb.classList.remove('cc-dragging');
        });
        thumb.addEventListener('dragover', function (e) {
          e.preventDefault();
          thumb.classList.add('cc-drag-over');
        });
        thumb.addEventListener('dragleave', function () {
          thumb.classList.remove('cc-drag-over');
        });
        thumb.addEventListener('drop', function (e) {
          e.preventDefault();
          thumb.classList.remove('cc-drag-over');
          var fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
          var toIdx = idx;
          if (fromIdx === toIdx) return;
          var moved = filesArray.splice(fromIdx, 1)[0];
          filesArray.splice(toIdx, 0, moved);
          renderPreviews();
        });

        thumb.addEventListener('dblclick', function () {
          openImageLightbox(filesArray, idx);
        });

        thumbGrid.appendChild(thumb);
      });
    }

    fileInput.addEventListener('change', function () {
      if (fileInput.files.length > 0) addFiles(fileInput.files);
      fileInput.value = '';
    });

    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('cc-drop-active');
    });
    dropZone.addEventListener('dragleave', function (e) {
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('cc-drop-active');
      }
    });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('cc-drop-active');
      if (isInternalDrag) return;
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    });

    thumbGrid.style.display = 'none';
    tdFile.appendChild(fileWrap);
    tr.appendChild(tdFile);

    // Change requests cell — button that opens popup
    var tdChanges = document.createElement('td');
    var changeRequests = [];
    var changeFiles = [];
    var drawings = {};

    var openBtn = document.createElement('button');
    openBtn.className = 'cc-changes-btn';
    openBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>' +
      '<span>Change Requests</span>' +
      '<span class="cc-changes-count">0</span>';

    function updateCount() {
      var count = openBtn.querySelector('.cc-changes-count');
      var hasContent = changeRequests.length > 0 && changeRequests[0].html && changeRequests[0].html.replace(/<br\s*\/?>/gi, '').trim().length > 0;
      count.textContent = hasContent ? '1' : '0';
      count.style.display = hasContent ? '' : 'none';
    }
    updateCount();

    openBtn.addEventListener('click', function () {
      openChangesPopup(filesArray, changeRequests, changeFiles, drawings, updateCount);
    });

    tdChanges.appendChild(openBtn);
    tr.appendChild(tdChanges);

    // Delete row cell
    var tdDelete = document.createElement('td');
    tdDelete.className = 'cc-delete-cell';
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'cc-delete-row-btn';
    deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    deleteBtn.title = 'Delete row';
    deleteBtn.addEventListener('click', function () {
      tr.remove();
    });
    tdDelete.appendChild(deleteBtn);
    tr.appendChild(tdDelete);

    return tr;
  }

  function renderContentCalendarPage(container, dashboardTitle) {
    var title = dashboardTitle || 'Content Calendar';

    container.style.display = 'block';
    container.style.height = 'auto';
    container.style.padding = '0';
    container.style.alignItems = '';
    container.style.justifyContent = '';
    container.style.gap = '';

    // Show content calendar sub-menu in sidebar
    if (window.showContentCalendarMenu) {
      window.showContentCalendarMenu('Client Name');
    }

    var page = document.createElement('div');
    page.className = 'content-calendar-page';

    page.appendChild(buildClientHeader());
    page.appendChild(buildCalendarTable());

    // Two-column bottom row
    var bottomRow = document.createElement('div');
    bottomRow.className = 'cc-middle-row';

    var leftCard = document.createElement('div');
    leftCard.className = 'cc-middle-card cc-timeline-card';
    leftCard.appendChild(buildActivityTimeline());
    bottomRow.appendChild(leftCard);

    var rightCard = document.createElement('div');
    rightCard.className = 'cc-middle-card cc-chat-card';
    rightCard.appendChild(buildChatPanel('Client Name', title));
    bottomRow.appendChild(rightCard);

    page.appendChild(bottomRow);

    container.appendChild(page);
  }

  window.renderContentCalendarPage = renderContentCalendarPage;
})();
