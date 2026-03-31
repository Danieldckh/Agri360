(function () {
  'use strict';

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

  function initComponentsPage(container) {
    // Build avatar circles
    var avatarPreview = container.querySelector('#avatar-preview');
    if (avatarPreview) {
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
    }

    // Build card avatar SVG
    var cardAvatar = container.querySelector('#card-avatar');
    if (cardAvatar) {
      cardAvatar.appendChild(createAvatarSvg(40));
    }
  }

  window.renderComponentsPage = function (container) {
    window.insertTemplate(container, 'pages/components.html', initComponentsPage);
  };
})();
