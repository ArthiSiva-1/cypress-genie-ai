#!/usr/bin/env node

const { extractHTML, getNavigationHistory, closeBrowser } = require('../src/browser');
const { generateTest } = require('../src/openai');
const { saveTest } = require('../src/generator');


const fs = require('fs');
const path = require('path');
const slugify = require('slugify');

const args = process.argv.slice(2);
const [scenario] = args;

const url = args.find(arg => arg.startsWith('--url='))?.split('=')[1];
const nameArg = args.find(arg => arg.startsWith('--name='))?.split('=')[1];
const outputArg = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

const customName = nameArg ? slugify(nameArg, { lower: true, strict: true }) : null;
const outputPath = outputArg || `cypress/e2e/spec/${customName || 'generated'}.spec.js`;


// const args = process.argv.slice(2);
// const [scenario] = args;
// const url = args.find(arg => arg.startsWith('--url='))?.split('=')[1];
// const outputArg = args.find(arg => arg.startsWith('--output='))?.split('=')[1];
// const outputPath = outputArg || 'cypress/e2e/spec/generated.spec.js';

if (!scenario || !url) {
  console.log('Usage: cypress-genie-ai "scenario" --url=https://example.com');
  process.exit(1);
}

(async () => {
  try {
    const initialHtml = await extractHTML(url);
    
    // Wait a bit for any post-load navigations to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get DOM snapshots from all navigated pages
    const navigationHistory = getNavigationHistory();
    
    const cypressTest = await generateTest(scenario, initialHtml, url, navigationHistory);
    await saveTest(cypressTest, outputPath);
    await closeBrowser();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
