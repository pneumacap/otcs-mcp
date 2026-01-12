/**
 * Test script to verify OTCS API connectivity
 * Run with: npm test
 */

// Allow self-signed certificates for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { OTCSClient } from '../src/client/otcs-client.js';

const BASE_URL = 'https://vm-geliopou.eimdemo.com/otcs/cs.exe/api';
const USERNAME = 'Admin';
const PASSWORD = 'Opentext1';

async function runTests() {
  console.log('=== OTCS MCP Server Tests ===\n');

  const client = new OTCSClient({ baseUrl: BASE_URL });

  // Test 1: Authentication
  console.log('Test 1: Authentication');
  try {
    const ticket = await client.authenticate(USERNAME, PASSWORD);
    console.log(`  ✓ Authenticated successfully`);
    console.log(`  Ticket: ${ticket.substring(0, 30)}...`);
  } catch (error) {
    console.log(`  ✗ Authentication failed: ${error}`);
    return;
  }

  // Test 2: Session validation
  console.log('\nTest 2: Session Validation');
  try {
    const isValid = await client.validateSession();
    console.log(`  ✓ Session is valid: ${isValid}`);
  } catch (error) {
    console.log(`  ✗ Session validation failed: ${error}`);
  }

  // Test 3: Get Enterprise Workspace (ID 2000)
  console.log('\nTest 3: Get Enterprise Workspace');
  try {
    const node = await client.getNode(2000);
    console.log(`  ✓ Retrieved node:`);
    console.log(`    ID: ${node.id}`);
    console.log(`    Name: ${node.name}`);
    console.log(`    Type: ${node.type_name}`);
    console.log(`    Container: ${node.container}`);
  } catch (error) {
    console.log(`  ✗ Failed to get node: ${error}`);
  }

  // Test 4: Browse Enterprise Workspace
  console.log('\nTest 4: Browse Enterprise Workspace');
  try {
    const contents = await client.getSubnodes(2000, { limit: 10 });
    console.log(`  ✓ Retrieved folder contents:`);
    console.log(`    Folder: ${contents.folder.name}`);
    console.log(`    Items: ${contents.items.length}`);
    console.log(`    Total count: ${contents.paging.total_count}`);
    if (contents.items.length > 0) {
      console.log('    First items:');
      contents.items.slice(0, 5).forEach(item => {
        console.log(`      - ${item.name} (${item.type_name}, ID: ${item.id})`);
      });
    }
  } catch (error) {
    console.log(`  ✗ Failed to browse: ${error}`);
  }

  // Test 5: Create a test folder
  console.log('\nTest 5: Create Test Folder');
  let testFolderId: number | null = null;
  try {
    const testFolderName = `MCP_Test_${Date.now()}`;
    const result = await client.createFolder(2000, testFolderName, 'Created by MCP test script');
    testFolderId = result.id;
    console.log(`  ✓ Created folder:`);
    console.log(`    ID: ${result.id}`);
    console.log(`    Name: ${testFolderName}`);
  } catch (error) {
    console.log(`  ✗ Failed to create folder: ${error}`);
  }

  // Test 6: Create nested folder path
  if (testFolderId) {
    console.log('\nTest 6: Create Nested Folder Path');
    try {
      const result = await client.createFolderPath(testFolderId, '2024/Q1/Reports');
      console.log(`  ✓ Created folder path:`);
      console.log(`    Folders created: ${result.folders.length}`);
      console.log(`    Leaf folder ID: ${result.leafId}`);
      result.folders.forEach(f => {
        console.log(`      - ${f.name} (ID: ${f.id})`);
      });
    } catch (error) {
      console.log(`  ✗ Failed to create folder path: ${error}`);
    }
  }

  // Test 7: Upload a test document
  if (testFolderId) {
    console.log('\nTest 7: Upload Test Document');
    try {
      const testContent = 'Hello from OTCS MCP Server!\n\nThis is a test document.';
      const result = await client.uploadDocument(
        testFolderId,
        'test_document.txt',
        Buffer.from(testContent),
        'text/plain',
        'Test document created by MCP server'
      );
      console.log(`  ✓ Uploaded document:`);
      console.log(`    ID: ${result.id}`);
      console.log(`    Name: test_document.txt`);
    } catch (error) {
      console.log(`  ✗ Failed to upload document: ${error}`);
    }
  }

  // Test 8: Search for nodes
  console.log('\nTest 8: Search');
  try {
    const results = await client.searchNodes('MCP_Test', { limit: 10 });
    console.log(`  ✓ Search results:`);
    console.log(`    Total: ${results.total_count}`);
    results.results.forEach(item => {
      console.log(`      - ${item.name} (${item.type_name})`);
    });
  } catch (error) {
    console.log(`  ✗ Search failed: ${error}`);
  }

  // Cleanup: Delete test folder
  if (testFolderId) {
    console.log('\nCleanup: Delete Test Folder');
    try {
      await client.deleteNode(testFolderId);
      console.log(`  ✓ Deleted test folder ${testFolderId}`);
    } catch (error) {
      console.log(`  ✗ Failed to delete test folder: ${error}`);
    }
  }

  // Test 9: Workflow Assignments
  console.log('\nTest 9: Workflow Assignments');
  try {
    const assignments = await client.getAssignments();
    console.log(`  ✓ Retrieved workflow assignments:`);
    console.log(`    Total: ${assignments.length}`);
    if (assignments.length > 0) {
      console.log('    First assignments:');
      for (const a of assignments.slice(0, 3)) {
        console.log(`      - ${a.name} (ID: ${a.workflow_id}/${a.workflow_subworkflow_id}/${a.workflow_subworkflow_task_id})`);
        console.log(`        Priority: ${a.priority_name}, Status: ${a.status_name}`);
      }

      // Test 10: Get Workflow Form for first assignment
      console.log('\nTest 10: Workflow Task Form (Full)');
      const firstAssignment = assignments[0];
      try {
        const formFull = await client.getWorkflowTaskFormFull(
          firstAssignment.workflow_id,
          firstAssignment.workflow_subworkflow_id,
          firstAssignment.workflow_subworkflow_task_id
        );
        console.log(`  ✓ Retrieved full form schema:`);
        console.log(`    Title: ${formFull.data.title}`);
        console.log(`    Instructions: ${formFull.data.instructions?.substring(0, 50) || 'None'}...`);
        console.log(`    Comments enabled: ${formFull.data.comments_on}`);
        console.log(`    Actions: ${formFull.data.actions?.map(a => a.key).join(', ') || 'None'}`);
        console.log(`    Custom actions: ${formFull.data.custom_actions?.map(a => a.key).join(', ') || 'None'}`);
        console.log(`    Form count: ${formFull.forms.length}`);
        if (formFull.forms.length > 0 && formFull.forms[0].schema?.properties) {
          const fieldKeys = Object.keys(formFull.forms[0].schema.properties);
          console.log(`    Form fields: ${fieldKeys.slice(0, 5).join(', ')}${fieldKeys.length > 5 ? '...' : ''}`);
        }
      } catch (error) {
        console.log(`  ✗ Failed to get workflow form: ${error}`);
      }

      // Test 11: Get Workflow Info Full
      console.log('\nTest 11: Workflow Info Full');
      try {
        const info = await client.getWorkflowInfoFull(firstAssignment.workflow_id);
        console.log(`  ✓ Retrieved workflow info:`);
        console.log(`    Work ID: ${info.work_id}`);
        console.log(`    Title: ${info.title}`);
        console.log(`    Status: ${info.status}`);
        console.log(`    Steps: ${info.steps?.length || 0}`);
        console.log(`    Comments: ${info.comments?.length || 0}`);
        console.log(`    Attributes: ${Object.keys(info.attributes || {}).length} fields`);
      } catch (error) {
        console.log(`  ✗ Failed to get workflow info: ${error}`);
      }

      // Test 12: Check Group Assignment
      console.log('\nTest 12: Check Group Assignment');
      try {
        const isGroup = await client.checkGroupAssignment(
          firstAssignment.workflow_id,
          firstAssignment.workflow_subworkflow_id,
          firstAssignment.workflow_subworkflow_task_id
        );
        console.log(`  ✓ Group assignment check:`);
        console.log(`    Is group assignment: ${isGroup}`);
      } catch (error) {
        console.log(`  ✗ Failed to check group assignment: ${error}`);
      }
    } else {
      console.log('    No assignments found - skipping workflow form tests');
    }
  } catch (error) {
    console.log(`  ✗ Failed to get assignments: ${error}`);
  }

  // Test 13: Get Categories on a node
  console.log('\nTest 13: Get Categories');
  try {
    // Get categories on Enterprise Workspace (ID 2000)
    const categories = await client.getCategories(2000);
    console.log(`  ✓ Retrieved categories:`);
    console.log(`    Node ID: ${categories.node_id}`);
    console.log(`    Category count: ${categories.categories.length}`);
    if (categories.categories.length > 0) {
      console.log('    Categories:');
      categories.categories.slice(0, 3).forEach(cat => {
        console.log(`      - ${cat.name} (ID: ${cat.id}, Attributes: ${cat.attributes.length})`);
      });
    }
  } catch (error) {
    console.log(`  ✗ Failed to get categories: ${error}`);
  }

  // Test 14: Workspace metadata form
  console.log('\nTest 14: Workspace Metadata Form');
  try {
    // First, search for a business workspace
    const workspaces = await client.searchWorkspaces({ limit: 1 });
    if (workspaces.results.length > 0) {
      const ws = workspaces.results[0];
      console.log(`  Found workspace: ${ws.name} (ID: ${ws.id})`);

      try {
        const metadataForm = await client.getWorkspaceMetadataForm(ws.id);
        console.log(`  ✓ Retrieved workspace metadata form:`);
        console.log(`    Categories: ${metadataForm.categories.length}`);
        if (metadataForm.categories.length > 0) {
          metadataForm.categories.slice(0, 2).forEach(cat => {
            console.log(`      - ${cat.category_name}: ${cat.attributes.length} attributes`);
          });
        }
      } catch (error) {
        console.log(`  ! Workspace metadata form skipped: ${error}`);
      }
    } else {
      console.log('  No business workspaces found - skipping metadata form test');
    }
  } catch (error) {
    console.log(`  ✗ Workspace search failed: ${error}`);
  }

  // Test 15: Search Members (Users)
  console.log('\nTest 15: Search Members (Users)');
  let testUserId: number | null = null;
  try {
    const usersResult = await client.searchMembers({ type: 0, limit: 5 });
    console.log(`  ✓ Found ${usersResult.total_count} user(s):`);
    usersResult.results.slice(0, 5).forEach(user => {
      console.log(`    - ${user.name} (ID: ${user.id}, ${user.display_name || user.name})`);
    });
    if (usersResult.results.length > 0) {
      testUserId = usersResult.results[0].id;
    }
  } catch (error) {
    console.log(`  ✗ Search members failed: ${error}`);
  }

  // Test 16: Search Members (Groups)
  console.log('\nTest 16: Search Members (Groups)');
  let testGroupId: number | null = null;
  try {
    const groupsResult = await client.searchMembers({ type: 1, limit: 5 });
    console.log(`  ✓ Found ${groupsResult.total_count} group(s):`);
    groupsResult.results.slice(0, 5).forEach(group => {
      console.log(`    - ${group.name} (ID: ${group.id})`);
    });
    if (groupsResult.results.length > 0) {
      testGroupId = groupsResult.results[0].id;
    }
  } catch (error) {
    console.log(`  ✗ Search groups failed: ${error}`);
  }

  // Test 17: Get Member Details
  if (testUserId) {
    console.log('\nTest 17: Get Member Details');
    try {
      const member = await client.getMember(testUserId);
      console.log(`  ✓ Retrieved member details:`);
      console.log(`    ID: ${member.id}`);
      console.log(`    Name: ${member.name}`);
      console.log(`    Type: ${member.type_name}`);
      console.log(`    Display Name: ${member.display_name || 'N/A'}`);
      console.log(`    Email: ${member.business_email || 'N/A'}`);
    } catch (error) {
      console.log(`  ✗ Get member failed: ${error}`);
    }
  }

  // Test 18: Get User Groups
  if (testUserId) {
    console.log('\nTest 18: Get User Groups');
    try {
      const groupsInfo = await client.getUserGroups(testUserId, { limit: 5 });
      console.log(`  ✓ User ${testUserId} belongs to ${groupsInfo.total_count} group(s):`);
      groupsInfo.groups.slice(0, 5).forEach(group => {
        console.log(`    - ${group.name} (ID: ${group.id})`);
      });
    } catch (error) {
      console.log(`  ✗ Get user groups failed: ${error}`);
    }
  }

  // Test 19: Get Group Members
  if (testGroupId) {
    console.log('\nTest 19: Get Group Members');
    try {
      const membersInfo = await client.getGroupMembers(testGroupId, { limit: 5 });
      console.log(`  ✓ Group ${testGroupId} has ${membersInfo.total_count} member(s):`);
      membersInfo.members.slice(0, 5).forEach(member => {
        console.log(`    - ${member.name} (ID: ${member.id}, Type: ${member.type_name})`);
      });
    } catch (error) {
      console.log(`  ✗ Get group members failed: ${error}`);
    }
  }

  // Test 20: Get Node Permissions
  console.log('\nTest 20: Get Node Permissions');
  try {
    // Get permissions on Enterprise Workspace (ID 2000)
    const permissions = await client.getNodePermissions(2000);
    console.log(`  ✓ Retrieved permissions for node 2000:`);
    console.log(`    Owner: ${permissions.owner ? `ID ${permissions.owner.right_id}` : 'Not set'}`);
    console.log(`    Owner Group: ${permissions.group ? `ID ${permissions.group.right_id}` : 'Not set'}`);
    console.log(`    Public Access: ${permissions.public_access ? 'Yes' : 'No'}`);
    console.log(`    Custom Permissions: ${permissions.custom_permissions.length}`);
    if (permissions.custom_permissions.length > 0) {
      console.log('    Custom entries:');
      permissions.custom_permissions.slice(0, 3).forEach(cp => {
        console.log(`      - ${cp.right_name || cp.right_id}: ${cp.permissions.join(', ')}`);
      });
    }
  } catch (error) {
    console.log(`  ✗ Get permissions failed: ${error}`);
  }

  // Test 21: Get Effective Permissions
  if (testUserId) {
    console.log('\nTest 21: Get Effective Permissions');
    try {
      const effective = await client.getEffectivePermissions(2000, testUserId);
      console.log(`  ✓ Effective permissions for user ${testUserId} on node 2000:`);
      console.log(`    Permissions: ${effective.permissions.join(', ') || 'None'}`);
    } catch (error) {
      console.log(`  ✗ Get effective permissions failed: ${error}`);
    }
  }

  // Test 22: Logout
  console.log('\nTest 22: Logout');
  try {
    await client.logout();
    console.log(`  ✓ Logged out successfully`);
    console.log(`  Is authenticated: ${client.isAuthenticated()}`);
  } catch (error) {
    console.log(`  ✗ Logout failed: ${error}`);
  }

  console.log('\n=== Tests Complete ===');
}

runTests().catch(console.error);
