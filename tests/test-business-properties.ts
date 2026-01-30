/**
 * Test: applyWorkspaceBusinessProperties handles all input formats
 * and workspace creation populates categories correctly.
 *
 * Run with: npx tsx tests/test-business-properties.ts
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { OTCSClient } from '../src/client/otcs-client.js';

const BASE_URL = 'https://vm-geliopou.eimdemo.com/otcs/cs.exe/api';
const USERNAME = 'Admin';
const PASSWORD = 'Opentext1';

let passed = 0;
let failed = 0;
const cleanupIds: number[] = [];

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== Business Properties Tests ===\n');

  const client = new OTCSClient({ baseUrl: BASE_URL });
  await client.authenticate(USERNAME, PASSWORD);
  console.log('Authenticated.\n');

  // ── Step 1: Find a workspace type ──
  console.log('Step 1: Find a workspace type with categories');
  const wsTypes = await client.getWorkspaceTypes();
  assert(wsTypes.length > 0, `Found ${wsTypes.length} workspace types`);

  // Prefer "Customer" type since it typically has categories with string attributes
  const preferredNames = ['Customer', 'eCase', 'eFile', 'Employee'];
  let useType = wsTypes.find((t: any) => preferredNames.includes(t.wksp_type_name));
  if (!useType) useType = wsTypes[0];
  console.log(`  Using type: "${useType.wksp_type_name}" (type=${useType.wksp_type_id}, template=${useType.template_id})\n`);

  // ── Step 2: Create a probe workspace to discover its categories & attributes ──
  console.log('Step 2: Create probe workspace to discover categories');
  const probeWs = await client.createWorkspace({
    template_id: useType.template_id,
    name: `_Probe_${Date.now()}`,
  });
  cleanupIds.push(probeWs.id);
  console.log(`  Created probe workspace: ID ${probeWs.id}`);

  const catResult = await client.getCategories(probeWs.id, true);
  console.log(`  Found ${catResult.categories.length} category(ies)`);

  // Find a category with a writable attribute
  let targetCatId: number | null = null;
  let targetAttrKey: string | null = null; // Full key in "catId_attrId" format
  let targetAttrIdOnly: string | null = null; // Just the attribute part

  for (const cat of catResult.categories) {
    if (targetCatId) break;
    console.log(`    - ${cat.name} (ID: ${cat.id}), ${cat.attributes.length} attributes`);
    for (const attr of cat.attributes) {
      console.log(`      attr: ${attr.key} type=${attr.type} value=${JSON.stringify(attr.value)}`);
      if (!targetCatId) {
        targetCatId = cat.id;
        // The key returned by getCategories might be just the attr id (e.g., "0")
        // or already prefixed (e.g., "11150_0"). Normalise to full key.
        if (attr.key.startsWith(`${cat.id}_`)) {
          targetAttrKey = attr.key;
          targetAttrIdOnly = attr.key.replace(`${cat.id}_`, '');
        } else {
          targetAttrKey = `${cat.id}_${attr.key}`;
          targetAttrIdOnly = attr.key;
        }
        console.log(`      → Using: full key="${targetAttrKey}", attr only="${targetAttrIdOnly}"`);
      }
    }
  }

  if (!targetCatId || !targetAttrKey || !targetAttrIdOnly) {
    console.log('\n  ! No suitable attribute found on any category.');
    console.log('  Skipping format tests — only regression test will run.\n');
  }

  // Helper: verify an attribute was set on a workspace via getCategories
  async function verifyAttr(wsId: number, catId: number, fullKey: string, expected: string): Promise<boolean> {
    const cats = await client.getCategories(wsId);
    const cat = cats.categories.find((c: any) => c.id === catId);
    if (!cat) {
      console.log(`    verify: category ${catId} not found on workspace ${wsId}`);
      return false;
    }
    // Attribute key from getCategories might be just the attr part
    const attr = cat.attributes.find((a: any) => a.key === fullKey || `${catId}_${a.key}` === fullKey);
    if (!attr) {
      console.log(`    verify: attribute ${fullKey} not found. Available: ${cat.attributes.map((a: any) => `${a.key}=${JSON.stringify(a.value)}`).join(', ')}`);
      return false;
    }
    const val = typeof attr.value === 'object' ? JSON.stringify(attr.value) : String(attr.value);
    if (val !== expected) {
      console.log(`    verify: attribute ${fullKey} = ${val} (expected "${expected}")`);
      // Consider it a pass if the value contains the expected string (may be wrapped)
      return val.includes(expected);
    }
    return true;
  }

  // ── Step 3: FLAT key format ──
  if (targetCatId && targetAttrKey) {
    console.log('\nStep 3: Create workspace with FLAT key format');
    const testVal = `Flat_${Date.now()}`;
    console.log(`  business_properties: { "${targetAttrKey}": "${testVal}" }`);

    try {
      const ws = await client.createWorkspace({
        template_id: useType.template_id,
        name: `BizProp_Flat_${Date.now()}`,
        business_properties: { [targetAttrKey]: testVal },
      });
      cleanupIds.push(ws.id);
      assert(!!ws.id, `Workspace created: ID ${ws.id}`);

      const propResults = (ws as any)._propertyResults;
      assert(!!propResults, `_propertyResults present`);
      assert(propResults?.updated?.includes(targetCatId), `Category ${targetCatId} in updated list`);

      const ok = await verifyAttr(ws.id, targetCatId, targetAttrKey, testVal);
      assert(ok, `Attribute value matches "${testVal}"`);
    } catch (e: any) {
      assert(false, `Flat format test`, e.message);
    }
  }

  // ── Step 4: NESTED format { "catId": { "attrId": "val" } } ──
  if (targetCatId && targetAttrKey && targetAttrIdOnly) {
    console.log('\nStep 4: Create workspace with NESTED format { catId: { attrId: val } }');
    const testVal = `Nested_${Date.now()}`;
    const props = { [String(targetCatId)]: { [targetAttrIdOnly]: testVal } };
    console.log(`  business_properties: ${JSON.stringify(props)}`);

    try {
      const ws = await client.createWorkspace({
        template_id: useType.template_id,
        name: `BizProp_Nested_${Date.now()}`,
        business_properties: props,
      });
      cleanupIds.push(ws.id);
      assert(!!ws.id, `Workspace created: ID ${ws.id}`);

      const propResults = (ws as any)._propertyResults;
      assert(propResults?.updated?.includes(targetCatId), `Category ${targetCatId} in updated list`);

      const ok = await verifyAttr(ws.id, targetCatId, targetAttrKey, testVal);
      assert(ok, `Attribute value matches "${testVal}"`);
    } catch (e: any) {
      assert(false, `Nested format test`, e.message);
    }
  }

  // ── Step 5: NESTED + FULL KEY format { "catId": { "catId_attrId": "val" } } ──
  if (targetCatId && targetAttrKey) {
    console.log('\nStep 5: Create workspace with NESTED + FULL KEY format');
    const testVal = `NestedFull_${Date.now()}`;
    const props = { [String(targetCatId)]: { [targetAttrKey]: testVal } };
    console.log(`  business_properties: ${JSON.stringify(props)}`);

    try {
      const ws = await client.createWorkspace({
        template_id: useType.template_id,
        name: `BizProp_NestedFull_${Date.now()}`,
        business_properties: props,
      });
      cleanupIds.push(ws.id);
      assert(!!ws.id, `Workspace created: ID ${ws.id}`);

      const propResults = (ws as any)._propertyResults;
      assert(propResults?.updated?.includes(targetCatId), `Category ${targetCatId} in updated list`);

      const ok = await verifyAttr(ws.id, targetCatId, targetAttrKey, testVal);
      assert(ok, `Attribute value matches "${testVal}"`);
    } catch (e: any) {
      assert(false, `Nested+full key format test`, e.message);
    }
  }

  // ── Step 6: MIXED format (flat key) ──
  if (targetCatId && targetAttrKey) {
    console.log('\nStep 6: Create workspace with flat key format (regression)');
    const testVal = `Mixed_${Date.now()}`;
    const props: Record<string, unknown> = {
      [targetAttrKey]: testVal,
    };
    console.log(`  business_properties: ${JSON.stringify(props)}`);

    try {
      const ws = await client.createWorkspace({
        template_id: useType.template_id,
        name: `BizProp_Mixed_${Date.now()}`,
        business_properties: props,
      });
      cleanupIds.push(ws.id);
      assert(!!ws.id, `Workspace created: ID ${ws.id}`);

      const ok = await verifyAttr(ws.id, targetCatId, targetAttrKey, testVal);
      assert(ok, `Attribute populated correctly`);
    } catch (e: any) {
      assert(false, `Mixed format test`, e.message);
    }
  }

  // ── Step 7: No business_properties (regression) ──
  console.log('\nStep 7: Regression — create workspace WITHOUT business_properties');
  try {
    const ws = await client.createWorkspace({
      template_id: useType.template_id,
      name: `BizProp_Plain_${Date.now()}`,
    });
    cleanupIds.push(ws.id);
    assert(!!ws.id, `Workspace created: ID ${ws.id}`);
    const propResults = (ws as any)._propertyResults;
    assert(propResults === undefined, `No _propertyResults when no business_properties passed`);
  } catch (e: any) {
    assert(false, `Plain workspace creation`, e.message);
  }

  // ── Step 8: Empty business_properties (regression) ──
  console.log('\nStep 8: Regression — create workspace with EMPTY business_properties');
  try {
    const ws = await client.createWorkspace({
      template_id: useType.template_id,
      name: `BizProp_Empty_${Date.now()}`,
      business_properties: {},
    });
    cleanupIds.push(ws.id);
    assert(!!ws.id, `Workspace created: ID ${ws.id}`);
    const propResults = (ws as any)._propertyResults;
    assert(propResults === undefined, `No _propertyResults when business_properties is empty`);
  } catch (e: any) {
    assert(false, `Empty business_properties`, e.message);
  }

  // ── Step 9: Invalid category ID — OTCS may silently accept or reject ──
  console.log('\nStep 9: Invalid category ID — should not crash');
  try {
    const ws = await client.createWorkspace({
      template_id: useType.template_id,
      name: `BizProp_BadCat_${Date.now()}`,
      business_properties: { "999999": { "999999_1": "should_fail" } },
    });
    cleanupIds.push(ws.id);
    const propResults = (ws as any)._propertyResults;
    // OTCS may silently accept or reject — either way the workspace should exist
    assert(!!ws.id, `Workspace created despite invalid category: ID ${ws.id}`);
    assert(!!propResults, `_propertyResults present (tracks attempt)`, `got: ${JSON.stringify(propResults)}`);
  } catch (e: any) {
    // Also acceptable: throws when all categories fail
    assert(
      e.message.includes('Failed to apply business properties'),
      `Throws error when all category updates fail`,
      e.message
    );
  }

  // ── Cleanup ──
  console.log('\nCleanup: Deleting test workspaces');
  for (const id of cleanupIds) {
    try {
      await client.deleteNode(id);
      console.log(`  Deleted ${id}`);
    } catch (e: any) {
      console.log(`  ! Could not delete ${id}: ${e.message}`);
    }
  }

  await client.logout();

  // ── Summary ──
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  TOTAL: ${passed + failed} tests — ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Test suite crashed:', e);
  process.exit(1);
});
