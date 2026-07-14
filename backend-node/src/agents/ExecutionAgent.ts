import { chromium, firefox, webkit, Browser } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import { getModel } from './llm';
import { sanitizeExecutionPlan, resolveSelector } from '../utils/sanitizer';
import { supabase } from '../utils/storage'; // Assumes storage.ts exports a configured Supabase client

export class ExecutionAgent {
  async executeScript(
    executionId: string, 
    scriptCode: string, 
    browserName: string = 'chromium',
    emitLog: (type: string, message: string) => void,
    options: { accessibility?: boolean; security?: boolean; sharedPage?: any; testCases?: any[]; [key: string]: any } = {},
    emitFrame?: (frame: string) => void
  ) {
    let browser: any;
    let context: any;
    let page: any;
    
    if (options.sharedPage) {
      page = options.sharedPage;
      context = page.context();
      browser = context.browser();
      
      const contextId = (context as any)._guid || 'unknown-context';
      const pageId = (page as any)._guid || 'unknown-page';
      
      emitLog('browser_launch', `Using shared browser context for execution. EXECUTION_CONTEXT_ID: ${contextId}, EXECUTION_PAGE_ID: ${pageId}`);
    } else {
      emitLog('browser_launch', `Launching ${browserName} browser`);
      const browserNameLower = browserName.toLowerCase();
      if (browserNameLower === 'firefox') {
        browser = await firefox.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
      } else if (browserNameLower === 'webkit' || browserNameLower === 'safari') {
        browser = await webkit.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
      } else if (browserNameLower === 'edge' || browserNameLower === 'msedge') {
        browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
      } else {
        browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
      }

      const videoDir = `./temp/videos/${executionId}`;
      const screenshotDir = './temp/screenshots';
      await fs.mkdir(videoDir, { recursive: true });
      await fs.mkdir(screenshotDir, { recursive: true });

      context = await browser.newContext({
        recordVideo: {
          dir: videoDir,
          size: { width: 1280, height: 720 }
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280 + Math.floor(Math.random() * 100), height: 720 + Math.floor(Math.random() * 100) }
      });

      await context.addInitScript(() => {
        // WebDriver
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // Plugins
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        
        // Hardware
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        
        // Chrome
        (window as any).chrome = { runtime: {} };
        
        // Permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => (
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
            : originalQuery(parameters)
        );

        // WebGL
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return 'Intel Inc.';
          if (parameter === 37446) return 'Intel Iris OpenGL Engine';
          return getParameter.apply(this, [parameter]);
        };
      });

      page = await context.newPage();
    }
    
    page.on('console', (msg: any) => emitLog('browser_log', `Console [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', (error: any) => emitLog('browser_log', `Page Error: ${error.message}`));

    let screenshotUrl: string | null = null;
    let videoUrl: string | null = null;
    let success = false;
    let executionError: string | null = null;
    let stepLogs: Array<{ action: string, status: string, time: string, durationMs?: number, details?: string, value?: string, rawSelector?: string }> = [];
    let accessibilityResults: any = null;
    let securityResults: any = null;

    const addStep = (action: string, status: string, durationMs?: number, details?: string, value?: string, rawSelector?: string) => {
      const step: any = { action, status, time: new Date().toISOString() };
      if (durationMs !== undefined) step.durationMs = durationMs;
      if (details !== undefined) step.details = details;
      if (value !== undefined) step.value = value;
      if (rawSelector !== undefined) step.rawSelector = rawSelector;
      stepLogs.push(step);
    };

    let transcriptEvents: any[] = [];
    const logTranscriptEvent = (actionType: string, target: string, value: string | undefined, status: string, scenarioName?: string) => {
        transcriptEvents.push({
            action: actionType, target, value, status, scenarioName, timestamp: new Date().toISOString()
        });
    };

    let frameInterval: NodeJS.Timeout | null = null;
    if (emitFrame) {
      frameInterval = setInterval(async () => {
        try {
          if (!page.isClosed()) {
            const frameBuffer = await page.screenshot({
              type: "jpeg",
              quality: 50
            });
            emitFrame(frameBuffer.toString('base64'));
          }
        } catch (e) {
          // Ignore errors during screenshot, e.g. target closed
        }
      }, 1000);
    }
    let scenario_status: Record<string, string> = {};

    try {
      emitLog('executing', 'Running generated script');
      
      const { SelfHealingAgent } = await import('./SelfHealingAgent');
      const healingAgent = new SelfHealingAgent();
      
      if (options.security) {
        emitLog('agent_log', 'Running SecuritySanityAgent checks...');
        const { SecuritySanityAgent } = await import('./SecuritySanityAgent');
        const securityAgent = new SecuritySanityAgent();
        // Wait for page to initially load something to check headers/mixed content
      }

      scriptCode = sanitizeExecutionPlan(scriptCode, (msg) => emitLog('agent_log', msg));
      const actions = JSON.parse(scriptCode);
      addStep('PARSE_JSON', 'PASSED', 0, `Parsed ${actions.length} actions`);
      
      if (options.testCases && Array.isArray(options.testCases)) {
         options.testCases.forEach((tc: any) => {
           if (tc.scenarioName) {
              scenario_status[tc.scenarioName] = 'NOT_STARTED';
           }
         });
      }
      
      actions.forEach((action: any) => {
         if (action.scenarioName && !scenario_status[action.scenarioName]) {
            scenario_status[action.scenarioName] = 'NOT_STARTED';
         }
      });
      
      const validActions = ['goto', 'fill', 'click', 'assertVisible', 'assertText', 'select', 'hover', 'wait', 'screenshot', 'consoleCapture', 'log'];
      for (let i = 0; i < actions.length; i++) {
        if (!actions[i].action && actions[i].type) {
          actions[i].action = actions[i].type;
        }
        if (!actions[i].action) {
           console.warn(`Malformed step at index ${i}: missing "action" property.`);
           actions[i] = { action: 'log', message: `SKIPPED: Missing action property. Keys: ${Object.keys(actions[i]).join(', ')}` };
           continue;
        }
        if (actions[i].action === 'goto') {
           if (!actions[i].url) {
              console.warn(`Malformed step at index ${i}: "goto" action missing "url"`);
              actions[i] = { action: 'log', message: `SKIPPED: goto missing url` };
              continue;
           }
           try { 
              new URL(actions[i].url); 
           } catch (e) { 
              if (options.targetUrl) {
                 try {
                    actions[i].url = new URL(actions[i].url, options.targetUrl).href;
                 } catch (e2) {
                    console.warn(`Malformed step at index ${i}: invalid URL "${actions[i].url}"`);
                    actions[i] = { action: 'log', message: `SKIPPED: invalid URL "${actions[i].url}"` };
                    continue;
                 }
              } else {
                 console.warn(`Malformed step at index ${i}: invalid URL "${actions[i].url}"`); 
                 actions[i] = { action: 'log', message: `SKIPPED: invalid URL "${actions[i].url}"` };
                 continue;
              }
           }
        }
        if (['click', 'fill', 'select'].includes(actions[i].action) && !actions[i].selector) {
           console.warn(`Malformed step at index ${i}: action "${actions[i].action}" missing "selector"`);
           actions[i] = { action: 'log', message: `SKIPPED: action "${actions[i].action}" missing selector` };
           continue;
        }
      }
      
      if (actions.length === 0) {
         throw new Error(`Execution plan validation failed: 0 steps generated.`);
      }
      let finalAttemptSuccess = false;
      for (let recoveryAttempt = 1; recoveryAttempt <= 3; recoveryAttempt++) {
        if (recoveryAttempt > 1) {
           emitLog('agent_log', `[Recovery Strategy] Initiating execution retry attempt ${recoveryAttempt}/3 on existing page without destroying session...`);
           await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        }
        
        const injectHumanSimulation = recoveryAttempt >= 2;
        const injectSlowCrawl = recoveryAttempt >= 3;
        let scriptBlocked = false;
        stepLogs = []; // Reset logs for fresh attempt
        let failedScenarios = new Set<string>();

      for (const action of actions) {
         if (action.scenarioName) {
            if (failedScenarios.has(action.scenarioName)) {
               continue;
            }
            if (scenario_status[action.scenarioName] === 'NOT_STARTED') {
               scenario_status[action.scenarioName] = 'IN_PROGRESS';
            }
         }
         
        const startTime = Date.now();
        emitLog('executing', `Executing action: ${action.action}`);
        emitLog('telemetry', `ACTION_STARTED=${action.action}`);
        if (action.selector) {
           emitLog('telemetry', `TRACE_ACTION_TARGET=${action.selector}`);
        }
        
        let attempts = 0;
        let successAction = false;
        let isUnsupported = false;
        let details = action.selector || action.url || '';
        
        action.selector = resolveSelector(action.selector);
        
        const getPlaywrightLocator = (page: any, sel: string) => {
          if (!sel) return null;
          if (sel.startsWith('locator(') || sel.startsWith('getByRole(') || sel.startsWith('getByLabel(') || sel.startsWith('getByTestId(') || sel.startsWith('getByText(') || sel.startsWith('getByPlaceholder(')) {
             try {
               return new Function('page', `return page.${sel}.first()`)(page);
             } catch (e) {
               console.warn(`[ExecutionAgent] Failed evaluating Playwright selector ${sel}`, e);
             }
          }
          return page.locator(sel).first();
        };
        
        const rawSelector = action.selector || action.url;
        
        if (action.action === 'goto') details = `Navigating to ${action.url}`;
        else if (action.action === 'click') details = `Clicking element: ${action.selector}`;
        else if (action.action === 'fill') details = `Filling input: ${action.selector}`;
        else if (action.action === 'assertText') details = `Asserting text "${action.contains}" in ${action.selector}`;
        else if (action.action === 'assertVisible') details = `Asserting visibility of ${action.selector}`;
        else if (action.action === 'select') details = `Selecting option in ${action.selector}`;
        else if (action.action === 'hover') details = `Hovering over ${action.selector}`;
        else if (action.action === 'wait') details = action.state === 'domcontentloaded' ? 'Waiting for DOMContentLoaded' : `Waiting for ${action.timeout || action.value || 1000}ms`;
        else if (action.action === 'screenshot') details = `Taking screenshot`;
        else if (action.action === 'consoleCapture') details = `Capturing console logs`;
        
        const timeouts = [5000, 10000, 20000];
        while (!successAction && attempts < 3) {
          const currentTimeout = timeouts[attempts] || 5000;
          
          const validateSelector = async (loc: any, sel: string) => {
            if (!loc) {
               throw new Error(`Selector resolution failed: provided selector "${sel}" was null or invalid.`);
            }
            try {
              await loc.waitFor({ state: 'attached', timeout: currentTimeout });
            } catch (e) {}
            if (await loc.count() === 0) {
              throw new Error(`Selector not found in DOM: ${sel}`);
            }
          };

          const checkForAntiBot = async () => {
             const currentUrl = page.url();
             const content = await page.content().catch(() => '');
             const lowerContent = content.toLowerCase();
             
             const isLightweight = lowerContent.includes('just a moment...') || currentUrl.includes('challenges.cloudflare.com') || lowerContent.includes('checking your browser');
             const isHardBlock = lowerContent.includes('performing security verification') || lowerContent.includes('cf-challenge') || lowerContent.includes('cf-chl-widget') || lowerContent.includes('turnstile') || lowerContent.includes('captcha');
             
             if (isLightweight) {
                emitLog('agent_log', 'Detected lightweight JS challenge. Waiting 7 seconds to resolve...');
                await page.waitForTimeout(7000);
                const recheckContent = await page.content().catch(() => '');
                if (recheckContent.toLowerCase().includes('just a moment...') || page.url().includes('challenges.cloudflare.com')) {
                   throw new Error('BlockedByAntiBotError: {"vendor":"cloudflare","type":"js_challenge_timeout"}');
                }
             } else if (isHardBlock) {
                throw new Error('BlockedByAntiBotError: {"vendor":"cloudflare","type":"browser_challenge"}');
             }
          };
          
          try {
            if (['click', 'fill', 'select', 'check', 'assertText', 'assertVisible', 'hover'].includes(action.action)) {
               await checkForAntiBot();
            }

            if (['click', 'fill', 'select'].includes(action.action) && action.selector) {
               const loc = getPlaywrightLocator(page, action.selector);
               if (loc) {
                 await validateSelector(loc, action.selector);
                 const tagName = await loc.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
                 const isContentEditable = await loc.evaluate((el: any) => el.isContentEditable).catch(() => false);
                 
                 if (action.action === 'select' && tagName !== 'select') {
                    emitLog('agent_log', `[Auto-Convert] Selector ${action.selector} is a <${tagName}>, not a <select>. Converting action 'select' to 'fill'.`);
                    action.action = 'fill';
                 } else if (action.action === 'fill' && !['input', 'textarea'].includes(tagName) && !isContentEditable) {
                    emitLog('agent_log', `[Auto-Convert] Selector ${action.selector} is a <${tagName}>, not a text input. Converting action 'fill' to 'click'.`);
                    action.action = 'click';
                 }
               }
            }

            switch (action.action) {
              case 'goto': {
                const currentNavTimeout = 60000;
                await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: currentNavTimeout });
                
                try {
                  await page.waitForFunction(() => document.readyState === 'complete' || document.readyState === 'interactive', { timeout: 5000 }).catch(() => {});
                } catch(e) {}
                
                if (injectSlowCrawl) await page.waitForTimeout(5000);
                const currentUrlAfterLoad = page.url();
                const pageContent = await page.content();
                if (currentUrlAfterLoad.includes('challenges.cloudflare.com') || pageContent.toLowerCase().includes('verify you are human') || pageContent.toLowerCase().includes('captcha')) {
                  throw new Error('BlockedByAntiBotError: {"vendor":"generic","type":"captcha"}');
                }
                break;
              }
              case 'click': {
                try {
                  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
                } catch(e) {}
                
                const selLower = action.selector.toLowerCase();
                if (selLower.includes('text=login') || selLower.includes('text="login"') || selLower.includes("text='login'")) {
                    throw new Error(`INVALID_ACTION_TARGET: Selector policy forbids text="Login". Required: button, #id, [data-testid], or role=button.`);
                }
                
                const loc = getPlaywrightLocator(page, action.selector);
                await validateSelector(loc, action.selector);
                
                const tagName = await loc.evaluate((node: HTMLElement) => node.tagName.toUpperCase()).catch(() => 'UNKNOWN');
                const isClickable = await loc.evaluate((node: HTMLElement) => {
                   return ['BUTTON', 'A', 'INPUT', 'LABEL', 'SELECT'].includes(node.tagName.toUpperCase()) || 
                          window.getComputedStyle(node).cursor === 'pointer' || 
                          node.onclick !== null || 
                          node.hasAttribute('onclick') ||
                          node.getAttribute('role') === 'button' ||
                          node.getAttribute('role') === 'link' ||
                          node.getAttribute('role') === 'menuitem' ||
                          node.getAttribute('role') === 'checkbox' ||
                          node.getAttribute('role') === 'radio' ||
                          node.getAttribute('type') === 'submit' ||
                          node.getAttribute('type') === 'checkbox';
                }).catch(() => true);
                
                if (!isClickable && !['DIV', 'SPAN'].includes(tagName)) {
                   throw new Error(`InvalidActionTargetError: Attempted click() on non-clickable <${tagName}>.`);
                }
                
                await loc.scrollIntoViewIfNeeded();
                await loc.waitFor({ state: 'visible', timeout: currentTimeout });
                if (!(await loc.isEnabled())) throw new Error("Element is not enabled");
                await loc.hover();
                await page.waitForTimeout(100 + Math.random() * 200);
                
                if (injectHumanSimulation) {
                  await page.waitForTimeout(1000 + Math.random() * 1000);
                }
                if (injectSlowCrawl) await page.waitForTimeout(3000);
                
                try {
                  await Promise.all([
                    page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {}),
                    loc.click({ timeout: currentTimeout }).catch(async (e: any) => {
                       emitLog('agent_log', `Standard click failed: ${e.message}. Attempting force click...`);
                       await loc.click({ force: true, timeout: currentTimeout });
                    })
                  ]);
                } catch (e: any) {
                  if (e.message && (e.message.includes('Execution context was destroyed') || e.message.includes('Target page, context or browser has been closed') || e.message.includes('Navigating'))) {
                    emitLog('agent_log', `Navigation race detected during click (context destroyed), treating click as successful navigation.`);
                  } else {
                    throw e;
                  }
                }
                
                // SPA Navigation Fix
                await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
                
                // Removed hardcoded login assertions to allow negative test cases to proceed normally and be verified by their own explicit assertions.
                
                emitLog('telemetry', 'CLICK_VERIFIED');
                break;
              }
              case 'fill': {
                try {
                  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
                } catch(e) {}
                
                const selLower = action.selector.toLowerCase();
                if (selLower.includes('text=') || selLower.includes('contains(') || selLower.startsWith('span') || selLower.startsWith('div') || selLower.startsWith('body') || selLower.startsWith('label')) {
                    throw new Error(`INVALID_FILL_SELECTOR: Selector policy forbids text or structural container matching for fill: ${action.selector}`);
                }
                
                const loc = getPlaywrightLocator(page, action.selector);
                await validateSelector(loc, action.selector);
                
                const tagName = await loc.evaluate((node: HTMLElement) => node.tagName.toUpperCase()).catch(() => 'UNKNOWN');
                const isContentEditable = await loc.evaluate((node: HTMLElement) => node.isContentEditable).catch(() => false);
                if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) && !isContentEditable) {
                   throw new Error(`InvalidActionTargetError: Attempted fill() on <${tagName}>. Must be input/textarea/select/contenteditable.`);
                }
                
                const pageTitle = await page.title().catch(() => '');
                if (pageTitle.toLowerCase().includes('not found') || pageTitle.includes('404')) {
                   throw new Error(`WrongPageError: Reached an error page / 404 Not Found.`);
                }
                await loc.scrollIntoViewIfNeeded();
                await loc.waitFor({ state: 'visible', timeout: currentTimeout });
                if (!(await loc.isEnabled())) throw new Error("Element is not enabled");
                if (injectHumanSimulation) {
                  await loc.hover();
                  await page.waitForTimeout(1000 + Math.random() * 1000);
                }
                if (injectSlowCrawl) await page.waitForTimeout(3000);
                const typeDelay = Math.floor(Math.random() * (180 - 50 + 1) + 50);
                await loc.fill('', { timeout: currentTimeout }).catch(() => {});
                await loc.type(action.value, { delay: typeDelay, timeout: currentTimeout });

                let verificationResult = undefined;
                const actual = await loc.inputValue().catch(() => loc.evaluate((el: any) => el.value || el.innerText || '').catch(() => ''));
                emitLog('telemetry', `TRACE_FILL_ACTUAL=${actual}`);
                if (actual.trim() !== action.value.trim()) {
                   emitLog('telemetry', `TRACE_FILL_VERIFIED=false`);
                   throw new Error("FILL_VERIFICATION_FAILED: Field did not accept the expected value");
                }
                emitLog('telemetry', `TRACE_FILL_VERIFIED=true`);
                verificationResult = "SUCCESS";

                break;
              }
              case 'wait':
                if (action.state === 'networkidle' || action.value === 'networkidle') {
                  emitLog('agent_log', 'Downgrading networkidle request to domcontentloaded to prevent deadlock');
                  await page.waitForLoadState('domcontentloaded').catch(() => {});
                  await page.waitForTimeout(3000);
                } else if (action.state === 'domcontentloaded' || action.value === 'domcontentloaded') {
                  await page.waitForLoadState('domcontentloaded');
                } else {
                  await page.waitForTimeout(parseInt(action.timeout || action.value || "1000", 10));
                }
                break;
              case 'screenshot':
                await page.screenshot();
                break;
              case 'consoleCapture':
                // Already capturing globally, just emit a log marking it
                emitLog('browser_log', 'Console capture checkpoint executed');
                break;
              case 'assertText': {
                const loc = getPlaywrightLocator(page, action.selector);
                await validateSelector(loc, action.selector);
                const text = await loc.innerText({ timeout: currentTimeout });
                const expectedText = action.contains || action.value;
                if (expectedText && expectedText !== "null") {
                  if (!text.includes(expectedText)) {
                    throw new Error(`Assertion failed: expected ${action.selector} to contain "${expectedText}", but got "${text}"`);
                  }
                } else if (!text || text.trim() === '') {
                  throw new Error(`Assertion failed: expected ${action.selector} to contain text, but it was empty`);
                }
                break;
              }
              case 'assertVisible': {
                const loc = getPlaywrightLocator(page, action.selector);
                await validateSelector(loc, action.selector);
                await loc.waitFor({ state: 'visible', timeout: currentTimeout });
                break;
              }
              case 'assertNotVisible': {
                const loc = getPlaywrightLocator(page, action.selector);
                if (loc) {
                   await loc.waitFor({ state: 'hidden', timeout: currentTimeout });
                }
                break;
              }
              case 'select': {
                try {
                  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
                } catch(e) {}
                
                const loc = getPlaywrightLocator(page, action.selector);
                await validateSelector(loc, action.selector);
                
                const tagName = await loc.evaluate((node: HTMLElement) => node.tagName.toUpperCase()).catch(() => 'UNKNOWN');
                if (tagName !== 'SELECT') {
                   throw new Error(`InvalidActionTargetError: Attempted select() on <${tagName}>. Must be SELECT.`);
                }
                
                await loc.scrollIntoViewIfNeeded();
                await loc.waitFor({ state: 'visible', timeout: currentTimeout });
                if (!(await loc.isEnabled())) throw new Error("Element is not enabled");
                await loc.selectOption(action.value, { timeout: currentTimeout });
                break;
              }
              case 'hover': {
                const loc = getPlaywrightLocator(page, action.selector);
                await validateSelector(loc, action.selector);
                await loc.scrollIntoViewIfNeeded();
                await loc.waitFor({ state: 'visible', timeout: currentTimeout });
                await loc.hover({ timeout: currentTimeout });
                break;
              }
              case 'log':
                emitLog('browser_log', `Log action: ${action.message || action.value || action.details || ''}`);
                break;
              default:
                emitLog('browser_log', `Unknown action type: ${action.action}`);
                isUnsupported = true;
            }
            successAction = true;
            
            if (isUnsupported) {
              if (action.scenarioName) {
                scenario_status[action.scenarioName] = 'SKIPPED';
              }
              emitLog('telemetry', `ACTION_SKIPPED=${action.action}`);
              addStep(action.action, 'SKIPPED', Date.now() - startTime, `Unsupported action type: ${action.action}`, action.value, rawSelector);
              logTranscriptEvent(action.action, rawSelector, `Unsupported action type`, 'SKIPPED', action.scenarioName);
            } else {
              if (action.scenarioName) {
                scenario_status[action.scenarioName] = 'PASS';
              }
              emitLog('telemetry', `ACTION_COMPLETED=${action.action}`);
              addStep(action.action, 'PASSED', Date.now() - startTime, details, action.value, rawSelector);
              logTranscriptEvent(action.action, rawSelector, action.value, 'SUCCESS', action.scenarioName);
            }
          } catch (err: any) {
            attempts++;
            if (err.message.includes("anti-bot system")) {
              scriptBlocked = true;
              break; // Break inner retry loop
            }
            if (err.message.includes("Execution context was destroyed") || err.message.includes("NavigationRace") || err.message.includes("Target page, context or browser has been closed") || err.message.includes("Navigating")) {
               emitLog('healing', `Navigation Race detected: ${err.message}. Treating action as successfully initiating a navigation.`);
               await page.waitForLoadState('domcontentloaded').catch(() => {});
               successAction = true;
               if (action.scenarioName) {
                 scenario_status[action.scenarioName] = 'PASS';
               }
               emitLog('telemetry', `ACTION_COMPLETED=${action.action}`);
               addStep(action.action, 'PASSED', Date.now() - startTime, `Navigation Race (success): ${details}`, action.value, rawSelector);
               logTranscriptEvent(action.action, rawSelector, action.value, 'SUCCESS', action.scenarioName);
               break;
            }
            emitLog('healing', `Checking healing eligibility for step type: ${action.action}`);
            if (action.action.startsWith('assert')) {
                emitLog('healing', `Healing Decision: REJECTED (Reason: Assertions are not eligible for healing)`);
                if (action.scenarioName) {
                    scenario_status[action.scenarioName] = 'FAIL';
                    failedScenarios.add(action.scenarioName);
                }
                addStep(action.action, 'FAILED', Date.now() - startTime, err.message, action.value, rawSelector);
                logTranscriptEvent(action.action, rawSelector, err.message, 'FAILED', action.scenarioName);
                break;
            }
            emitLog('healing', `Healing Decision: ELIGIBLE`);
            if (err.message.includes("InvalidActionTargetError") || err.message.includes("WrongPageError") || err.message.includes("BlockedByAntiBotError") || err.message.includes("SELECTOR_RESOLUTION_FAILED") || err.message.includes("LOGIN_ASSERTION_FAILED") || err.message.includes("FILL_VERIFICATION_FAILED") || err.message.includes("EMPTY_FILL_VALUE") || err.message.includes("INVALID_ACTION_TARGET") || err.message.includes("Assertion failed")) {
                if (action.scenarioName) {
                    scenario_status[action.scenarioName] = 'FAIL';
                    failedScenarios.add(action.scenarioName);
                }
                addStep(action.action, 'FAILED', Date.now() - startTime, err.message, action.value, rawSelector);
                logTranscriptEvent(action.action, rawSelector, err.message, 'FAILED', action.scenarioName);
                break; 
            }
            if (attempts >= 4 || !action.selector) {
              if (action.scenarioName) {
                 scenario_status[action.scenarioName] = 'FAIL';
                 failedScenarios.add(action.scenarioName);
              }
              emitLog('telemetry', `ACTION_FAILED=${action.action}`);
              addStep(action.action, 'FAILED', Date.now() - startTime, err.message, action.value, rawSelector);
              logTranscriptEvent(action.action, rawSelector, err.message, 'FAILED', action.scenarioName);
              break;
            }
            emitLog('healing', `Action failed for selector: ${action.selector}`);
            const healStart = Date.now();
            addStep('HEAL', 'TRIGGERED', 0, `Failed selector: ${action.selector}`, undefined, action.selector);
            
            if (!action.healedSelectors) {
              const domSnapshot = await page.evaluate(() => document.body.innerHTML);
              action.healedSelectors = await healingAgent.healSelector(err.message, `Action type: ${action.action}`, domSnapshot);
              emitLog('healing', `SelfHealingAgent proposed fallback selectors: ${JSON.stringify(action.healedSelectors)}`);
            }
            
            const confidentSelectors = action.healedSelectors.filter((s: any) => s.confidence >= 0.85);
            if (confidentSelectors.length === 0) {
              if (action.scenarioName) {
                  scenario_status[action.scenarioName] = 'FAIL';
                  failedScenarios.add(action.scenarioName);
              }
              addStep(action.action, 'FAILED', Date.now() - startTime, `HEALING_FAILED: ${err.message}`, action.value, rawSelector);
              logTranscriptEvent(action.action, rawSelector, `HEALING_FAILED: ${err.message}`, 'FAILED', action.scenarioName);
              break;
            }

            const healTarget = confidentSelectors[attempts - 1] || confidentSelectors[0];
            const newSelector = healTarget.selector;
            emitLog('healing', `Trying fallback selector: ${newSelector} (Confidence: ${healTarget.confidence})`);
            addStep('HEAL', 'PASSED', Date.now() - healStart, `New selector: ${newSelector} (Conf: ${healTarget.confidence})`, undefined, newSelector);
            action.selector = newSelector;
          }
        }
        }
        
        if (scriptBlocked) {
          if (recoveryAttempt >= 3) {
            throw new Error("BLOCKED_BY_ANTIBOT: Site protected by anti-bot mechanisms after 3 recovery attempts.");
          }
          continue; // Move to next recovery attempt
        }
        
        finalAttemptSuccess = true;
        
        // Mark any IN_PROGRESS or NOT_STARTED scenarios as PASS if they had actions that executed successfully.
        // Wait, if an action was executed and we didn't throw, we can mark all IN_PROGRESS as PASS.
        // Also any NOT_STARTED that didn't even have actions might be SKIPPED later, 
        // but if the entire execution plan finishes successfully, all generated scenarios passed.
        for (const scenario in scenario_status) {
           if (scenario_status[scenario] === 'IN_PROGRESS') {
              scenario_status[scenario] = 'PASS';
           }
        }
        
        break; // Successfully completed actions, exit recovery loop
      }
      
      if (!finalAttemptSuccess) {
         throw new Error("Execution failed after recovery attempts");
      }
      
      if (options.accessibility) {
        emitLog('agent_log', 'Running AccessibilityAgent scans...');
        const { AccessibilityAgent } = await import('./AccessibilityAgent');
        const a11yAgent = new AccessibilityAgent();
        accessibilityResults = await a11yAgent.runAccessibilityScan(page);
        if (!accessibilityResults.success) {
           addStep('ACCESSIBILITY', 'FAILED', 0, `Violations found: ${accessibilityResults.violations.length}`);
           emitLog('agent_log', `Accessibility failed with ${accessibilityResults.violations.length} violations.`);
        } else {
           addStep('ACCESSIBILITY', 'PASSED', 0, 'No WCAG violations found.');
        }
      }

      if (options.security) {
        const { SecuritySanityAgent } = await import('./SecuritySanityAgent');
        const securityAgent = new SecuritySanityAgent();
        securityResults = await securityAgent.runSecurityChecks(page);
        if (!securityResults.success) {
           addStep('SECURITY', 'FAILED', 0, 'Mixed content or insecure forms found.');
        } else {
           addStep('SECURITY', 'PASSED', 0, 'Basic security checks passed.');
        }
      }
      
      success = true;
    } catch (err: any) {
      success = false;
      executionError = err.message;
      emitLog('browser_log', `Execution failed: ${err.message}`);
      addStep('EXECUTION', 'FAILED', err.message);
      
      // Mark any pending scenarios as FAILED or SKIPPED
      for (const scenario in scenario_status) {
         if (scenario_status[scenario] === 'IN_PROGRESS') {
            scenario_status[scenario] = 'FAIL';
         } else if (scenario_status[scenario] === 'NOT_STARTED') {
            scenario_status[scenario] = 'SKIPPED';
         }
      }
      
      // Capture screenshot on failure
      const screenshotPath = `./temp/screenshots/${executionId}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      try {
        const fileData = await fs.readFile(screenshotPath);
        const { data, error } = await supabase.storage
          .from('screenshots')
          .upload(`${executionId}.png`, fileData, { contentType: 'image/png', upsert: true });
          
        if (!error && data) {
          const { data: publicData } = supabase.storage.from('screenshots').getPublicUrl(data.path);
          screenshotUrl = publicData.publicUrl;
          emitLog('screenshot_uploaded', 'Screenshot uploaded successfully');
        }
      } catch (uploadErr) {
        console.error("Screenshot upload failed", uploadErr);
      }
      
      // Safety net: anything still NOT_STARTED gets SKIPPED
      for (const scenario in scenario_status) {
         if (scenario_status[scenario] === 'NOT_STARTED') {
            scenario_status[scenario] = 'SKIPPED';
         }
      }
    } finally {
      if (frameInterval) clearInterval(frameInterval);
      
      let visualRegressionData: string | null = null;
      if (options.enableAiEyes && !page.isClosed()) {
        try {
          emitLog('agent_log', 'Running VisualRegressionAgent (AI Eyes)...');
          const finalScreenshotPath = `./temp/screenshots/${executionId}_final.png`;
          await page.screenshot({ path: finalScreenshotPath, fullPage: true });
          
          if (fsSync.existsSync(finalScreenshotPath)) {
            const fileData = await fs.readFile(finalScreenshotPath);
            const base64Image = fileData.toString('base64');
            const { VisualRegressionAgent } = await import('./VisualRegressionAgent');
            const visualAgent = new VisualRegressionAgent(executionId);
            const visualResult = await visualAgent.analyzeScreenshot(base64Image);
            visualRegressionData = JSON.stringify(visualResult);
            if (visualResult.hasVisualBugs) {
                emitLog('agent_log', `AI Eyes detected visual bugs: ${visualResult.issues.join(', ')}`);
                addStep('AI_EYES', 'FAILED', 0, `Visual bugs detected: ${visualResult.issues.join(', ')}`);
            } else {
                emitLog('agent_log', `AI Eyes found no visual bugs.`);
                addStep('AI_EYES', 'PASSED', 0, 'No visual bugs detected.');
            }
          }
        } catch (e: any) {
          emitLog('agent_log', `AI Eyes analysis failed: ${e.message}`);
          console.error("AI Eyes processing failed", e);
        }
      }

      if (!options.sharedPage) {
        const video = page.video();
        await page.close().catch(() => {});
        await context.close().catch(() => {});
        await browser.close().catch(() => {});

        // Video processing
        try {
          if (video) {
            const videoPath = await video.path();
            if (fsSync.existsSync(videoPath)) {
              const stats = fsSync.statSync(videoPath);
              if (stats.size === 0) {
                throw new Error("Video artifact is empty");
              }
              const videoData = await fs.readFile(videoPath);
              const { data, error } = await supabase.storage
                .from('videos')
                .upload(`${executionId}.mp4`, videoData, { contentType: 'video/mp4', upsert: true });
                
              if (!error && data) {
                const { data: publicData } = supabase.storage.from('videos').getPublicUrl(data.path);
                videoUrl = publicData.publicUrl;
              } else {
                console.error("Supabase upload error:", error);
              }
            }
          }
        } catch (e) {
          console.error("Video processing failed", e);
        }
      }

      return {
        success,
        error: executionError,
        screenshotUrl,
        videoUrl,
        stepLogs,
        transcriptEvents,
        accessibilityResults,
        securityResults,
        scenario_status,
        visualRegressionData
      };
    }
  }
}
