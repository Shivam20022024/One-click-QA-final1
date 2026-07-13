export class ScenarioParser {
  /**
   * Parses a raw natural language scenario into structured execution JSON,
   * injecting dynamic data where appropriate.
   */
  static parse(rawText) {
    if (!rawText || !rawText.trim()) return null;

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
    const steps = [];

    for (let line of lines) {
      if (line.startsWith('#') || line.startsWith('//')) continue;
      
      // Clean bullet points
      line = line.replace(/^-\s*/, '');

      let parsedStep = null;
      const lower = line.toLowerCase();

      // Dynamic data generation
      const futureDate = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]; // 7 days from now
      const randomEmail = `test_${Math.floor(Math.random() * 100000)}@example.com`;
      const validUser = "testuser";
      const invalidPassword = "invalid_password_123!";

      // Pattern Matching
      if (lower.includes('search') && lower.includes('in')) {
        const match = line.match(/search (.*) in (.*)/i) || line.match(/search for (.*) in (.*)/i);
        if (match) {
          parsedStep = { type: 'search', target: match[1], value: match[2] };
        } else {
          parsedStep = { type: 'search', value: line };
        }
      } 
      else if (lower.includes('future date') || lower.includes('future check-in')) {
        parsedStep = { type: 'date_selection', strategy: 'dynamic_future', value: futureDate, description: line };
      }
      else if (lower.includes('random email')) {
        parsedStep = { type: 'fill', strategy: 'random_email', value: randomEmail, description: line };
      }
      else if (lower.includes('valid user')) {
        parsedStep = { type: 'fill', strategy: 'valid_user', value: validUser, description: line };
      }
      else if (lower.includes('invalid password')) {
        parsedStep = { type: 'fill', strategy: 'invalid_password', value: invalidPassword, description: line };
      }
      else if (lower.includes('verify') || lower.includes('assert')) {
        parsedStep = { type: 'assertion', expected: 'results_visible', description: line };
      }
      else if (lower.includes('click') || lower.includes('select') || lower.includes('open') || lower.includes('apply')) {
        parsedStep = { type: 'click', description: line };
      }
      else if (lower.includes('navigate') || lower.includes('return')) {
        parsedStep = { type: 'navigate', description: line };
      }
      else {
        // Fallback generic step
        parsedStep = { type: 'generic_action', description: line };
      }

      steps.push(parsedStep);
    }

    return steps;
  }
}
