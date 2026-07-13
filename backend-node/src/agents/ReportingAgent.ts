import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { supabase } from '../utils/storage';
import { z } from 'zod';

const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.2,
  modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
});

const reportSchema = z.object({
  status: z.string().describe("The final execution status: PASSED, FAILED, or BLOCKED"),
  ai_summary: z.string().describe("Human-readable AI summary of the run and its key outcomes"),
  reason: z.string().nullable().describe("AI diagnosis of the execution result or failure reason"),
  health_score: z.number().describe("Execution health score out of 100 based on completion and stability"),
  ai_confidence_score: z.number().describe("AI confidence score (0-100) in its interaction accuracy and analysis"),
  interaction_success_rate: z.number().describe("Percentage (0-100) of successful UI interactions without retries/failures"),
  dom_stability: z.string().describe("Assessment of page DOM stability (e.g., 'High', 'Medium', 'Low')"),
  validation_results: z.array(z.string()).describe("Checklist of validation outcomes, e.g., 'Login page accessible', 'Password field detected'"),
  url: z.string().describe("Target URL tested, if available"),
  duration: z.number().describe("Execution duration in seconds"),
  browser: z.string().describe("Browser used for execution"),
  environment: z.string().describe("Execution environment (e.g., Local, CI/CD, Remote)"),
  workflow: z.string().describe("Name of the executed test suite or workflow"),
  recommendations: z.array(z.string()).describe("Actionable recovery suggestions or optimization insights"),
  timeline: z.array(
    z.object({
      time: z.string(),
      event: z.string(),
      status: z.string().describe("SUCCESS, FAILED, WAITING, etc.")
    })
  ).describe("Sequential timeline of key execution events for visual presentation"),
  detected_issues: z.array(z.string()).nullable().describe("List of detected network errors, warnings, or page issues"),
  screenshot_analysis: z.string().nullable().describe("Summary of the visible UI state if applicable"),
  markdown_report: z.string().nullable().describe("A clean markdown formatted report summarizing the execution"),
});

const prompt = PromptTemplate.fromTemplate(`
You are an expert QA Reporting Agent. 
Generate a comprehensive structured JSON execution report based STRICTLY on actual executed actions and telemetry.
Ensure to provide rich enterprise-grade insights (summaries, checklists, confidence scores) for BOTH successful and failed runs.

Test Name: {testName}
Status: {status}
Browser: {browser}
Environment: {environment}
Error (if any): {error}
Execution Time: {duration}s
Target URL: {url}

Test Metadata:
{testMetadata}

Artifacts:
Screenshot URL: {screenshotUrl}
Video URL: {videoUrl}

Executed Step Logs (Actual Telemetry):
{executedSteps}

General Logs / Errors:
{logs}

Analyze the logs carefully to:
1. Generate a human-readable AI summary.
2. Produce a checklist of validation results.
3. Calculate confidence, interaction success rate, and DOM stability.
4. Construct a clear timeline of events from the logs.
5. Provide optimization recommendations (even if successful).
`);

export class ReportingAgent {
  async generateReport(executionId: string, data: any) {
    const errorMsg = (data.error || '').toUpperCase();
    const isInfraFailure = errorMsg.includes('ETIMEDOUT') ||
                           errorMsg.includes('ENOTFOUND') ||
                           errorMsg.includes('ECONNREFUSED') ||
                           errorMsg.includes('CONNECTION CLOSED') ||
                           errorMsg.includes('REDIS CONNECTION FAILED') ||
                           errorMsg.includes('BULLMQ WORKER CONNECTION FAILED') ||
                           errorMsg.includes('UPSTASH CONNECTION FAILED');

    if (isInfraFailure) {
      const infraReport = {
        status: "FAILED",
        ai_summary: "Infrastructure failure: BullMQ worker could not connect to Redis.",
        reason: `Root Cause:\nBullMQ worker could not connect to Redis.\n\nError: ${data.error}\n\nReason:\nRedis host unavailable, DNS resolution failed, or network timeout occurred.`,
        health_score: 0,
        ai_confidence_score: 100,
        interaction_success_rate: 0,
        dom_stability: "N/A",
        validation_results: [
            "Infrastructure Failure",
            "Issue Type: Queue / Redis Connectivity",
            "Owner: Platform Team",
            "Priority: Critical",
            "Impact: Test execution never started. No Playwright scripts executed. No website validation performed. No accessibility scan performed. No security scan performed. No reliable application quality assessment available.",
            "FINAL RELEASE DECISION: Status: EXECUTION BLOCKED, Environment: Unknown, Production: NOT EVALUATED, Reason: Infrastructure failure prevented execution., Website Tested: NO, Execution Started: NO, Release Recommendation: Cannot determine application quality until Redis connectivity is restored."
        ],
        url: data.url || 'Unknown URL',
        duration: data.duration || 0,
        browser: data.browser || 'Chromium',
        environment: data.environment || 'Local',
        workflow: data.testName || 'Unknown Workflow',
        recommendations: [
            "Recommended Fix:",
            "1. Verify Redis host URL.",
            "2. Verify Upstash Redis database exists.",
            "3. Verify Redis credentials.",
            "4. Verify .env configuration.",
            "5. Verify internet connectivity.",
            "6. Test Redis connection using PING.",
            "7. Restart BullMQ workers."
        ],
        timeline: [
            { time: new Date().toISOString(), event: "Infrastructure Failure Detected", status: "FAILED" }
        ],
        detected_issues: ["Queue / Redis Connectivity Error"],
        screenshot_analysis: null,
        markdown_report: `
## ROOT CAUSE ANALYSIS

**Root Cause:**
BullMQ worker could not connect to Redis.

**Error:**
${data.error}

**Reason:**
Redis host unavailable, DNS resolution failed, or network timeout occurred.

---

## BUSINESS IMPACT

**Impact:**
* Test execution never started.
* No Playwright scripts executed.
* No website validation performed.
* No accessibility scan performed.
* No security scan performed.
* No reliable application quality assessment available.

---

## DEVELOPER ACTIONS

**Recommended Fix:**
1. Verify Redis host URL.
2. Verify Upstash Redis database exists.
3. Verify Redis credentials.
4. Verify .env configuration.
5. Verify internet connectivity.
6. Test Redis connection using PING.
7. Restart BullMQ workers.

---

## FINAL RELEASE DECISION

**Status:** EXECUTION BLOCKED
**Environment:** Unknown
**Production:** NOT EVALUATED
**Reason:** Infrastructure failure prevented execution.
**Website Tested:** NO
**Execution Started:** NO
**Release Recommendation:** Cannot determine application quality until Redis connectivity is restored.
`
      };

      try {
        const jsonContent = JSON.stringify(infraReport, null, 2);
        const { data: uploadData, error } = await supabase.storage
          .from('reports')
          .upload(`${executionId}.json`, Buffer.from(jsonContent, 'utf-8'), { contentType: 'application/json', upsert: true });
          
        if (!error && uploadData) {
          const { data: publicData } = supabase.storage.from('reports').getPublicUrl(uploadData.path);
          return { content: infraReport, url: publicData.publicUrl, isJson: true };
        }
        return { content: infraReport, url: null, isJson: true };
      } catch (e) {
        console.error('Failed to generate or upload infra failure report', e);
        return { content: infraReport, url: null, isJson: true };
      }
    }

    const isSupabaseInfraFailure = errorMsg.includes('UND_ERR_CONNECT_TIMEOUT') ||
                                   errorMsg.includes('CONNECTTIMEOUTERROR') ||
                                   errorMsg.includes('SUPABASE AUTH ERROR') ||
                                   errorMsg.includes('FETCH FAILED') ||
                                   errorMsg.includes('COULD NOT RENEW LOCK') ||
                                   errorMsg.includes('LOCK RENEWAL FAILURE');

    if (isSupabaseInfraFailure) {
      const supabaseInfraReport = {
        status: "FAILED",
        ai_summary: "Infrastructure failure: Supabase authentication service could not be reached within configured timeout limits.",
        reason: `Root Cause:\nSupabase authentication service could not be reached within configured timeout limits.\n\nError: ${data.error}`,
        health_score: 0,
        ai_confidence_score: 100,
        interaction_success_rate: 0,
        dom_stability: "N/A",
        validation_results: [
            "Infrastructure Failure",
            "Issue Type: Supabase Connectivity",
            "Owner: Platform Team",
            "Priority: Critical",
            "Impact: User authentication unavailable. Test execution interrupted. BullMQ worker lock expired. Results cannot be trusted.",
            "FINAL RELEASE DECISION: Status: EXECUTION BLOCKED, Website Tested: NO, Authentication Available: NO, Execution Valid: NO, Recommendation: Resolve Supabase connectivity before executing tests again."
        ],
        url: data.url || 'Unknown URL',
        duration: data.duration || 0,
        browser: data.browser || 'Chromium',
        environment: data.environment || 'Local',
        workflow: data.testName || 'Unknown Workflow',
        recommendations: [
            "Recommendation: Resolve Supabase connectivity before executing tests again."
        ],
        timeline: [
            { time: new Date().toISOString(), event: "Infrastructure Failure Detected", status: "FAILED" }
        ],
        detected_issues: ["Supabase Connectivity Error"],
        screenshot_analysis: null,
        markdown_report: `
## ROOT CAUSE ANALYSIS

**Root Cause:**
Supabase authentication service could not be reached within configured timeout limits.

**Error:**
${data.error}

---

## BUSINESS IMPACT

**Impact:**
* User authentication unavailable
* Test execution interrupted
* BullMQ worker lock expired
* Results cannot be trusted

---

## FINAL RELEASE DECISION

**Status:** EXECUTION BLOCKED
**Website Tested:** NO
**Authentication Available:** NO
**Execution Valid:** NO
**Recommendation:** Resolve Supabase connectivity before executing tests again.
`
      };

      try {
        const jsonContent = JSON.stringify(supabaseInfraReport, null, 2);
        const { data: uploadData, error } = await supabase.storage
          .from('reports')
          .upload(`${executionId}.json`, Buffer.from(jsonContent, 'utf-8'), { contentType: 'application/json', upsert: true });
          
        if (!error && uploadData) {
          const { data: publicData } = supabase.storage.from('reports').getPublicUrl(uploadData.path);
          return { content: supabaseInfraReport, url: publicData.publicUrl, isJson: true };
        }
        return { content: supabaseInfraReport, url: null, isJson: true };
      } catch (e) {
        console.error('Failed to generate or upload infra failure report', e);
        return { content: supabaseInfraReport, url: null, isJson: true };
      }
    }

    const structuredLlm = llm.withStructuredOutput(reportSchema);
    const chain = prompt.pipe(structuredLlm);
    
    try {
      const response = await chain.invoke({
        testName: data.testName || 'Unknown Workflow',
        status: data.status || 'UNKNOWN',
        error: data.error || 'None',
        duration: data.duration || 0,
        browser: data.browser || 'Chromium',
        environment: data.environment || 'Local',
        url: data.url || 'Unknown URL',
        testMetadata: data.testMetadata || '',
        executedSteps: data.executedSteps || '[]',
        logs: data.logs || '',
        screenshotUrl: data.screenshotUrl || 'No screenshot recorded',
        videoUrl: data.videoUrl || 'No video recorded'
      });
      
      const jsonContent = JSON.stringify(response, null, 2);

      // Upload JSON report to Supabase Storage
      const { data: uploadData, error } = await supabase.storage
        .from('reports')
        .upload(`${executionId}.json`, Buffer.from(jsonContent, 'utf-8'), { contentType: 'application/json', upsert: true });
        
      if (!error && uploadData) {
        const { data: publicData } = supabase.storage.from('reports').getPublicUrl(uploadData.path);
        return { content: response, url: publicData.publicUrl, isJson: true };
      }
      
      return { content: response, url: null, isJson: true };
    } catch (e) {
      console.error('Failed to generate or upload report', e);
      return { content: null, url: null, isJson: false };
    }
  }
}

