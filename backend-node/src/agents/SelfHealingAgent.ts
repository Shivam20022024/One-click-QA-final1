import { PromptTemplate } from '@langchain/core/prompts';
import { getModel, invokeWithRetry } from './llm';

const prompt = PromptTemplate.fromTemplate(`
You are a Self-Healing QA Agent. 
A test execution just failed because of an invalid selector or changed DOM structure.
Analyze the provided error message, the target element description, and the current DOM snapshot.
Propose a new robust Playwright selector that will fix the test.

Use the following prioritized fallback strategies:
1. Playwright Text Locators (getByText, text=)
2. Playwright Role/Label Locators (getByRole, getByLabel)
3. Data attributes ([data-testid=])
4. ID attributes (#login-button)
5. Visible Semantic CSS

Error Message: {errorMessage}
Target Element Description: {elementDesc}
Current DOM Snapshot:
{domSnapshot}

Output ONLY a valid JSON array of up to 3 objects. Do not include markdown codeblocks.
Each object must have:
- "selector": string (the proposed Playwright selector)
- "confidence": number (between 0.0 and 1.0, representing your confidence that this selector is exactly the same semantic element as the original)

Example: [{{"selector": "#login-button", "confidence": 0.95}}, {{"selector": "button[type=submit]", "confidence": 0.70}}]
`);

export class SelfHealingAgent {
  private executionId: string | undefined;

  constructor(executionId?: string) {
    this.executionId = executionId;
  }
  async healSelector(errorMessage: string, elementDesc: string, domSnapshot: string): Promise<any[]> {
    const llm = getModel('cheap');
    const chain = prompt.pipe(llm);
    const context = this.executionId ? { executionId: this.executionId, agentName: 'SelfHealingAgent', promptType: 'healSelector' } : undefined;
    const response = await invokeWithRetry(chain, { errorMessage, elementDesc, domSnapshot: domSnapshot.substring(0, 12000) }, 4000, ['domSnapshot'], context);
    let content = response.content as string;
    if (content.startsWith('```json')) content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
    else if (content.startsWith('```')) content = content.replace(/^```\n/, '').replace(/\n```$/, '');
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return parsed;
      }
      return parsed.map((sel: string) => ({ selector: sel, confidence: 0.5 }));
    } catch (e) {
      return [{ selector: content, confidence: 0.5 }];
    }
  }
}
