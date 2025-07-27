# Cypress Genie AI 🧞‍♂️

An AI-powered tool that automatically generates and maintains Cypress test automation code by analyzing your web application's DOM structure.

## Features 

- **Intelligent Test Generation**: Automatically creates Cypress tests from user scenarios
- **Smart Page Object Management**: 
  - Auto-generates page objects with best practices
  - Updates existing page objects without overwriting custom changes
  - Maintains selector accuracy through DOM analysis
- **DOM State Tracking**: 
  - Captures DOM snapshots during page transitions
  - Tracks navigation history for comprehensive testing
  - Validates and updates selectors automatically
- **Best Practices Built-in**:
  - Uses data-testid and stable selectors
  - Implements page object pattern
  - Includes comprehensive assertions
  - Supports method chaining

## Installation 🚀

```bash
npm install cypress-genie-ai
```

## Prerequisites 📋

- Node.js (v16 or higher)
- Cypress (v12 or higher)
- OpenAI API key

## Configuration ⚙️

1. Create a `.env` file in your project root:
```bash
OPENAI_API_KEY=your_api_key_here
```

2. Make sure your `.gitignore` includes:
```
node_modules
.env
```

## Usage 🛠️

### Basic Usage

```bash
npx cypress-genie-ai "Login and verify dashboard" --url=https://your-app.com/login
```

## How It Works 🔄

1. **DOM Analysis**: Captures initial page DOM and tracks navigation changes
2. **AI Processing**: Analyzes DOM structure and generates appropriate test code
3. **Smart Updates**: 
   - Merges new selectors with existing page objects
   - Updates incorrect selectors
   - Preserves custom modifications
4. **Code Generation**: Creates or updates:
   - Page Object files
   - Test specifications
   - Element selectors

## Example Output 📝

```javascript
// Generated Page Object
export default class LoginPage {
  elements = {
    usernameInput: () => cy.get('[data-testid="username-input"]'),
    passwordInput: () => cy.get('[data-testid="password-input"]'),
    loginButton: () => cy.get('[data-testid="login-button"]')
  }

  login(username, password) {
    this.elements.usernameInput().type(username);
    this.elements.passwordInput().type(password);
    this.elements.loginButton().click();
    return this;
  }
}
```

## Contributing 🤝

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## Troubleshooting 🔍

### Common Issues

1. **Selector not found**
   - Ensure the page is fully loaded
   - Check if elements are in iframes
   - Verify dynamic content loading

2. **OpenAI API Issues**
   - Verify API key in .env file
   - Check API quota and limits
   - Ensure proper network connectivity

## Support 💬

- Create an issue for bugs or feature requests
- Star the repo if you find it useful
- Follow for updates

## Roadmap 🗺️

- [ ] Support for dynamic content loading
- [ ] Custom selector strategies
- [ ] Integration with CI/CD platforms
- [ ] Test data management
- [ ] Visual regression testing support

## Acknowledgments 🙏

- OpenAI for GPT API
- Cypress team for the amazing test framework
- Contributors and users of this project