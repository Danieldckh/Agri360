document.addEventListener('DOMContentLoaded', function () {
  var API_URL = 'http://localhost:3001/api';
  var page = document.body.dataset.page;

  function showMessage(type, text) {
    var el = document.getElementById('authMessage');
    if (!el) return;
    el.style.display = 'block';
    el.className = 'auth-message ' + type;
    el.textContent = text;
  }

  function clearMessage() {
    var el = document.getElementById('authMessage');
    if (!el) return;
    el.style.display = 'none';
    el.textContent = '';
    el.className = 'auth-message';
  }

  // Login page
  if (page === 'login') {
    var form = document.getElementById('authForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearMessage();

      var username = form.elements.username.value.trim();
      var password = form.elements.password.value;

      if (!username || !password) {
        showMessage('error', 'Please fill in all fields.');
        return;
      }

      fetch(API_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.token) {
            localStorage.setItem('token', data.token);
            window.location.href = 'index.html';
          } else {
            showMessage('error', data.error || 'Login failed.');
          }
        })
        .catch(function () {
          showMessage('error', 'Unable to connect to server.');
        });
    });
  }

  // Signup page
  if (page === 'signup') {
    var form = document.getElementById('authForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearMessage();

      var firstName = form.elements.firstName.value.trim();
      var lastName = form.elements.lastName.value.trim();
      var username = form.elements.username.value.trim();
      var password = form.elements.password.value;
      var confirmPassword = form.elements.confirmPassword.value;
      var securityQuestion = form.elements.securityQuestion.value;
      var securityAnswer = form.elements.securityAnswer.value.trim();

      if (!firstName || !lastName || !username || !password || !confirmPassword || !securityQuestion || !securityAnswer) {
        showMessage('error', 'Please fill in all fields.');
        return;
      }

      if (password !== confirmPassword) {
        showMessage('error', 'Passwords do not match.');
        return;
      }

      fetch(API_URL + '/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName,
          lastName: lastName,
          username: username,
          password: password,
          securityQuestion: securityQuestion,
          securityAnswer: securityAnswer
        })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) {
            showMessage('error', data.error);
          } else {
            showMessage('success', 'Account created! Awaiting admin approval.');
            form.reset();
          }
        })
        .catch(function () {
          showMessage('error', 'Unable to connect to server.');
        });
    });
  }

  // Forgot password page
  if (page === 'forgot-password') {
    var storedUsername = '';

    var step1Form = document.getElementById('step1Form');
    var step2Form = document.getElementById('step2Form');

    step1Form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearMessage();

      var username = step1Form.elements.username.value.trim();
      if (!username) {
        showMessage('error', 'Please enter your username.');
        return;
      }

      fetch(API_URL + '/auth/forgot/verify-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) {
            showMessage('error', data.error);
          } else {
            storedUsername = username;
            document.getElementById('securityQuestionText').textContent = data.securityQuestion;
            document.getElementById('step1').classList.remove('active');
            document.getElementById('step2').classList.add('active');
            clearMessage();
          }
        })
        .catch(function () {
          showMessage('error', 'Unable to connect to server.');
        });
    });

    step2Form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearMessage();

      var securityAnswer = step2Form.elements.securityAnswer.value.trim();
      var newPassword = step2Form.elements.newPassword.value;
      var confirmPassword = step2Form.elements.confirmPassword.value;

      if (!securityAnswer || !newPassword || !confirmPassword) {
        showMessage('error', 'Please fill in all fields.');
        return;
      }

      if (newPassword !== confirmPassword) {
        showMessage('error', 'Passwords do not match.');
        return;
      }

      fetch(API_URL + '/auth/forgot/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: storedUsername,
          securityAnswer: securityAnswer,
          newPassword: newPassword
        })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) {
            showMessage('error', data.error);
          } else {
            document.getElementById('step2').classList.remove('active');
            document.getElementById('step3').classList.add('active');
            clearMessage();
          }
        })
        .catch(function () {
          showMessage('error', 'Unable to connect to server.');
        });
    });
  }
});
