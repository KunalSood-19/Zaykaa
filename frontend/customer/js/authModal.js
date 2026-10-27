/**
 * Authentication Modal & Navbar Profile Manager
 * Handles JWT Login, Registration, Session Persistence, and Role Badges
 */

export class AuthModal {
  constructor({ modalElement, api, onAuthChange }) {
    this.modal = modalElement;
    this.api = api;
    this.onAuthChange = onAuthChange;

    this.initElements();
    this.initEventListeners();
    this.restoreSession();
  }

  initElements() {
    this.closeBtn = this.modal.querySelector('#auth-close-btn');
    this.tabLogin = this.modal.querySelector('#auth-tab-login');
    this.tabRegister = this.modal.querySelector('#auth-tab-register');
    this.errorBanner = this.modal.querySelector('#auth-error-banner');
    this.successBanner = this.modal.querySelector('#auth-success-banner');

    this.loginForm = this.modal.querySelector('#auth-login-form');
    this.loginEmailInput = this.modal.querySelector('#login-email');
    this.loginPasswordInput = this.modal.querySelector('#login-password');
    this.loginSubmitBtn = this.modal.querySelector('#login-submit-btn');

    this.registerForm = this.modal.querySelector('#auth-register-form');
    this.registerNameInput = this.modal.querySelector('#register-name');
    this.registerEmailInput = this.modal.querySelector('#register-email');
    this.registerPhoneInput = this.modal.querySelector('#register-phone');
    this.registerPasswordInput = this.modal.querySelector('#register-password');
    this.registerSubmitBtn = this.modal.querySelector('#register-submit-btn');

    // Navbar integration elements
    this.profileBadge = document.querySelector('#user-profile-badge');
    this.avatarEl = document.querySelector('#user-avatar') || document.querySelector('.user-avatar');
    this.nameEl = document.querySelector('#user-profile-name');
    this.dropdownMenu = document.querySelector('#user-dropdown-menu');
    this.dropdownName = document.querySelector('#dropdown-user-name');
    this.dropdownEmail = document.querySelector('#dropdown-user-email');
    this.dropdownRole = document.querySelector('#dropdown-user-role');
    this.dropdownLogoutBtn = document.querySelector('#dropdown-logout-btn');
    this.navLoginBtn = document.querySelector('#nav-login-btn');
  }

  initEventListeners() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });

    // Tab switcher
    if (this.tabLogin && this.tabRegister) {
      this.tabLogin.addEventListener('click', () => this.switchTab('login'));
      this.tabRegister.addEventListener('click', () => this.switchTab('register'));
    }

    // Login submit
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Register submit
    if (this.registerForm) {
      this.registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleRegister();
      });
    }

    // Navbar profile badge click -> toggle dropdown or open login
    if (this.profileBadge) {
      this.profileBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        const user = this.api.getCurrentUser();
        if (user && this.dropdownMenu) {
          this.toggleDropdown();
        } else {
          this.open('login');
        }
      });
    }

    // Navbar direct login button (if visible)
    if (this.navLoginBtn) {
      this.navLoginBtn.addEventListener('click', () => this.open('login'));
    }

    // Dropdown logout button
    if (this.dropdownLogoutBtn) {
      this.dropdownLogoutBtn.addEventListener('click', () => {
        this.handleLogout();
      });
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (this.dropdownMenu && !this.dropdownMenu.contains(e.target) && !this.profileBadge?.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }

  isOpen() {
    return this.modal.classList.contains('open');
  }

  open(tab = 'login') {
    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    this.closeDropdown();
    this.hideMessages();
    this.switchTab(tab);
  }

  close() {
    this.modal.classList.remove('open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.hideMessages();
  }

  toggleDropdown() {
    if (!this.dropdownMenu) return;
    const isShowing = this.dropdownMenu.style.display === 'block';
    this.dropdownMenu.style.display = isShowing ? 'none' : 'block';
  }

  closeDropdown() {
    if (this.dropdownMenu) {
      this.dropdownMenu.style.display = 'none';
    }
  }

  switchTab(tab) {
    this.hideMessages();
    if (tab === 'login') {
      this.tabLogin.style.color = 'var(--color-primary)';
      this.tabLogin.style.borderBottomColor = 'var(--color-primary)';
      this.tabRegister.style.color = 'var(--color-text-muted)';
      this.tabRegister.style.borderBottomColor = 'transparent';

      this.loginForm.style.display = 'block';
      this.registerForm.style.display = 'none';
      this.loginEmailInput?.focus();
    } else {
      this.tabRegister.style.color = 'var(--color-primary)';
      this.tabRegister.style.borderBottomColor = 'var(--color-primary)';
      this.tabLogin.style.color = 'var(--color-text-muted)';
      this.tabLogin.style.borderBottomColor = 'transparent';

      this.loginForm.style.display = 'none';
      this.registerForm.style.display = 'block';
      this.registerNameInput?.focus();
    }
  }

  showError(msg) {
    if (this.errorBanner) {
      this.errorBanner.textContent = msg;
      this.errorBanner.style.display = 'block';
      if (this.successBanner) this.successBanner.style.display = 'none';
    } else {
      alert(msg);
    }
  }

  showSuccess(msg) {
    if (this.successBanner) {
      this.successBanner.textContent = msg;
      this.successBanner.style.display = 'block';
      if (this.errorBanner) this.errorBanner.style.display = 'none';
    }
  }

  hideMessages() {
    if (this.errorBanner) this.errorBanner.style.display = 'none';
    if (this.successBanner) this.successBanner.style.display = 'none';
  }

  async handleLogin() {
    const email = this.loginEmailInput?.value?.trim();
    const password = this.loginPasswordInput?.value;

    if (!email || !password) {
      this.showError('Please enter both email and password.');
      return;
    }

    if (this.loginSubmitBtn) {
      this.loginSubmitBtn.disabled = true;
      this.loginSubmitBtn.textContent = 'Verifying credentials...';
    }

    try {
      const res = await this.api.login({ email, password });
      if (res?.success && res?.data?.user) {
        this.updateNavUser(res.data.user);
        this.close();

        if (typeof this.onAuthChange === 'function') {
          this.onAuthChange(res.data.user);
        }
      }
    } catch (err) {
      this.showError(err.message || 'Login failed. Please check credentials.');
    } finally {
      if (this.loginSubmitBtn) {
        this.loginSubmitBtn.disabled = false;
        this.loginSubmitBtn.textContent = 'Log In with JWT';
      }
    }
  }

  async handleRegister() {
    const name = this.registerNameInput?.value?.trim();
    const email = this.registerEmailInput?.value?.trim();
    const phone = this.registerPhoneInput?.value?.trim();
    const password = this.registerPasswordInput?.value;

    if (!name || !email || !password) {
      this.showError('Please fill in all required fields (*).');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters long.');
      return;
    }

    if (this.registerSubmitBtn) {
      this.registerSubmitBtn.disabled = true;
      this.registerSubmitBtn.textContent = 'Creating account...';
    }

    try {
      const res = await this.api.register({ name, email, phone, password });
      if (res?.success && res?.data?.user) {
        this.updateNavUser(res.data.user);
        this.close();

        if (typeof this.onAuthChange === 'function') {
          this.onAuthChange(res.data.user);
        }
      }
    } catch (err) {
      this.showError(err.message || 'Registration failed. Email may already exist.');
    } finally {
      if (this.registerSubmitBtn) {
        this.registerSubmitBtn.disabled = false;
        this.registerSubmitBtn.textContent = 'Create Account & Get Token';
      }
    }
  }

  handleLogout() {
    this.api.logout();
    this.closeDropdown();

    // Default back to guest / test user
    this.updateNavUser(null);

    if (typeof this.onAuthChange === 'function') {
      this.onAuthChange(null);
    }
  }

  restoreSession() {
    const user = this.api.getCurrentUser();
    if (user) {
      this.updateNavUser(user);
    } else {
      // Default to Tarshit Gupta for initial presentation
      this.updateNavUser({
        id: 'cust_8829',
        name: 'Tarshit Gupta',
        email: 'tarshit@example.com',
        role: 'customer'
      });
    }
  }

  updateNavUser(user) {
    if (user) {
      const initial = (user.name || 'U').charAt(0).toUpperCase();
      if (this.avatarEl) this.avatarEl.textContent = initial;
      if (this.nameEl) this.nameEl.textContent = user.name || 'User';

      if (this.dropdownName) this.dropdownName.textContent = user.name;
      if (this.dropdownEmail) this.dropdownEmail.textContent = user.email || '';
      if (this.dropdownRole) this.dropdownRole.textContent = (user.role || 'customer').toUpperCase();

      if (this.profileBadge) {
        this.profileBadge.style.display = 'flex';
        this.profileBadge.title = `Logged in as ${user.name} (${user.email}) - Click for options`;
      }
      if (this.navLoginBtn) this.navLoginBtn.style.display = 'none';
    } else {
      if (this.avatarEl) this.avatarEl.textContent = 'G';
      if (this.nameEl) this.nameEl.textContent = 'Guest (Log In)';
      if (this.profileBadge) {
        this.profileBadge.style.display = 'flex';
        this.profileBadge.title = 'Click to Log In with JWT';
      }
    }
  }
}
