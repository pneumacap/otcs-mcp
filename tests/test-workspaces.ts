#!/usr/bin/env tsx

import { OTCSClient } from '../src/client/otcs-client.js';

const config = {
  baseUrl: process.env.OTCS_BASE_URL || 'https://vm-geliopou.eimdemo.com/otcs/cs.exe/api',
  username: process.env.OTCS_USERNAME,
  password: process.env.OTCS_PASSWORD,
  domain: process.env.OTCS_DOMAIN,
};

async function testWorkspaceTools() {
  const client = new OTCSClient(config);

  console.log('='.repeat(60));
  console.log('OTCS Workspace Tools Test');
  console.log('='.repeat(60));

  // Step 1: Authenticate
  console.log('\n[1] Authenticating...');
  try {
    await client.authenticate();
    console.log('    ✓ Authentication successful');
  } catch (error) {
    console.error('    ✗ Authentication failed:', error);
    process.exit(1);
  }

  // Step 2: Get Workspace Types
  console.log('\n[2] Retrieving workspace types...');
  let workspaceTypes: any[] = [];
  try {
    workspaceTypes = await client.getWorkspaceTypes();
    console.log(`    ✓ Found ${workspaceTypes.length} workspace types:\n`);

    console.log('    ' + '-'.repeat(70));
    console.log('    | Type ID | Template ID | Name                    | RM');
    console.log('    ' + '-'.repeat(70));

    for (const wt of workspaceTypes) {
      const templateId = wt.template_id ? String(wt.template_id).padEnd(11) : 'N/A'.padEnd(11);
      const rmStatus = wt.rm_enabled ? 'Yes' : 'No';
      console.log(`    | ${String(wt.wksp_type_id).padEnd(7)} | ${templateId} | ${wt.wksp_type_name.padEnd(23)} | ${rmStatus}`);
    }
    console.log('    ' + '-'.repeat(70));
  } catch (error) {
    console.error('    ✗ Failed to get workspace types:', error);
  }

  // Step 3: Get form schema for first workspace type with a template
  const typeWithTemplate = workspaceTypes.find(t => t.template_id);
  if (typeWithTemplate) {
    console.log(`\n[3] Getting form schema for "${typeWithTemplate.wksp_type_name}" (template_id: ${typeWithTemplate.template_id})...`);

    try {
      const form = await client.getWorkspaceForm(typeWithTemplate.template_id!);
      console.log(`    ✓ Form has ${form.fields.length} fields:`);

      if (form.fields.length > 0) {
        for (const field of form.fields.slice(0, 10)) {
          const reqMark = field.required ? '*' : ' ';
          console.log(`      ${reqMark} ${field.name} (${field.type})${field.description ? ` - ${field.description}` : ''}`);
        }
        if (form.fields.length > 10) {
          console.log(`      ... and ${form.fields.length - 10} more fields`);
        }
      } else {
        console.log('      (No additional fields required - just name)');
      }
    } catch (error) {
      console.error('    ✗ Failed to get form schema:', error);
    }
  } else {
    console.log('\n[3] Skipping form schema - no workspace types have templates');
  }

  // Step 4: Create a new workspace
  console.log('\n[4] Creating a new test workspace...');
  let newWorkspace;

  // Find Customer type with template, or any type with template
  const selectedType = workspaceTypes.find(t => t.wksp_type_name === 'Customer' && t.template_id) ||
                       workspaceTypes.find(t => t.template_id);

  if (selectedType && selectedType.template_id) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const workspaceName = `Test Workspace ${timestamp}`;

    console.log(`    Using workspace type: ${selectedType.wksp_type_name}`);
    console.log(`    Template ID: ${selectedType.template_id}`);

    try {
      newWorkspace = await client.createWorkspace({
        template_id: selectedType.template_id, // Use the actual template node ID
        name: workspaceName,
        description: 'Created by OTCS MCP workspace tools test',
      });

      console.log('    ✓ Workspace created successfully!\n');
      console.log('    ' + '-'.repeat(50));
      console.log(`    | ID:          ${newWorkspace.id}`);
      console.log(`    | Name:        ${newWorkspace.name}`);
      console.log(`    | Type:        ${newWorkspace.workspace_type_name}`);
      console.log(`    | Type ID:     ${newWorkspace.workspace_type_id}`);
      console.log(`    | Parent ID:   ${newWorkspace.parent_id}`);
      console.log(`    | Created:     ${newWorkspace.create_date}`);
      console.log('    ' + '-'.repeat(50));
    } catch (error) {
      console.error('    ✗ Failed to create workspace:', error);
    }
  } else {
    console.log('    ⚠ No workspace types have templates configured - skipping creation');
  }

  // Step 5: Get workspace details
  if (newWorkspace) {
    console.log(`\n[5] Retrieving workspace details for ID ${newWorkspace.id}...`);
    try {
      const workspace = await client.getWorkspace(newWorkspace.id);
      console.log('    ✓ Workspace details retrieved');
      console.log(`    | Container:   ${workspace.container}`);
      console.log(`    | Permissions: See=${workspace.permissions.can_see}, Modify=${workspace.permissions.can_modify}, Delete=${workspace.permissions.can_delete}`);
    } catch (error) {
      console.error('    ✗ Failed to get workspace:', error);
    }

    // Step 6: Get workspace roles
    console.log(`\n[6] Retrieving workspace roles...`);
    try {
      const roles = await client.getWorkspaceRoles(newWorkspace.id);
      console.log(`    ✓ Found ${roles.length} roles:`);
      for (const role of roles) {
        const leaderMark = role.leader ? ' (Leader)' : '';
        console.log(`      - ${role.name}${leaderMark} [ID: ${role.id}]`);
      }
    } catch (error) {
      console.error('    ✗ Failed to get roles:', error);
    }

    // Step 7: Get role members (for first role)
    const roles = await client.getWorkspaceRoles(newWorkspace.id);
    if (roles.length > 0) {
      console.log(`\n[7] Retrieving members for role "${roles[0].name}"...`);
      try {
        const roleMembers = await client.getRoleMembers(newWorkspace.id, roles[0].id);
        console.log(`    ✓ Found ${roleMembers.length} members in this role`);
        for (const member of roleMembers.slice(0, 5)) {
          console.log(`      - ${member.display_name || member.name} (${member.type}) [ID: ${member.id}]`);
        }
      } catch (error) {
        console.log('    ⚠ No members in this role or unable to retrieve');
      }
    }
  }

  // Step 8: Search workspaces
  console.log('\n[8] Searching for workspaces...');
  try {
    const searchResult = await client.searchWorkspaces({
      where_name: 'contains_Test',
      limit: 5,
    });
    console.log(`    ✓ Found ${searchResult.total_count} workspaces matching "Test":`);
    for (const ws of searchResult.results.slice(0, 5)) {
      console.log(`      - ${ws.name} [ID: ${ws.id}] (${ws.workspace_type_name})`);
    }
  } catch (error) {
    console.error('    ✗ Search failed:', error);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Workspace Types Found: ${workspaceTypes?.length || 0}`);
  if (newWorkspace) {
    console.log(`New Workspace Created: ${newWorkspace.name} (ID: ${newWorkspace.id})`);
  }
  console.log('='.repeat(60));

  // Logout
  await client.logout();
  console.log('\nLogged out. Test complete.');
}

testWorkspaceTools().catch(console.error);
