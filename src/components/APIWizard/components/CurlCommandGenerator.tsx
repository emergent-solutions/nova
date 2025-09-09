import React, { useState } from 'react';
import {
  Card,
  Button,
  Code,
  Tabs,
  Tab,
  Icon,
  Intent,
  Classes,
  Toaster,
  Position
} from '@blueprintjs/core';

// Create toaster instance for notifications
const AppToaster = Toaster.create({
  position: Position.TOP
});

interface CurlCommandGeneratorProps {
  endpoint: {
    slug: string;
    authentication?: any;
  };
  baseUrl?: string;
}

export const CurlCommandGenerator: React.FC<CurlCommandGeneratorProps> = ({ 
  endpoint, 
  baseUrl = window.location.origin 
}) => {
  const [activeTab, setActiveTab] = useState<string>('curl');
  
  const generateCurlCommand = (): string => {
    const url = `${baseUrl}/api/${endpoint.slug}`;
    const auth = endpoint.authentication;
    
    if (!auth?.required) {
      return `curl "${url}"`;
    }

    let command = `curl`;
    
    switch (auth.type) {
      case 'api_key':
        const headerName = auth.config?.header_name || 'X-API-Key';
        command += ` -H "${headerName}: YOUR_API_KEY"`;
        break;
        
      case 'bearer':
        command += ` -H "Authorization: Bearer YOUR_TOKEN"`;
        break;
        
      case 'basic':
        command += ` -u "username:password"`;
        break;
        
      case 'custom':
        command += ` -H "Authorization: YOUR_CUSTOM_TOKEN"`;
        break;
    }
    
    command += ` \\\n  "${url}"`;
    
    return command;
  };

  const generateJavaScriptCode = (): string => {
    const url = `${baseUrl}/api/${endpoint.slug}`;
    const auth = endpoint.authentication;
    
    let headers = '';
    
    if (auth?.required) {
      switch (auth.type) {
        case 'api_key':
          const headerName = auth.config?.header_name || 'X-API-Key';
          headers = `    '${headerName}': 'YOUR_API_KEY'`;
          break;
          
        case 'bearer':
          headers = `    'Authorization': 'Bearer YOUR_TOKEN'`;
          break;
          
        case 'basic':
          const credentials = btoa('username:password');
          headers = `    'Authorization': 'Basic ${credentials}'`;
          break;
      }
    }
    
    return `fetch('${url}'${headers ? `, {
  headers: {
${headers}
  }
}` : ''})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`;
  };

  const generatePythonCode = (): string => {
    const url = `${baseUrl}/api/${endpoint.slug}`;
    const auth = endpoint.authentication;
    
    let headers = '';
    
    if (auth?.required) {
      switch (auth.type) {
        case 'api_key':
          const headerName = auth.config?.header_name || 'X-API-Key';
          headers = `headers = {'${headerName}': 'YOUR_API_KEY'}\n`;
          break;
          
        case 'bearer':
          headers = `headers = {'Authorization': 'Bearer YOUR_TOKEN'}\n`;
          break;
          
        case 'basic':
          return `import requests
from requests.auth import HTTPBasicAuth

response = requests.get(
    '${url}',
    auth=HTTPBasicAuth('username', 'password')
)
print(response.json())`;
      }
    }
    
    return `import requests

${headers}response = requests.get('${url}'${headers ? ', headers=headers' : ''})
print(response.json())`;
  };

  const generatePostmanCollection = () => {
    const collection = {
      info: {
        name: `${endpoint.slug} API`,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: [
        {
          name: `Test ${endpoint.slug}`,
          request: {
            method: "GET",
            header: [] as any[],
            url: {
              raw: `${baseUrl}/api/${endpoint.slug}`,
              protocol: baseUrl.split('://')[0],
              host: [baseUrl.split('://')[1].split('/')[0]],
              path: ["api", endpoint.slug]
            }
          }
        }
      ]
    };
    
    const auth = endpoint.authentication;
    if (auth?.required) {
      switch (auth.type) {
        case 'api_key':
          collection.item[0].request.header.push({
            key: auth.config?.header_name || 'X-API-Key',
            value: 'YOUR_API_KEY',
            type: 'text'
          });
          break;
          
        case 'bearer':
          collection.item[0].request.header.push({
            key: 'Authorization',
            value: 'Bearer YOUR_TOKEN',
            type: 'text'
          });
          break;
          
        case 'basic':
          (collection.item[0].request as any).auth = {
            type: 'basic',
            basic: [
              { key: 'username', value: 'username', type: 'string' },
              { key: 'password', value: 'password', type: 'string' }
            ]
          };
          break;
      }
    }
    
    return JSON.stringify(collection, null, 2);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      AppToaster.show({
        message: 'Copied to clipboard!',
        intent: Intent.SUCCESS,
        icon: 'clipboard'
      });
    });
  };

  const downloadPostmanCollection = () => {
    const collection = generatePostmanCollection();
    const blob = new Blob([collection], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${endpoint.slug}-api.postman_collection.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    AppToaster.show({
      message: 'Postman collection downloaded!',
      intent: Intent.SUCCESS
    });
  };

  const getExampleResponse = () => {
    return JSON.stringify({
      status: 'success',
      data: {
        message: 'Authentication successful',
        endpoint: endpoint.slug,
        timestamp: new Date().toISOString()
      }
    }, null, 2);
  };

  return (
    <Card style={{ marginTop: 20 }}>
      <h4>
        <Icon icon="code" style={{ marginRight: 8 }} />
        Test Your API Endpoint
      </h4>
      
      <Tabs 
        id="code-examples" 
        selectedTabId={activeTab}
        onChange={(newTab) => setActiveTab(newTab as string)}
      >
        <Tab id="curl" title="cURL" panel={
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 10 
            }}>
              <span className={Classes.TEXT_MUTED}>Command line tool for API testing</span>
              <Button
                small
                minimal
                icon="duplicate"
                text="Copy"
                onClick={() => copyToClipboard(generateCurlCommand())}
              />
            </div>
            <Code block style={{ 
              padding: 15, 
              backgroundColor: '#1e1e1e', 
              color: '#d4d4d4',
              borderRadius: 4,
              fontSize: 13,
              lineHeight: 1.5
            }}>
              {generateCurlCommand()}
            </Code>
          </div>
        } />
        
        <Tab id="javascript" title="JavaScript" panel={
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 10 
            }}>
              <span className={Classes.TEXT_MUTED}>Fetch API example</span>
              <Button
                small
                minimal
                icon="duplicate"
                text="Copy"
                onClick={() => copyToClipboard(generateJavaScriptCode())}
              />
            </div>
            <Code block style={{ 
              padding: 15, 
              backgroundColor: '#1e1e1e', 
              color: '#d4d4d4',
              borderRadius: 4,
              fontSize: 13,
              lineHeight: 1.5
            }}>
              {generateJavaScriptCode()}
            </Code>
          </div>
        } />
        
        <Tab id="python" title="Python" panel={
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 10 
            }}>
              <span className={Classes.TEXT_MUTED}>Using requests library</span>
              <Button
                small
                minimal
                icon="duplicate"
                text="Copy"
                onClick={() => copyToClipboard(generatePythonCode())}
              />
            </div>
            <Code block style={{ 
              padding: 15, 
              backgroundColor: '#1e1e1e', 
              color: '#d4d4d4',
              borderRadius: 4,
              fontSize: 13,
              lineHeight: 1.5
            }}>
              {generatePythonCode()}
            </Code>
          </div>
        } />
        
        <Tab id="postman" title="Postman" panel={
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 10 
            }}>
              <span className={Classes.TEXT_MUTED}>Import this collection into Postman</span>
              <Button
                small
                icon="download"
                text="Download Collection"
                intent={Intent.PRIMARY}
                onClick={downloadPostmanCollection}
              />
            </div>
            <Code block style={{ 
              padding: 15, 
              backgroundColor: '#1e1e1e', 
              color: '#d4d4d4',
              borderRadius: 4,
              fontSize: 13,
              lineHeight: 1.5,
              maxHeight: 300,
              overflowY: 'auto'
            }}>
              {generatePostmanCollection()}
            </Code>
          </div>
        } />
      </Tabs>

      <div style={{ marginTop: 20, padding: 15, backgroundColor: '#f5f8fa', borderRadius: 4 }}>
        <h5 style={{ marginTop: 0 }}>Example Response</h5>
        <Code block style={{ 
          backgroundColor: 'white', 
          border: '1px solid #d3d8de',
          fontSize: 12
        }}>
          {getExampleResponse()}
        </Code>
      </div>

      {endpoint.authentication?.required && (
        <div style={{ 
          marginTop: 15, 
          padding: 10, 
          backgroundColor: '#fff7e6', 
          borderRadius: 4,
          border: '1px solid #ffc940'
        }}>
          <Icon icon="info-sign" color="#ffc940" style={{ marginRight: 8 }} />
          <strong>Authentication Required</strong>
          <p style={{ margin: '5px 0 0 0', fontSize: 13 }}>
            {getAuthInstructions(endpoint.authentication)}
          </p>
        </div>
      )}
    </Card>
  );
};

function getAuthInstructions(auth: any): string {
  switch (auth.type) {
    case 'api_key':
      const headerName = auth.config?.header_name || 'X-API-Key';
      return `Include your API key in the '${headerName}' header. Replace 'YOUR_API_KEY' with an actual key from the configuration above.`;
    
    case 'bearer':
      return 'Include your bearer token in the Authorization header. Replace YOUR_TOKEN with an actual token.';
    
    case 'basic':
      return 'Use Basic Authentication with a username and password from the configuration above.';
    
    case 'custom':
      return 'Use your custom authentication method as configured.';
    
    default:
      return 'Configure authentication as required.';
  }
}

export default CurlCommandGenerator;