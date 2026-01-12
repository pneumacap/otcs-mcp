#!/usr/bin/env tsx

/**
 * Workflow API Tests
 * Tests the workflow and assignment functionality
 */

// Allow self-signed certificates for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { OTCSClient } from '../src/client/otcs-client.js';

const BASE_URL = 'https://vm-geliopou.eimdemo.com/otcs/cs.exe/api';
const USERNAME = 'Admin';
const PASSWORD = 'Opentext1';

const client = new OTCSClient({ baseUrl: BASE_URL });

async function runTests() {
  console.log('=== Workflow API Tests ===\n');

  try {
    // Test 1: Authentication
    console.log('Test 1: Authentication');
    const ticket = await client.authenticate(USERNAME, PASSWORD);
    console.log(`  ✓ Authenticated successfully`);
    console.log(`  Ticket: ${ticket.substring(0, 30)}...\n`);

    // Test 2: Get User Assignments
    console.log('Test 2: Get User Assignments');
    try {
      const assignments = await client.getAssignments();
      console.log(`  ✓ Retrieved assignments`);
      console.log(`  Count: ${assignments.length}`);
      if (assignments.length > 0) {
        console.log('  Sample assignments:');
        assignments.slice(0, 3).forEach(a => {
          console.log(`    - ${a.name} (Priority: ${a.priority_name}, Status: ${a.status_name})`);
          if (a.date_due) console.log(`      Due: ${a.date_due}`);
        });
      } else {
        console.log('  No pending assignments found');
      }
    } catch (error) {
      console.log(`  ⚠ ${error instanceof Error ? error.message : error}`);
    }
    console.log();

    // Test 3: Get Workflow Status (all)
    console.log('Test 3: Get Workflow Status');
    try {
      const workflows = await client.getWorkflowStatus({});
      console.log(`  ✓ Retrieved workflow status`);
      console.log(`  Count: ${workflows.length}`);
      if (workflows.length > 0) {
        console.log('  Sample workflows:');
        workflows.slice(0, 3).forEach(w => {
          console.log(`    - ${w.workflow_name} (Status: ${w.workflow_status})`);
        });
      }
    } catch (error) {
      console.log(`  ⚠ ${error instanceof Error ? error.message : error}`);
    }
    console.log();

    // Test 4: Get Active Workflows
    console.log('Test 4: Get Active Workflows');
    try {
      const activeWorkflows = await client.getActiveWorkflows({});
      console.log(`  ✓ Retrieved active workflows`);
      console.log(`  Count: ${activeWorkflows.length}`);
      if (activeWorkflows.length > 0) {
        console.log('  Sample active workflows:');
        activeWorkflows.slice(0, 3).forEach(w => {
          console.log(`    - ${w.workflow_name || w.workflow_id} (ID: ${w.workflow_id})`);
        });
      }
    } catch (error) {
      console.log(`  ⚠ ${error instanceof Error ? error.message : error}`);
    }
    console.log();

    // Test 5: Logout
    console.log('Test 5: Logout');
    await client.logout();
    console.log('  ✓ Logged out successfully\n');

    console.log('=== Workflow Tests Complete ===');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTests();
