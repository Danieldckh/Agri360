/* Emoji/Icon Picker Component */
(function () {
  var pickerEl = null;
  var currentCallback = null;
  var outsideClickHandler = null;

  var EMOJI_CATEGORIES = [
    {
      name: 'Smileys',
      items: [
        '\u{1F600}', '\u{1F603}', '\u{1F604}', '\u{1F601}', '\u{1F605}', '\u{1F602}',
        '\u{1F60A}', '\u{1F607}', '\u{1F609}', '\u{1F60D}', '\u{1F618}', '\u{1F61C}',
        '\u{1F914}', '\u{1F60E}', '\u{1F644}', '\u{1F612}', '\u{1F622}', '\u{1F62D}',
        '\u{1F621}', '\u{1F4AA}', '\u{1F44D}', '\u{1F44E}', '\u{1F44B}', '\u{1F64F}'
      ]
    },
    {
      name: 'Nature & Agriculture',
      items: [
        '\u{1F33E}', '\u{1F33F}', '\u{1F340}', '\u{1F331}', '\u{1F332}', '\u{1F333}',
        '\u{1F334}', '\u{1F335}', '\u{1F337}', '\u{1F33B}', '\u{1F33A}', '\u{1F339}',
        '\u{1F341}', '\u{1F342}', '\u{1F343}', '\u{2600}', '\u{1F324}', '\u{26C5}',
        '\u{1F327}', '\u{26A1}', '\u{2744}', '\u{1F40E}', '\u{1F404}', '\u{1F413}'
      ]
    },
    {
      name: 'Food',
      items: [
        '\u{1F34E}', '\u{1F34A}', '\u{1F34B}', '\u{1F34C}', '\u{1F347}', '\u{1F353}',
        '\u{1F349}', '\u{1F351}', '\u{1F352}', '\u{1F33D}', '\u{1F955}', '\u{1F954}',
        '\u{1F345}', '\u{1F966}', '\u{1F35E}', '\u{1F372}', '\u{1F37D}', '\u{2615}'
      ]
    },
    {
      name: 'Objects',
      items: [
        '\u{1F4AC}', '\u{1F4E7}', '\u{1F4CB}', '\u{1F4C1}', '\u{1F4CA}', '\u{1F4C5}',
        '\u{1F514}', '\u{2699}', '\u{1F527}', '\u{1F4A1}', '\u{1F3AF}', '\u{1F680}',
        '\u{1F6DC}', '\u{1F3E0}', '\u{1F69C}', '\u{1F4E6}', '\u{1F4BB}', '\u{1F4F1}'
      ]
    },
    {
      name: 'Symbols',
      items: [
        '\u{2705}', '\u{274C}', '\u{2757}', '\u{2753}', '\u{1F4A5}', '\u{2B50}',
        '\u{1F525}', '\u{2764}', '\u{1F49A}', '\u{1F499}', '\u{1F7E2}', '\u{1F7E0}',
        '\u{1F534}', '\u{1F535}', '\u{26A0}', '\u{267B}', '\u{1F3C6}', '\u{1F389}'
      ]
    }
  ];

  var ICONS = [
    { id: 'chat', label: 'Chat', path: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z' },
    { id: 'group', label: 'Group', path: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
    { id: 'star', label: 'Star', path: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' },
    { id: 'folder', label: 'Folder', path: 'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z' },
    { id: 'chart', label: 'Chart', path: 'M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z' },
    { id: 'leaf', label: 'Leaf', path: 'M17.73 6.02C15.38 3.67 11.69 2.25 6.75 2c-.18.55-.34 1.23-.43 2.04C5.65 9.36 8.32 14.08 12.86 17.19c.68-.4 1.35-.86 2-1.38C18.62 12.6 19.93 8.22 17.73 6.02zM5.03 13.34C4.36 15.42 4 17.5 4 19c0 .84.04 1.55.13 2.05.32-.06.66-.14 1.02-.24 2.42-.69 5.3-2.25 7.49-4.46C8.62 14.72 6.2 13.72 5.03 13.34z' },
    { id: 'sun', label: 'Sun', path: 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z' },
    { id: 'tractor', label: 'Tractor', path: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h1.17C7.6 15.16 9.6 17 12 17s4.4-1.84 4.83-4H19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-7 10c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z' },
    { id: 'wheat', label: 'Wheat', path: 'M11 2C9.9 2 9 2.9 9 4v2.59L5.21 10.38c-.37.36-.21.62.35.62H7v2H5.56c-.56 0-.72.26-.35.62L9 17.41V20c0 1.1.9 2 2 2s2-.9 2-2v-2.59l3.79-3.79c.37-.36.21-.62-.35-.62H15v-2h1.44c.56 0 .72-.26.35-.62L13 6.59V4c0-1.1-.9-2-2-2z' },
    { id: 'megaphone', label: 'Megaphone', path: 'M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1l5 6V3L5 9H4z' },
    { id: 'calendar', label: 'Calendar', path: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z' },
    { id: 'settings', label: 'Settings', path: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z' },
    { id: 'bell', label: 'Bell', path: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z' },
    { id: 'inbox', label: 'Inbox', path: 'M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z' },
    { id: 'send', label: 'Send', path: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' },
    { id: 'archive', label: 'Archive', path: 'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5z' },
    { id: 'file', label: 'File', path: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z' },
    { id: 'link', label: 'Link', path: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z' },
    { id: 'check', label: 'Check', path: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' },
    { id: 'flag', label: 'Flag', path: 'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z' },
    { id: 'lightning', label: 'Lightning', path: 'M7 2v11h3v9l7-12h-4l4-8z' },
    { id: 'pin', label: 'Pin', path: 'M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z' },
    { id: 'shield', label: 'Shield', path: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z' },
    { id: 'cloud', label: 'Cloud', path: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z' },
    { id: 'truck', label: 'Truck', path: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' },
    { id: 'home', label: 'Home', path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
    { id: 'person', label: 'Person', path: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
    { id: 'target', label: 'Target', path: 'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z' },
    { id: 'water', label: 'Water', path: 'M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z' },
    { id: 'tools', label: 'Tools', path: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z' },
    { id: 'sprout', label: 'Sprout', path: 'M15.5 9.63c-.16-3.04-2.65-5.49-5.72-5.63.23 2.85 2.28 5.26 4.97 5.96C14.27 11.18 13.19 12 12 12c-1.79 0-3.37.85-4.38 2.17C6.08 12.83 4.07 11.53 2 11c0 5.52 4.48 10 10 10 5.52 0 10-4.48 10-10-2.07.53-4.08 1.83-5.62 3.17-.01-.87-.1-1.72-.27-2.54 2.1-.94 3.89-2.6 4.89-4.63-1.97.03-3.85.57-5.5 1.63z' },
    { id: 'bag', label: 'Bag', path: 'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h12v12z' },
    { id: 'globe', label: 'Globe', path: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z' },
    { id: 'rain', label: 'Rain', path: 'M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm1 17.47c-.58.14-1.17.23-1.77.23-3.58 0-6.23-2.59-6.23-6.1 0-.55.05-1.1.15-1.66.09-.49.53-.84 1.03-.84.66 0 1.13.63.97 1.27-.09.37-.14.75-.14 1.13 0 2.87 2.1 4.9 4.87 5.17.48.05.83.47.71.94-.1.39-.39.76-.59.86z' },
    { id: 'education', label: 'Education', path: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z' },
    { id: 'money', label: 'Money', path: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z' }
  ];

  function createSvgIcon(iconDef, size) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(size || 20));
    svg.setAttribute('height', String(size || 20));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', iconDef.path);
    svg.appendChild(p);
    return svg;
  }

  function buildPicker(onSelect) {
    var container = document.createElement('div');
    container.className = 'emoji-picker-container';

    // Search
    var searchWrap = document.createElement('div');
    searchWrap.className = 'emoji-picker-search';
    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search...';
    searchInput.className = 'emoji-picker-search-input';
    searchWrap.appendChild(searchInput);
    container.appendChild(searchWrap);

    // Tabs
    var tabBar = document.createElement('div');
    tabBar.className = 'emoji-picker-tabs';
    var emojiTab = document.createElement('button');
    emojiTab.className = 'emoji-picker-tab active';
    emojiTab.textContent = 'Emoji';
    var iconTab = document.createElement('button');
    iconTab.className = 'emoji-picker-tab';
    iconTab.textContent = 'Icons';
    tabBar.appendChild(emojiTab);
    tabBar.appendChild(iconTab);
    container.appendChild(tabBar);

    // Content area
    var content = document.createElement('div');
    content.className = 'emoji-picker-content';
    container.appendChild(content);

    var activeTab = 'emoji';

    function renderEmojis(filter) {
      while (content.firstChild) content.removeChild(content.firstChild);
      var lowerFilter = (filter || '').toLowerCase();

      EMOJI_CATEGORIES.forEach(function (cat) {
        var items = cat.items;
        if (lowerFilter) {
          if (cat.name.toLowerCase().indexOf(lowerFilter) === -1) {
            items = [];
          }
        }
        if (items.length === 0) return;

        var catLabel = document.createElement('div');
        catLabel.className = 'emoji-picker-cat';
        catLabel.textContent = cat.name;
        content.appendChild(catLabel);

        var grid = document.createElement('div');
        grid.className = 'emoji-picker-grid';

        items.forEach(function (em) {
          var cell = document.createElement('button');
          cell.className = 'emoji-picker-cell';
          cell.textContent = em;
          cell.addEventListener('click', function () {
            onSelect({ type: 'emoji', value: em });
            closePicker();
          });
          grid.appendChild(cell);
        });

        content.appendChild(grid);
      });

      if (!content.firstChild) {
        var empty = document.createElement('div');
        empty.className = 'emoji-picker-empty';
        empty.textContent = 'No results';
        content.appendChild(empty);
      }
    }

    function renderIcons(filter) {
      while (content.firstChild) content.removeChild(content.firstChild);
      var lowerFilter = (filter || '').toLowerCase();

      var grid = document.createElement('div');
      grid.className = 'emoji-picker-grid emoji-picker-grid-icons';

      var filtered = ICONS;
      if (lowerFilter) {
        filtered = ICONS.filter(function (ic) {
          return ic.id.toLowerCase().indexOf(lowerFilter) !== -1 ||
                 ic.label.toLowerCase().indexOf(lowerFilter) !== -1;
        });
      }

      filtered.forEach(function (ic) {
        var cell = document.createElement('button');
        cell.className = 'emoji-picker-cell emoji-picker-icon-cell';
        cell.title = ic.label;
        cell.appendChild(createSvgIcon(ic, 20));
        cell.addEventListener('click', function () {
          onSelect({ type: 'icon', value: ic.id });
          closePicker();
        });
        grid.appendChild(cell);
      });

      content.appendChild(grid);

      if (filtered.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'emoji-picker-empty';
        empty.textContent = 'No results';
        content.appendChild(empty);
      }
    }

    function renderContent() {
      var filter = searchInput.value;
      if (activeTab === 'emoji') {
        renderEmojis(filter);
      } else {
        renderIcons(filter);
      }
    }

    emojiTab.addEventListener('click', function () {
      activeTab = 'emoji';
      emojiTab.classList.add('active');
      iconTab.classList.remove('active');
      renderContent();
    });

    iconTab.addEventListener('click', function () {
      activeTab = 'icon';
      iconTab.classList.add('active');
      emojiTab.classList.remove('active');
      renderContent();
    });

    searchInput.addEventListener('input', function () {
      renderContent();
    });

    renderContent();
    return container;
  }

  function closePicker() {
    if (pickerEl && pickerEl.parentNode) {
      pickerEl.parentNode.removeChild(pickerEl);
    }
    pickerEl = null;
    currentCallback = null;
    if (outsideClickHandler) {
      document.removeEventListener('mousedown', outsideClickHandler);
      outsideClickHandler = null;
    }
  }

  function openPicker(triggerEl, onSelect) {
    closePicker();
    currentCallback = onSelect;

    pickerEl = buildPicker(onSelect);

    document.body.appendChild(pickerEl);

    // Position relative to trigger
    var rect = triggerEl.getBoundingClientRect();
    var pickerHeight = 340;
    var spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow >= pickerHeight + 8) {
      pickerEl.style.top = (rect.bottom + 4) + 'px';
    } else {
      pickerEl.style.top = (rect.top - pickerHeight - 4) + 'px';
    }
    pickerEl.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 300)) + 'px';

    outsideClickHandler = function (e) {
      if (pickerEl && !pickerEl.contains(e.target) && e.target !== triggerEl) {
        closePicker();
      }
    };
    setTimeout(function () {
      document.addEventListener('mousedown', outsideClickHandler);
    }, 0);
  }

  window.EmojiIconPicker = {
    open: openPicker,
    close: closePicker,
    getIconSvg: function (iconId, size) {
      var found = ICONS.filter(function (ic) { return ic.id === iconId; })[0];
      if (!found) return null;
      return createSvgIcon(found, size);
    }
  };
})();
