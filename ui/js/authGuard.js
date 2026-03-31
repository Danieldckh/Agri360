var API_URL = '/api';
window.API_URL = API_URL;

function getAuthHeaders() {
  var token = localStorage.getItem('token');
  if (token) {
    return { 'Authorization': 'Bearer ' + token };
  }
  return {};
}

var _defaultUser = { id: 1, username: 'admin', role: 'admin', firstName: 'Admin', lastName: 'User' };

function getCurrentUser() {
  var token = localStorage.getItem('token');
  if (!token) return _defaultUser;
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return _defaultUser;
    var payload = atob(parts[1]);
    return JSON.parse(payload);
  } catch (e) {
    return _defaultUser;
  }
}

window.getAuthHeaders = getAuthHeaders;
window.getCurrentUser = getCurrentUser;
