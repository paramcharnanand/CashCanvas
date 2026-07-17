/** Page object for the login/signup screen (src/AuthScreen.jsx). */
export class AuthPage {
  constructor(page) {
    this.page = page;
    this.signInTab = page.getByRole("button", { name: "Sign In" }).first();
    this.createAccountTab = page.getByRole("button", { name: "Create Account" }).first();
    this.nameField = page.getByPlaceholder("Your name");
    this.emailField = page.getByPlaceholder("you@example.com");
    // Password placeholder differs by mode (see AuthScreen.jsx) — match either.
    this.passwordField = page.locator('input[type="password"]');
  }

  /**
   * The form-level error banner (AuthScreen.jsx's `fieldErrors.form`) has no
   * stable role/testid to select generically — this codebase has no
   * data-testid/aria attributes anywhere yet (see ROADMAP.md's tech debt,
   * and Phase 6.4's accessibility findings). Tests assert on the *specific*
   * message text they expect via this helper rather than a generic
   * "some error is showing" locator, which is both more precise and more
   * robust than guessing at a CSS selector for an unstyled-by-role div.
   */
  errorText(substring) {
    return this.page.getByText(substring, { exact: false });
  }

  async gotoSignup() {
    await this.page.goto("/");
    await this.createAccountTab.click();
  }

  async gotoLogin() {
    await this.page.goto("/");
    await this.signInTab.click();
  }

  async fillSignupForm({ name, email, password }) {
    await this.nameField.fill(name);
    await this.emailField.fill(email);
    await this.passwordField.fill(password);
  }

  async fillLoginForm({ email, password }) {
    await this.emailField.fill(email);
    await this.passwordField.fill(password);
  }

  async submit() {
    // The submit button's label matches the active tab ("Create Account" / "Sign In").
    await this.page.locator('button[type="submit"]').click();
  }

  async signup({ name, email, password }) {
    await this.gotoSignup();
    await this.fillSignupForm({ name, email, password });
    await this.submit();
  }

  async login({ email, password }) {
    await this.gotoLogin();
    await this.fillLoginForm({ email, password });
    await this.submit();
  }
}
