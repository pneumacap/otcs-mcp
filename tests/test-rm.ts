/**
 * Test script for Records Management tools
 * Run with: npm run test:rm
 */

// Allow self-signed certificates for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { OTCSClient } from '../src/client/otcs-client.js';

const BASE_URL = 'https://vm-geliopou.eimdemo.com/otcs/cs.exe/api';
const USERNAME = 'Admin';
const PASSWORD = 'Opentext1';

const client = new OTCSClient({ baseUrl: BASE_URL });

async function testRM() {
  console.log('=== RM Tools Test ===\n');

  // Step 1: Authenticate
  console.log('Step 1: Authenticating...');
  await client.authenticate(USERNAME, PASSWORD);
  console.log('  ✓ Authenticated\n');

  // Step 2: Create test folder
  console.log('Step 2: Creating test folder...');
  const testFolder = await client.createFolder(2000, `RM_Test_${Date.now()}`);
  console.log(`  ✓ Created folder: ${testFolder.name} (ID: ${testFolder.id})\n`);

  // Step 3: Upload a test document
  console.log('Step 3: Uploading test document...');
  const testContent = Buffer.from('This is a test document for RM classification.');
  const testDoc = await client.uploadDocument(testFolder.id, 'RM_Test_Document.txt', testContent, 'text/plain');
  console.log(`  ✓ Uploaded document: ${testDoc.name} (ID: ${testDoc.id})\n`);

  // Step 4: List available holds
  console.log('Step 4: Listing available holds...');
  try {
    const holdsResult = await client.listRMHolds();
    console.log(`  ✓ Found ${holdsResult.holds.length} hold(s):`);
    for (const hold of holdsResult.holds.slice(0, 5)) {
      console.log(`    - ${hold.name} (ID: ${hold.id}, Type: ${hold.type_name || hold.type})`);
    }
  } catch (err: any) {
    console.log(`  ✗ Error listing holds: ${err.message}`);
  }
  console.log('');

  // Step 5: Get classifications on the document
  console.log('Step 5: Getting classifications on document...');
  try {
    const classResult = await client.getRMClassifications(testDoc.id);
    console.log(`  ✓ Found ${classResult.classifications.length} classification(s) on document`);
    for (const cls of classResult.classifications) {
      console.log(`    - ${cls.name} (ID: ${cls.id})`);
    }
  } catch (err: any) {
    console.log(`  ✗ Error getting classifications: ${err.message}`);
  }
  console.log('');

  // Step 6: List cross-reference types
  console.log('Step 6: Listing cross-reference types...');
  try {
    const xrefTypes = await client.listRMCrossRefTypes();
    console.log(`  ✓ Found ${xrefTypes.types.length} xref type(s):`);
    for (const xtype of xrefTypes.types.slice(0, 5)) {
      console.log(`    - ${xtype.name}`);
    }
  } catch (err: any) {
    console.log(`  ✗ Error listing xref types: ${err.message}`);
  }
  console.log('');

  // Step 7: Try to create a hold
  console.log('Step 7: Creating test hold...');
  let testHoldId: number | null = null;
  try {
    const newHold = await client.createRMHold({
      name: `Test_Hold_${Date.now()}`,
      type: 'Legal',
      comment: 'Test hold created by MCP RM tools test'
    });
    testHoldId = newHold.id;
    console.log(`  ✓ Created hold: ${newHold.name} (ID: ${newHold.id})`);

    // Step 8: Apply hold to document
    console.log('\nStep 8: Applying hold to document...');
    const applyResult = await client.applyRMHold(testDoc.id, newHold.id);
    console.log(`  ✓ Hold applied to document`);

    // Step 9: Verify hold is on document
    console.log('\nStep 9: Verifying hold on document...');
    const nodeHolds = await client.getNodeRMHolds(testDoc.id);
    console.log(`  ✓ Document has ${nodeHolds.holds.length} hold(s):`);
    for (const h of nodeHolds.holds) {
      console.log(`    - ${h.name} (ID: ${h.id})`);
    }

    // Step 10: Remove hold from document
    console.log('\nStep 10: Removing hold from document...');
    await client.removeRMHold(testDoc.id, newHold.id);
    console.log(`  ✓ Hold removed from document`);

    // Step 11: Delete test hold
    console.log('\nStep 11: Deleting test hold...');
    await client.deleteRMHold(newHold.id);
    testHoldId = null;
    console.log(`  ✓ Hold deleted`);

  } catch (err: any) {
    console.log(`  ✗ Error with holds: ${err.message}`);
    // Try to clean up hold if created
    if (testHoldId) {
      try {
        await client.deleteRMHold(testHoldId);
      } catch {}
    }
  }
  console.log('');

  // Cleanup
  console.log('Cleanup: Deleting test folder...');
  try {
    await client.deleteNode(testFolder.id);
    console.log(`  ✓ Deleted test folder\n`);
  } catch (err: any) {
    console.log(`  ✗ Error deleting folder: ${err.message}\n`);
  }

  console.log('=== RM Test Complete ===');
}

testRM().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
