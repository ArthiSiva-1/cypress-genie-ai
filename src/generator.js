const fs = require('fs');
const path = require('path');
const prettier = require('prettier');
const babel = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const { validateAndUpdateSelectors } = require('./utils');

async function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

async function parseExistingPageObject(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return babel.parse(content, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'classProperties']
  });
}



async function mergePageObjects(existingAst, newContent, domContent) {
  if (!existingAst) {
    return newContent;
  }

  const newAst = babel.parse(newContent, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'classProperties']
  });

  

  const existingElements = new Set();
  const existingMethods = new Set();

  // Collect existing elements and methods
  traverse(existingAst, {
    ClassProperty(path) {
      if (path.node.key.name === 'elements') {
        path.node.value.properties.forEach(prop => {
          existingElements.add(prop.key.name);
        });
      }
    },
    ClassMethod(path) {
      existingMethods.add(path.node.key.name);
    }
  });

  // Merge new elements and methods
  traverse(newAst, {
    ClassProperty(path) {
      if (path.node.key.name === 'elements') {
        const newElements = path.node.value.properties.filter(
          prop => !existingElements.has(prop.key.name)
        );
        path.node.value.properties = [
          ...path.node.value.properties,
          ...newElements
        ];
      }
    },
    ClassMethod(path) {
      if (!existingMethods.has(path.node.key.name)) {
        const commentStatement = t.expressionStatement(t.stringLiteral(''));
commentStatement.leadingComments = [
  {
    type: 'CommentLine',
    value: ' Added by cypress-genie-ai update',
  },
];
path.node.body.body.unshift(commentStatement);
      }
    }
  });

  return generate(newAst, {}, newContent).code;
}

async function saveFile(content, filePath, domContent = null) {
  const fullPath = path.resolve(process.cwd(), filePath);
  await ensureDirectoryExists(fullPath);

  let finalContent = content;
  if (filePath.includes('page-objects') && domContent) {
    const existingAst = await parseExistingPageObject(fullPath);
    finalContent = await mergePageObjects(existingAst, content, domContent);
  }

  const formatted = await prettier.format(finalContent, { parser: 'babel' });
  fs.writeFileSync(fullPath, formatted);
  const { execSync } = require('child_process');
  execSync(`code ${fullPath}`);
}

async function saveTest(content, filePath = 'cypress/e2e/generated.spec.js') {
  const resolvedContent = await content;
  let parsedContent;
  
  try {
    parsedContent = JSON.parse(resolvedContent);
  } catch (e) {
    // If not JSON, treat as legacy format (just test file content)
    return saveFile(resolvedContent, filePath);
  }

  // Create page objects in the correct cypress/support/page-objects directory
  const pageObjectsDir = 'cypress/support/page-objects';
  await ensureDirectoryExists(path.resolve(process.cwd(), pageObjectsDir));

  // Get the latest DOM content from navigation history
  const { getNavigationHistory } = require('./browser');
  const navigationHistory = getNavigationHistory();
  const latestDomContent = Object.values(navigationHistory).pop()?.content;

  // Save page objects with DOM validation
  for (const [fileName, content] of Object.entries(parsedContent.pageObjects)) {
    const pageObjectPath = path.join(pageObjectsDir, fileName);
    await saveFile(content, pageObjectPath, latestDomContent);
    console.log(`✅ Page object saved at ${path.resolve(process.cwd(), pageObjectPath)}`);
  }

  // Save test file
  await saveFile(parsedContent.testFile, filePath);
  console.log(`✅ Cypress test saved at ${path.resolve(process.cwd(), filePath)}`);
}

module.exports = { saveTest };
