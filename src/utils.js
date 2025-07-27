const { JSDOM } = require('jsdom');

function findBestSelector(element, dom) {
  // Priority order for selectors
  const selectors = [];
  
  // 1. Try data-testid (most preferred)
  if (element.getAttribute('data-testid')) {
    selectors.push(`[data-testid="${element.getAttribute('data-testid')}"]`);
  }
  
  // 2. Try id
  if (element.id) {
    selectors.push(`#${element.id}`);
  }
  
  // 3. Try name
  if (element.getAttribute('name')) {
    selectors.push(`[name="${element.getAttribute('name')}"]`);
  }
  
  // 4. Try aria-label
  if (element.getAttribute('aria-label')) {
    selectors.push(`[aria-label="${element.getAttribute('aria-label')}"]`);
  }
  
  // 5. Try role with text
  if (element.getAttribute('role') && element.textContent) {
    selectors.push(`[role="${element.getAttribute('role')}"]`);
  }

  // Test each selector's uniqueness
  for (const selector of selectors) {
    if (dom.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  return null;
}

function validateAndUpdateSelectors(pageObject, domContent) {
  const dom = new JSDOM(domContent);
  const document = dom.window.document;
  const updates = {};

  // Extract selectors from the page object
  const selectorRegex = /cy\.get\(['"](.*?)['"]\)/g;
  let match;
  while ((match = selectorRegex.exec(pageObject)) !== null) {
    const selector = match[1];
    try {
      const element = document.querySelector(selector);
      if (!element) {
        // Selector not found, try to find a better one
        const similarElements = document.querySelectorAll('*');
        for (const el of similarElements) {
          const betterSelector = findBestSelector(el, document);
          if (betterSelector) {
            updates[selector] = betterSelector;
            break;
          }
        }
      }
    } catch (e) {
      console.warn(`Invalid selector: ${selector}`);
    }
  }

  return updates;
}

module.exports = {
  validateAndUpdateSelectors
};