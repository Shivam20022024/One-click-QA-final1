import { PromptTemplate } from '@langchain/core/prompts';
import { getModel, invokeWithRetry } from './llm';
import { z } from 'zod';

export class ScriptGenerationAgent {
  private executionId: string | undefined;

  constructor(executionId?: string) {
    this.executionId = executionId;
  }
  async generateScript(testName: string, steps: any[], isContinuation: boolean = false): Promise<string> {
    const jsonSchema = {
      type: "object",
      properties: {
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              actionType: { type: "string" },
              target: { type: ["string", "null"] },
              value: { type: ["string", "null"] },
              assertion: { type: ["string", "null"] },
              scenarioName: { type: ["string", "null"] }
            },
            required: ["actionType", "target", "value", "assertion", "scenarioName"],
            additionalProperties: false
          }
        }
      },
      required: ["actions"],
      additionalProperties: false
    };
    const llm = getModel('planner').withStructuredOutput(jsonSchema, { name: "ScriptGeneration", strict: true });
    const CHUNK_SIZE = 5;
    let allActions: any[] = [];
    
    // Extract and compress DOM Summary out of the repeated steps
    let commonDomContext = "";
    const preprocessedSteps = steps.map(step => {
       if (typeof step === 'string') {
          const domIdx = step.indexOf('DOM Summary:');
          if (domIdx !== -1) {
             if (!commonDomContext) {
                 const rawDom = step.substring(domIdx + 12).trim();
                 commonDomContext = rawDom;
             }
             return step.substring(0, domIdx).trim();
          }
       }
       return step;
    });

    for (let i = 0; i < preprocessedSteps.length; i += CHUNK_SIZE) {
      const chunkSteps = preprocessedSteps.slice(i, i + CHUNK_SIZE);
      const chunkIsContinuation = isContinuation || i > 0;
      
      const generateScriptPrompt = PromptTemplate.fromTemplate(`
Generate Playwright actions (JSON array) for {testName}.
RULES:
1. WAIT: ALWAYS wait/assertVisible before interacting. Wait after submits.
2. SELECTORS & ACTION TYPES: Prioritize robust Playwright locators wrapped in case-insensitive regex! 
Example 1 (Clicks): If the step says "Click Submit", set actionType="click" and target="getByRole('button', {{ name: /Submit/i }})". 
Example 2 (Fills): If the step says "Fill Name", set actionType="fill" and target="getByPlaceholder(/Name/i)". 
CRITICAL: Extract the EXACT text from the provided steps. DO NOT hallucinate generic names! You MAY use exact CSS selectors like [data-test="..."] or #id ONLY IF explicitly listed in the DOM Selector Summary.
3. FORMS: Map semantic fields logically. NEVER call fill() on a 'form' element itself. CRITICAL: YOU MUST INCLUDE BOTH USERNAME AND PASSWORD ACTIONS IF SPECIFIED.
4. STATE & PREREQUISITES: Assume the browser is already where the previous step left off. CRITICAL: If the text says "Navigate to" or "Go to", you MUST use 'click' actions on UI links/buttons to navigate. NEVER generate 'goto' actions mid-test, as this resets the session!
5. ASSERTIONS: Use regex for assertions to avoid exact match failures (e.g., 'getByText(/Success|Thank you/i)'). For removed elements, use assertNotVisible. Do NOT invent custom 'Success notification' string matchers unless you use a valid selector.
6. VALID TYPES: goto, click, fill, wait, screenshot, assertText, assertVisible, assertNotVisible, select, hover.
7. FILL ACTIONS: When generating a 'fill' action, you MUST provide the text to be typed in the 'value' field. NEVER leave 'value' null for a 'fill' action!
${chunkIsContinuation ? "CONTINUATION: Browser open/logged in. NO 'goto' to the root unless explicitly requested. Begin interactions." : ""}

DOM Selector Summary:
{domContext}

Steps JSON: {stepsJson}
`);
      const chain = generateScriptPrompt.pipe(llm);
      const context = this.executionId ? { executionId: this.executionId, agentName: 'ScriptGenerationAgent', promptType: 'generateScript' } : undefined;
      let expectedBatchSize = chunkSteps.length;
      let targetSteps = [...chunkSteps];
      let collectedActions: any[] = [];
      let success = false;
      let attempt = 0;
      
      while (attempt < 2 && !success) {
          try {
            const trimmedSteps = targetSteps.map(step => typeof step === 'string' ? step.substring(0, 4000) + (step.length > 4000 ? '...[TRUNCATED]' : '') : step);
            const stepsStr = JSON.stringify(trimmedSteps, null, 2);

            let currentDomContext = commonDomContext;
            const promptEstimate = (stepsStr.length + currentDomContext.length) / 4;
            if (promptEstimate > 2000) {
                const maxDomLength = Math.max(100, 8000 - stepsStr.length);
                if (currentDomContext.length > maxDomLength) {
                    currentDomContext = currentDomContext.substring(0, maxDomLength) + '\n...';
                }
            }

            const response = await invokeWithRetry(chain, {
              testName,
              domContext: currentDomContext,
              stepsJson: stepsStr,
            }, 8000, ['stepsJson', 'domContext'], context);
            
             if (response && response.actions) {
               const mappedActions = response.actions.map((a: any) => {

                   let finalActionType = a.actionType;
                   if (chunkIsContinuation && finalActionType === 'goto') {
                       console.log(`[ScriptGenerationAgent] Stripping rogue goto action in continuation chunk: ${a.target}`);
                       finalActionType = 'wait';
                   }

                   return {
                       scenarioName: a.scenarioName,
                       action: finalActionType,
                       url: finalActionType === 'goto' ? a.target : null,
                       selector: finalActionType !== 'goto' ? a.target : null,
                       value: a.value === "null" ? null : a.value,
                       contains: a.assertion === "null" ? null : a.assertion,
                       state: 'domcontentloaded',
                       timeout: 10000
                   };
               });
               const incomingScenarios = new Set(mappedActions.map((a: any) => a.scenarioName).filter(Boolean));
               collectedActions = collectedActions.filter(a => !incomingScenarios.has(a.scenarioName));
               collectedActions.push(...mappedActions);
            }
            
            const collectedScenarios = new Set(collectedActions.map((a: any) => a.scenarioName).filter(Boolean));
            const actualBatchSize = collectedScenarios.size;
            
            if (actualBatchSize < expectedBatchSize) {
               console.log(`[ScriptGenerationAgent]\nBATCH=${Math.floor(i/CHUNK_SIZE)}\nEXPECTED=${expectedBatchSize}\nACTUAL=${actualBatchSize}\nRETRYING=${attempt === 0}`);
               console.log(`[ScriptGenerationAgent] SCRIPT_BATCH_INDEX=${Math.floor(i/CHUNK_SIZE)} SCRIPT_BATCH_EXPECTED=${expectedBatchSize} SCRIPT_BATCH_ACTUAL=${actualBatchSize} SCRIPT_BATCH_RETRY=${attempt === 0}`);
               
               if (attempt === 0) {
                  attempt++;
                  targetSteps = chunkSteps.filter(step => {
                      if (typeof step === 'string') {
                          const match = step.match(/Scenario Name:\s*(.*)/);
                          if (match && match[1]) {
                             return !collectedScenarios.has(match[1].trim());
                          }
                      }
                      return true;
                  });
                  continue;
               } else {
                  throw new Error(JSON.stringify({
                    status: "FAILED",
                    reason: "PARTIAL_SCRIPT_GENERATION_RESPONSE",
                    expected: expectedBatchSize,
                    actual: actualBatchSize
                  }));
               }
            }
            success = true;
          } catch (err: any) {
            if (err.message && (err.message.includes('400') || err.message.includes('schema') || err.message.includes('response_format'))) {
              throw new Error('DeterministicSchemaValidationError: LLM schema validation failed (400). Aborting batch generation immediately to prevent orchestration loops.');
            }
            if (err.message && err.message.includes('PARTIAL_SCRIPT_GENERATION_RESPONSE')) {
               throw new Error(err.message);
            }
            throw err;
          }
      }

      if (collectedActions.length > 0) {
        allActions.push(...collectedActions);
      }
    }

    const authMatches = steps.map(s => {
        if (typeof s !== 'string') return null;
        // Match either quotes or stop at comma/parenthesis
        const userMatch = s.match(/Username:\s*['"]?([^'",\)\s]+)/i);
        const passMatch = s.match(/Password:\s*['"]?([^'",\)\s]+)/i);
        if (userMatch && passMatch) {
             return [null, userMatch[1], passMatch[1]];
        }
        return null;
    }).filter(Boolean);
    
    if (authMatches.length > 0 && authMatches[0]) {
        const username = authMatches[0][1] ? authMatches[0][1].trim() : '';
        const password = authMatches[0][2] ? authMatches[0][2].trim() : '';
        const hasUserFill = allActions.some((a: any) => (a.action === 'fill' || a.actionType === 'fill') && a.value === username);
        const hasPassFill = allActions.some((a: any) => (a.action === 'fill' || a.actionType === 'fill') && a.value === password);
        if (!hasUserFill || !hasPassFill) {
            throw new Error(`MISSING_REQUIRED_CREDENTIAL_ACTIONS: Generated script is missing required fill actions for username (${username}) or password (${password}). Actions found: ${JSON.stringify(allActions.filter((a: any) => a.action === 'fill'))}`);
        }
    }

    if (allActions.length === 0 && steps.length > 0) {
      throw new Error('EMPTY_SCENARIO_ACTIONS: Scenario parsed but zero actions generated.');
    }

    return JSON.stringify(allActions);
  }
}
