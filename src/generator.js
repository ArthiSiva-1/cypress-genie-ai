const fs = require('fs');
const path = require('path');
const prettier = require('prettier');
const babel = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

async function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

async function parseCodeToAst(content) {
    return babel.parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'classProperties']
    });
}

// --- Page Object Merging ---
async function mergePageObjects(existingAst, newContent) {
  if (!existingAst) {
    return newContent;
  }

  const newAst = await parseCodeToAst(newContent);

  let existingElementsNode = null;
  let existingClassBody = null;
  const existingElementsMap = new Map();
  const existingMethodsSet = new Set();

  traverse(existingAst, {
    ClassDeclaration(path) {
      existingClassBody = path.node.body.body;
    },
    ClassProperty(path) {
      if (path.node.key.name === 'elements' && t.isObjectExpression(path.node.value)) {
        existingElementsNode = path.node.value;
        path.node.value.properties.forEach(prop => {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
            existingElementsMap.set(prop.key.name, prop);
          }
        });
      }
    },
    ClassMethod(path) {
      if (t.isIdentifier(path.node.key)) {
        existingMethodsSet.add(path.node.key.name);
      }
    }
  });

  if (!existingClassBody) {
      return newContent; // No class found in existing, so return new content (consider logging this)
  }

  traverse(newAst, {
    ClassProperty(path) {
      if (path.node.key.name === 'elements' && t.isObjectExpression(path.node.value)) {
        path.node.value.properties.forEach(newElementProp => {
          if (t.isObjectProperty(newElementProp) && t.isIdentifier(newElementProp.key)) {
            if (!existingElementsMap.has(newElementProp.key.name)) {
              if (existingElementsNode) {
                  existingElementsNode.properties.push(newElementProp);
              } else {
                  // If 'elements' property doesn't exist in existing PO, add it
                  const elementsProp = t.classProperty(
                      t.identifier('elements'),
                      t.objectExpression([newElementProp])
                  );
                  existingClassBody.unshift(elementsProp); // Add at the beginning of the class body
                  existingElementsNode = elementsProp.value; // Set the newly added elements node
              }
            }
          }
        });
      }
    },
    ClassMethod(path) {
      if (t.isIdentifier(path.node.key)) {
        if (!existingMethodsSet.has(path.node.key.name)) {
          // Add a comment to newly added methods for traceability
          const commentStatement = t.expressionStatement(t.stringLiteral(''));
          commentStatement.leadingComments = [
            {
              type: 'CommentLine',
              value: ' Added by cypress-genie-ai update',
            },
          ];
          path.node.body.body.unshift(commentStatement);
          existingClassBody.push(path.node);
        }
      }
    }
  });

  return generate(existingAst, {}, newContent).code;
}

// --- Test File Merging ---
async function mergeTestFiles(existingAst, newContent) {
    if (!existingAst) {
        return newContent; // No existing file, just return the new content
    }

    const newAst = await parseCodeToAst(newContent);

    const existingDescribeBlocks = new Map(); // Map 'describe' block names to their AST nodes
    const existingItBlocks = new Set();      // Set of 'it' block identifiers (e.g., "DescribeName::ItName")

    // 1. Collect existing describe and it blocks from existingAst
    traverse(existingAst, {
        CallExpression(path) {
            if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'describe') {
                const describeNameNode = path.node.arguments[0];
                if (t.isStringLiteral(describeNameNode)) {
                    const describeName = describeNameNode.value;
                    existingDescribeBlocks.set(describeName, path.node);

                    // Collect 'it' blocks within this describe
                    traverse(path.node, {
                        CallExpression(innerPath) {
                            if (t.isIdentifier(innerPath.node.callee) && innerPath.node.callee.name === 'it') {
                                const itNameNode = innerPath.node.arguments[0];
                                if (t.isStringLiteral(itNameNode)) {
                                    existingItBlocks.add(`${describeName}::${itNameNode.value}`);
                                }
                            }
                        },
                        // Stop traversing deeper than current describe block for 'it' blocks
                        noScope: true // Crucial to prevent traversing into nested describe blocks unintentionally
                    });
                }
            }
        }
    });

    // 2. Add new describe and it blocks from newAst to existingAst
    let newImports = [];
    const newDescribeBlocksToAdd = [];

    traverse(newAst, {
        ImportDeclaration(path) {
            // Collect new imports that are not already in existingAst
            const importCode = generate(path.node).code;
            let importExists = false;
            traverse(existingAst, {
                ImportDeclaration(existingPath) {
                    if (generate(existingPath.node).code === importCode) {
                        importExists = true;
                    }
                }
            });
            if (!importExists) {
                newImports.push(path.node);
            }
            path.remove(); // Remove imports from the new AST as we'll re-add them to the top of existing AST
        },
        CallExpression(path) {
            if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'describe') {
                const describeNameNode = path.node.arguments[0];
                if (t.isStringLiteral(describeNameNode)) {
                    const describeName = describeNameNode.value;

                    if (existingDescribeBlocks.has(describeName)) {
                        // Merge 'it' blocks into existing 'describe'
                        const existingDescribeNode = existingDescribeBlocks.get(describeName);
                        // Ensure the second argument of describe is a function expression and has a body
                        if (t.isFunctionExpression(existingDescribeNode.arguments[1]) || t.isArrowFunctionExpression(existingDescribeNode.arguments[1])) {
                             const existingDescribeBody = existingDescribeNode.arguments[1].body.body;

                            traverse(path.node, {
                                CallExpression(innerPath) {
                                    if (t.isIdentifier(innerPath.node.callee) && innerPath.node.callee.name === 'it') {
                                        const itNameNode = innerPath.node.arguments[0];
                                        if (t.isStringLiteral(itNameNode)) {
                                            const itIdentifier = `${describeName}::${itNameNode.value}`;
                                            if (!existingItBlocks.has(itIdentifier)) {
                                                // Add new 'it' block to existing 'describe'
                                                innerPath.node.leadingComments = [{
                                                    type: 'CommentLine',
                                                    value: ' Added by cypress-genie-ai update',
                                                }];
                                                existingDescribeBody.push(innerPath.node);
                                            }
                                        }
                                    }
                                },
                                noScope: true // Crucial to prevent traversing into nested describe blocks unintentionally
                            });
                        }
                        path.remove(); // Remove the describe block from newAst after merging its 'it's
                    } else {
                        // New 'describe' block, add it to the list to append
                        newDescribeBlocksToAdd.push(path.node);
                    }
                }
            }
        }
    });

    // Append new imports to the top of the existing AST
    existingAst.program.body = [...newImports, ...existingAst.program.body];

    // Append new describe blocks to the end of the existing AST
    existingAst.program.body = [...existingAst.program.body, ...newDescribeBlocksToAdd];

    return generate(existingAst, {}, newContent).code;
}


async function saveFile(content, filePath, domContent = null) {
  const fullPath = path.resolve(process.cwd(), filePath);
  await ensureDirectoryExists(fullPath);

  let finalContent = content;
  if (filePath.includes('page-objects')) {
    const existingAst = fs.existsSync(fullPath) ? await parseCodeToAst(fs.readFileSync(fullPath, 'utf-8')) : null;
    finalContent = await mergePageObjects(existingAst, content);
  } else if (filePath.includes('.spec.js')) { // Handle test files for merging
    const existingAst = fs.existsSync(fullPath) ? await parseCodeToAst(fs.readFileSync(fullPath, 'utf-8')) : null;
    finalContent = await mergeTestFiles(existingAst, content);
  }

  // Prettier formatting without organize-imports plugin
  const formatted = await prettier.format(finalContent, { parser: 'babel' });
  fs.writeFileSync(fullPath, formatted);
  
  // Open the file in VS Code
  const { execSync } = require('child_process');
  execSync(`code ${fullPath}`);
}

async function saveTest(content, filePath = 'cypress/e2e/generated.spec.js') {
  const resolvedContent = await content;
  let parsedContent;

  try {
    parsedContent = JSON.parse(resolvedContent);
  } catch (e) {
    console.error("Error parsing AI response as JSON, attempting to save as raw content:", e);
    // If parsing fails, assume the content is a raw test file and try to save it directly
    return saveFile(resolvedContent, filePath);
  }

  const pageObjectsDir = 'cypress/support/page-objects';
  await ensureDirectoryExists(path.resolve(process.cwd(), pageObjectsDir));

  // This part assumes getNavigationHistory is still relevant for some external context.
  // If not, it can be removed or modified.
  // const { getNavigationHistory } = require('./browser'); 
  // const navigationHistory = getNavigationHistory();
  // const latestDomContent = Object.values(navigationHistory).pop()?.content;
  const latestDomContent = null; // Placeholder if domContent is not used in saveFile anymore

  for (const [fileName, poContent] of Object.entries(parsedContent.pageObjects)) {
    const pageObjectPath = path.join(pageObjectsDir, fileName);
    await saveFile(poContent, pageObjectPath, latestDomContent);
    console.log(`✅ Page object saved at ${path.resolve(process.cwd(), pageObjectPath)}`);
  }

  // Now, call saveFile for the test file, which will use the new mergeTestFiles logic
  await saveFile(parsedContent.testFile, filePath);
  console.log(`✅ Cypress test saved at ${path.resolve(process.cwd(), filePath)}`);
}

module.exports = { saveTest };