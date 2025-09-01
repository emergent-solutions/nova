import React, { useState } from 'react';
import {
  Tree,
  TreeNode,
  Icon,
  Tag,
  Card,
  FormGroup,
  HTMLSelect,
  Button,
  Callout,
  Intent,
  Classes
} from '@blueprintjs/core';

interface JsonPathExplorerProps {
  data: any;
  onSelectItemsPath: (path: string) => void;
  onSelectFieldPath: (rssField: string, jsonPath: string) => void;
  selectedItemsPath?: string;
  fieldMappings?: Record<string, string>;
}

export const JsonPathExplorer: React.FC<JsonPathExplorerProps> = ({
  data,
  onSelectItemsPath,
  onSelectFieldPath,
  selectedItemsPath = '',
  fieldMappings = {}
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string>('');

  // Convert JSON to tree structure
  const jsonToTreeNodes = (obj: any, path: string = ''): TreeNode[] => {
    if (!obj || typeof obj !== 'object') return [];

    return Object.keys(obj).map(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const value = obj[key];
      const isArray = Array.isArray(value);
      const isObject = typeof value === 'object' && value !== null;
      
      let nodeLabel = (
        <span>
          <strong>{key}</strong>
          {isArray && <Tag minimal intent={Intent.PRIMARY} style={{ marginLeft: 5 }}>Array [{value.length}]</Tag>}
          {isObject && !isArray && <Tag minimal>Object</Tag>}
          {!isObject && <Tag minimal intent={Intent.WARNING}>{typeof value}</Tag>}
        </span>
      );

      // For arrays, show first item structure
      let childNodes: TreeNode[] = [];
      if (isArray && value.length > 0) {
        childNodes = jsonToTreeNodes(value[0], `${currentPath}[0]`);
      } else if (isObject && !isArray) {
        childNodes = jsonToTreeNodes(value, currentPath);
      }

      return {
        id: currentPath,
        label: nodeLabel,
        icon: isObject ? 'folder-open' : 'document',
        childNodes,
        isExpanded: expandedNodes.has(currentPath),
        isSelected: selectedNode === currentPath,
        className: currentPath === selectedItemsPath ? 'bp5-intent-primary' : undefined
      };
    });
  };

  const handleNodeClick = (node: TreeNode) => {
    setSelectedNode(node.id as string);
  };

  const handleNodeExpand = (node: TreeNode) => {
    const newExpanded = new Set(expandedNodes);
    newExpanded.add(node.id as string);
    setExpandedNodes(newExpanded);
  };

  const handleNodeCollapse = (node: TreeNode) => {
    const newExpanded = new Set(expandedNodes);
    newExpanded.delete(node.id as string);
    setExpandedNodes(newExpanded);
  };

  const treeNodes = jsonToTreeNodes(data);

  return (
    <div className="json-path-explorer">
      <Card>
        <h4>1. Select the array containing your RSS items</h4>
        <p className={Classes.TEXT_MUTED}>
          Click on an array field that contains the items you want to convert to RSS entries
        </p>
        
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <Button
            intent={Intent.PRIMARY}
            disabled={!selectedNode}
            onClick={() => onSelectItemsPath(selectedNode)}
            text="Use as Items Array"
            icon="tick"
          />
          {selectedItemsPath && (
            <Tag large intent={Intent.SUCCESS}>
              Items path: <strong>{selectedItemsPath}</strong>
            </Tag>
          )}
        </div>

        <Tree
          contents={treeNodes}
          onNodeClick={handleNodeClick}
          onNodeExpand={handleNodeExpand}
          onNodeCollapse={handleNodeCollapse}
        />
      </Card>

      {selectedItemsPath && (
        <Card style={{ marginTop: 20 }}>
          <h4>2. Map fields from each item to RSS elements</h4>
          <RssFieldMapper
            itemPath={selectedItemsPath}
            sampleData={data}
            fieldMappings={fieldMappings}
            onMapField={onSelectFieldPath}
          />
        </Card>
      )}
    </div>
  );
};

// Sub-component for RSS field mapping
const RssFieldMapper: React.FC<{
  itemPath: string;
  sampleData: any;
  fieldMappings: Record<string, string>;
  onMapField: (rssField: string, jsonPath: string) => void;
}> = ({ itemPath, sampleData, fieldMappings, onMapField }) => {
  // Get sample item from the path
  const getSampleItem = () => {
    const parts = itemPath.split('.');
    let current = sampleData;
    
    for (const part of parts) {
      if (part.includes('[')) {
        const key = part.substring(0, part.indexOf('['));
        current = current[key];
        if (Array.isArray(current) && current.length > 0) {
          current = current[0];
        }
      } else {
        current = current[part];
      }
    }
    
    return Array.isArray(current) && current.length > 0 ? current[0] : current;
  };

  const sampleItem = getSampleItem();
  const availableFields = sampleItem ? extractFields(sampleItem) : [];

  const rssFields = [
    { name: 'title', required: true, description: 'Item title' },
    { name: 'description', required: true, description: 'Item description/summary' },
    { name: 'link', required: true, description: 'Item URL' },
    { name: 'pubDate', required: false, description: 'Publication date' },
    { name: 'guid', required: false, description: 'Unique identifier' },
    { name: 'author', required: false, description: 'Author name/email' },
    { name: 'category', required: false, description: 'Category/tags' },
    { name: 'enclosure', required: false, description: 'Media URL' }
  ];

  return (
    <div className="rss-field-mapper">
      {rssFields.map(field => (
        <FormGroup
          key={field.name}
          label={field.name}
          labelInfo={field.required ? '(required)' : '(optional)'}
          helperText={field.description}
        >
          <HTMLSelect
            value={fieldMappings[field.name] || ''}
            onChange={(e) => onMapField(field.name, e.target.value)}
            fill
          >
            <option value="">-- Select field --</option>
            {availableFields.map(f => (
              <option key={f.path} value={f.path}>
                {f.display}
              </option>
            ))}
          </HTMLSelect>
        </FormGroup>
      ))}
    </div>
  );
};

// Helper to extract all possible field paths from an object
function extractFields(obj: any, prefix = '', depth = 0): Array<{path: string, display: string}> {
  const fields: Array<{path: string, display: string}> = [];
  const maxDepth = 3;
  
  if (depth > maxDepth || !obj || typeof obj !== 'object') return fields;
  
  Object.keys(obj).forEach(key => {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    
    if (value === null || value === undefined) {
      fields.push({ path, display: `${key} (empty)` });
    } else if (Array.isArray(value)) {
      fields.push({ path, display: `${key} (array)` });
      if (value.length > 0 && typeof value[0] === 'object') {
        // Add array item fields
        const itemFields = extractFields(value[0], `${path}[0]`, depth + 1);
        itemFields.forEach(f => {
          fields.push({
            path: f.path.replace('[0]', '[*]'), // Use [*] to indicate "for each item"
            display: `${key} → ${f.display}`
          });
        });
      }
    } else if (typeof value === 'object') {
      fields.push({ path, display: `${key} (object)` });
      // Add nested fields
      const nestedFields = extractFields(value, path, depth + 1);
      nestedFields.forEach(f => {
        fields.push({
          path: f.path,
          display: `${key} → ${f.display.replace(key + ' → ', '')}`
        });
      });
    } else {
      fields.push({ 
        path, 
        display: `${key} (${typeof value}: "${String(value).substring(0, 30)}${String(value).length > 30 ? '...' : ''}")` 
      });
    }
  });
  
  return fields;
}