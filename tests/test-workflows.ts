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

    // Test 3: Get Workflow Status - On Time
    console.log('Test 3: Get Workflow Status (ontime, Both)');
    try {
      const workflows = await client.getWorkflowStatus({ wstatus: 'ontime', kind: 'Both' });
      console.log(`  ✓ Retrieved on-time workflows`);
      console.log(`  Count: ${workflows.length}`);
      if (workflows.length > 0) {
        console.log('  Sample workflows:');
        workflows.slice(0, 5).forEach(w => {
          const assigneeNames = w.assignees?.map(a => a.loginName).join(', ') || 'N/A';
          console.log(`    - [${w.process_id}] ${w.workflow_name} (Status: ${w.status_key}, Step: ${w.step_name || 'N/A'}, Assignees: ${assigneeNames})`);
          if (w.current_tasks?.length) {
            w.current_tasks.forEach(t => {
              const taskAssignees = t.task_assignees?.assignee?.map(a => a.loginName).join(', ') || 'N/A';
              console.log(`      Task: ${t.task_name} → ${taskAssignees} (${t.task_status})`);
            });
          }
        });
      }
    } catch (error) {
      console.log(`  ⚠ ${error instanceof Error ? error.message : error}`);
    }
    console.log();

    // Test 3b: Get Workflow Status - Late
    console.log('Test 3b: Get Workflow Status (workflowlate, Both)');
    try {
      const workflows = await client.getWorkflowStatus({ wstatus: 'workflowlate', kind: 'Both' });
      console.log(`  ✓ Retrieved late workflows`);
      console.log(`  Count: ${workflows.length}`);
      if (workflows.length > 0) {
        workflows.slice(0, 5).forEach(w => {
          console.log(`    - [${w.process_id}] ${w.workflow_name} (Status: ${w.status_key}, Due: ${w.due_date || 'N/A'})`);
        });
      }
    } catch (error) {
      console.log(`  ⚠ ${error instanceof Error ? error.message : error}`);
    }
    console.log();

    // Test 3c: Get Workflow Status - Completed
    console.log('Test 3c: Get Workflow Status (completed, Both)');
    try {
      const workflows = await client.getWorkflowStatus({ wstatus: 'completed', kind: 'Both' });
      console.log(`  ✓ Retrieved completed workflows`);
      console.log(`  Count: ${workflows.length}`);
      if (workflows.length > 0) {
        workflows.slice(0, 3).forEach(w => {
          console.log(`    - [${w.process_id}] ${w.workflow_name} (Status: ${w.status_key})`);
        });
      }
    } catch (error) {
      console.log(`  ⚠ ${error instanceof Error ? error.message : error}`);
    }
    console.log();

    // Test 3d: Get Workflow Status - Stopped
    console.log('Test 3d: Get Workflow Status (stopped, Both)');
    try {
      const workflows = await client.getWorkflowStatus({ wstatus: 'stopped', kind: 'Both' });
      console.log(`  ✓ Retrieved stopped workflows`);
      console.log(`  Count: ${workflows.length}`);
      if (workflows.length > 0) {
        workflows.slice(0, 3).forEach(w => {
          console.log(`    - [${w.process_id}] ${w.workflow_name} (Status: ${w.status_key})`);
        });
      }
    } catch (error) {
      console.log(`  ⚠ ${error instanceof Error ? error.message : error}`);
    }
    console.log();

    // Test 4: Get Active Workflows (running instances)
    console.log('Test 4: Get Active Workflows (NOARCHIVE)');
    try {
      const activeWorkflows = await client.getActiveWorkflows({ status: 'NOARCHIVE' });
      console.log(`  ✓ Retrieved active workflow instances`);
      console.log(`  Count: ${activeWorkflows.length}`);
      if (activeWorkflows.length > 0) {
        console.log('  Sample active instances:');
        activeWorkflows.slice(0, 5).forEach(w => {
          console.log(`    - [${w.process_id}] ${w.workflow_name} (Status: ${w.status_key}, Due: ${w.due_date || 'N/A'})`);
        });
      }
    } catch (error) {
      console.log(`  ⚠ ${error instanceof Error ? error.message : error}`);
    }
    console.log();

    // Test 5: Get Workflow Tasks (task list with assignees)
    console.log('Test 5: Get Workflow Tasks (process 177804)');
    try {
      const taskList = await client.getWorkflowTasks(177804);
      console.log(`  ✓ Retrieved task list`);
      if (taskList.details) {
        console.log(`  Workflow: ${taskList.details.workflow_name} (ID: ${taskList.details.workflow_id})`);
        console.log(`  Initiated: ${taskList.details.date_initiated}`);
      }
      if (taskList.tasks) {
        console.log(`  Completed: ${taskList.tasks.completed?.length || 0}, Current: ${taskList.tasks.current?.length || 0}, Next: ${taskList.tasks.next?.length || 0}`);
        taskList.tasks.current?.forEach((t: any) => {
          const assignees = t.task_assignees?.assignee?.map((a: any) => a.loginName).join(', ') || 'N/A';
          console.log(`    Current: ${t.task_name} → ${assignees} (${t.task_status})`);
        });
      }
    } catch (error) {
      console.log(`  ⚠ ${error instanceof Error ? error.message : error}`);
    }
    console.log();

    // Test 6: Logout
    console.log('Test 6: Logout');
    await client.logout();
    console.log('  ✓ Logged out successfully\n');

    console.log('=== Workflow Tests Complete ===');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTests();
