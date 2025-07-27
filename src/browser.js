const { chromium } = require('playwright');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
    this.navigationHistory = new Map();
  }

  async initialize() {
    this.browser = await chromium.launch();
    this.page = await this.browser.newPage();
    
    // Listen for navigation events
    this.page.on('framenavigated', async frame => {
      if (frame === this.page.mainFrame()) {
        await this.captureState();
      }
    });

    // Listen for network requests that might cause page changes
    this.page.on('response', async response => {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('json') || contentType.includes('html')) {
        // Wait for any potential DOM updates
        await this.page.waitForLoadState('networkidle');
        await this.captureState();
      }
    });

    // Listen for form submissions
    this.page.on('framenavigated', async frame => {
      if (frame === this.page.mainFrame()) {
        const url = frame.url();
        if (url.includes('submit') || url.includes('login') || url.includes('sign')) {
          await this.captureState();
        }
      }
    });
  }

  async captureState() {
    const url = this.page.url();
    const content = await this.page.content();
    this.navigationHistory.set(url, {
      content,
      timestamp: new Date().toISOString()
    });
  }

  async extractHTML(url) {
    if (!this.browser) {
      await this.initialize();
    }
    
    await this.page.goto(url);
    const content = await this.page.content();
    await this.captureState();
    return content;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  getNavigationHistory() {
    return Object.fromEntries(this.navigationHistory);
  }
}

const browserManager = new BrowserManager();

module.exports = { 
  extractHTML: (url) => browserManager.extractHTML(url),
  getNavigationHistory: () => browserManager.getNavigationHistory(),
  closeBrowser: () => browserManager.close()
};
