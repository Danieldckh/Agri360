var API_URL = 'http://localhost:3001/api';

function getAuthHeaders() {
  var token = localStorage.getItem('token');
  if (token) {
    return { 'Authorization': 'Bearer ' + token };
  }
  return {};
}

function getCurrentUser() {
  var token = localStorage.getItem('token');
  if (!token) return null;
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return null;
    var payload = atob(parts[1]);
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

window.getAuthHeaders = getAuthHeaders;
window.getCurrentUser = getCurrentUser;

document.addEventListener('DOMContentLoaded', function () {
  fetch(API_URL + '/auth/config')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.authEnabled && !localStorage.getItem('token')) {
        window.location.href = 'login.html';
      }
    })
    .catch(function () {
      // If config endpoint is unavailable, allow access
    });
});
