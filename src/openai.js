require('dotenv').config();
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateTest(scenario, initialDom, url, navigationHistory = {}) {
  const domSnapshots = {
    initial: initialDom,
    ...navigationHistory
  };

  const prompt = `You are an expert Cypress automation engineer.

Role: Analyze the provided scenario, URL, and DOM snapshots to generate appropriate page objects and tests.

Input:
- URL: ${url}
- Initial DOM: ${domSnapshots.initial}
- Navigation History DOM Snapshots: ${JSON.stringify(navigationHistory)}
- Scenario: ${scenario}

Task:
1. Analyze the scenario and ALL DOM snapshots to identify ALL relevant pages and components
2. For EACH identified page or component:
   - Create a page object class
   - Include all relevant elements and actions
   - Add comprehensive assertions for both initial and post-navigation states

Requirements for Page Objects:
1. Each class MUST:
   - Start with 'export default class ClassName'
   - Follow PascalCase naming (e.g., HomePage, SearchResultsPage, ProductDetailsPage)
   - Include elements object with getters using arrow functions
   - Have methods for ALL possible actions on that page
   - Include assertions in EVERY action method
   - Return 'this' for method chaining
   - Use stable selectors (data-testid, id, etc.)

2. Test file must:
   - Use correct relative imports for ALL page objects
   - Include comprehensive assertions
   - Have proper beforeEach/afterEach hooks
   - Follow Cypress best practices
   - Cover the complete user journey

Example Page Object Structure:
export default class ProductPage {
  elements = {
    searchInput: () => cy.get('[data-testid="search-input"]'),
    filterDropdown: () => cy.get('#filter-options'),
    resultsList: () => cy.get('[data-testid="results-list"]')
  }

  search(term) {
    this.elements.searchInput()
      .should('be.visible')
      .clear()
      .type(term)
      .should('have.value', term);
    return this;
  }

  verifySearchResults() {
    this.elements.resultsList()
      .should('be.visible')
      .should('not.be.empty');
    return this;
  }
}

Example Test Structure:
import ProductPage from '../../support/page-objects/ProductPage';
import CartPage from '../../support/page-objects/CartPage';

describe('Product Search and Purchase', () => {
  beforeEach(() => {
    cy.clearCookies();
    ProductPage.visit();
  });

  it('should search and add product to cart', () => {
    ProductPage
      .search('laptop')
      .verifySearchResults()
      .selectProduct('MacBook Pro')
      .addToCart();
    
    CartPage
      .verifyProductAdded('MacBook Pro')
      .proceedToCheckout();
  });
});

IMPORTANT: Respond with ONLY a valid JSON object in this format:
{
  "pageObjects": {
    "PageName1.js": "complete page object class code",
    "PageName2.js": "complete page object class code",
    // Add ALL necessary page objects based on scenario
  },
  "testFile": "complete test file code with proper imports"
}

Focus on creating ALL necessary page objects for the complete user journey in the scenario. Don't limit to just login/dashboard patterns.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message.content;
  
  // Validate JSON response
  try {
    const parsed = JSON.parse(content);
    if (!parsed.pageObjects || !parsed.testFile) {
      throw new Error('Invalid response format');
    }
    return content;
  } catch (e) {
    throw new Error('Failed to get valid JSON response from OpenAI: ' + e.message);
  }
}

module.exports = { generateTest };
