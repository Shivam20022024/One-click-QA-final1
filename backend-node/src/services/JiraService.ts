import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export class JiraService {
  private baseUrl: string;
  private email: string;
  private apiToken: string;
  private projectKey: string;
  private issueType: string;

  constructor(baseUrl: string, email: string, apiToken: string, projectKey: string, issueType: string = 'Bug') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.email = email;
    this.apiToken = apiToken;
    this.projectKey = projectKey;
    this.issueType = issueType;
  }

  private getAuthHeader() {
    const token = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
    return {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/rest/api/3/project/${this.projectKey}`, {
        headers: this.getAuthHeader()
      });
      return response.status === 200;
    } catch (error: any) {
      console.error('[JiraService] testConnection failed:', error.message);
      return false;
    }
  }

  async healthCheck() {
    let jiraConnected = false;
    let projectVerified = false;
    let authenticationStatus = 'Failed';
    let availableProjects: any[] = [];
    
    try {
       const searchRes = await axios.get(`${this.baseUrl}/rest/api/3/project/search`, {
         headers: this.getAuthHeader()
       });
       if (searchRes.status === 200) {
         jiraConnected = true;
         authenticationStatus = 'Valid';
         availableProjects = searchRes.data?.values || searchRes.data || [];
       }
    } catch (e: any) {
      if (e.response?.status === 401 || e.response?.status === 403) {
         authenticationStatus = 'Invalid Credentials';
      }
    }

    if (jiraConnected) {
       try {
         const projRes = await axios.get(`${this.baseUrl}/rest/api/3/project/${this.projectKey}`, {
           headers: this.getAuthHeader()
         });
         if (projRes.status === 200) {
           projectVerified = true;
         }
       } catch (e: any) {
         projectVerified = false;
       }
    }
    
    return {
      jiraConnected,
      projectVerified,
      authenticationStatus,
      availableProjects: availableProjects.map((p: any) => ({ key: p.key, name: p.name }))
    };
  }

  async createIssue(summary: string, descriptionText: string): Promise<{ key: string; url: string } | null> {
    try {
      // Step 1 & 2: Verify Authentication (Basic Auth is used)
      let user;
      try {
        const myselfRes = await axios.get(`${this.baseUrl}/rest/api/3/myself`, {
          headers: this.getAuthHeader()
        });
        user = myselfRes.data;
        console.log("Authentication Successful");
        console.log("Authenticated User:\n" + (user.emailAddress || user.name || this.email));
      } catch (authErr: any) {
        throw new Error(`Authentication failed. Check API token and email. Status: ${authErr.response?.status}`);
      }

      // Step 4: Validate Project Access
      let project;
      try {
        const projRes = await axios.get(`${this.baseUrl}/rest/api/3/project/${this.projectKey}`, {
          headers: this.getAuthHeader()
        });
        project = projRes.data;
        console.log(`Project Verified:\n${this.projectKey}`);
      } catch (projErr: any) {
        console.error("Project access failed");
        
        // Step 5: Validate Project Discovery
        try {
          const searchRes = await axios.get(`${this.baseUrl}/rest/api/3/project/search`, {
            headers: this.getAuthHeader()
          });
          console.log("Available Jira Projects:", searchRes.data?.values || searchRes.data);
        } catch (searchErr) {
          console.error("Failed to fetch available projects");
        }
        
        throw new Error(`Project validation failed. Project key '${this.projectKey}' may be invalid or missing permissions.`);
      }

      // Step 6: Validate Issue Types
      let finalIssueType = this.issueType || 'Task';
      let issueTypesData: any[] = [];
      try {
        const typeRes = await axios.get(`${this.baseUrl}/rest/api/3/issuetype`, {
          headers: this.getAuthHeader()
        });
        issueTypesData = typeRes.data;
        const typeNames = issueTypesData.map((t: any) => t.name);
        console.log("Issue Types:\n" + typeNames.join('\n'));
        if (finalIssueType === 'Bug' && !typeNames.includes('Bug')) {
          finalIssueType = 'Task';
        }
      } catch (typeErr: any) {
        console.error("Failed to fetch issue types");
      }

      // Step 7: Improve Logging
      console.log("Auth Test Result");
      console.log("User:", user);
      console.log("Project Test Result");
      console.log("Project:", project);
      console.log("Issue Types:");
      console.log(issueTypesData);

      const payload = {
        fields: {
          project: {
            key: this.projectKey
          },
          summary: summary,
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: descriptionText
                  }
                ]
              }
            ]
          },
          issuetype: {
            name: finalIssueType
          }
        }
      };

      console.log("JIRA BASE URL:", this.baseUrl);
      console.log("PROJECT KEY:", this.projectKey);
      console.log("ISSUE TYPE:", finalIssueType);
      console.log("AUTH USER:", this.email);
      console.log("PAYLOAD:", JSON.stringify(payload, null, 2));

      console.log("Creating Issue...");
      const response = await axios.post(`${this.baseUrl}/rest/api/3/issue`, payload, {
        headers: this.getAuthHeader()
      });

      const key = response.data.key;
      const url = `${this.baseUrl}/browse/${key}`;
      console.log(`Issue Created:\n${key}`);
      return { key, url };
    } catch (error: any) {
      console.error('[JiraService] createIssue failed:', error.response?.data || error.message);
      return null;
    }
  }

  async attachFile(issueKey: string, filePath: string, filename: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`[JiraService] File not found: ${filePath}`);
        return false;
      }

      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), { filename });

      const headers = {
        'Authorization': this.getAuthHeader().Authorization,
        'X-Atlassian-Token': 'no-check',
        ...formData.getHeaders()
      };

      const response = await axios.post(`${this.baseUrl}/rest/api/3/issue/${issueKey}/attachments`, formData, {
        headers
      });

      return response.status === 200;
    } catch (error: any) {
      console.error('[JiraService] attachFile failed:', error.response?.data || error.message);
      return false;
    }
  }
}
