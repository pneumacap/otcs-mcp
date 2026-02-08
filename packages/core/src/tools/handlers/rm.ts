/**
 * Records Management handlers — otcs_rm_classification, otcs_rm_holds,
 * otcs_rm_xref, otcs_rm_rsi
 */

import type { OTCSClient } from '../../client/otcs-client';
import type { HandlerFn } from './index';

export const rmHandlers: Record<string, HandlerFn> = {
  otcs_rm_classification: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      action,
      node_id,
      node_ids,
      classification_id,
      name,
      official,
      storage,
      accession,
      subject,
    } = args as {
      action: string;
      node_id?: number;
      node_ids?: number[];
      classification_id?: number;
      name?: string;
      official?: boolean;
      storage?: string;
      accession?: string;
      subject?: string;
    };

    const CLASSIFICATION_VOLUME_ID = 2046;

    switch (action) {
      case 'browse_tree': {
        const browseId = node_id || CLASSIFICATION_VOLUME_ID;
        const browseResult = await client.getSubnodes(browseId, {
          limit: 100,
        });
        return {
          parent_id: browseId,
          parent_name: browseResult.folder?.name || 'Classification Volume',
          classifications: browseResult.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            type_name: item.type_name,
            description: item.description,
            has_children: item.container_size > 0,
            child_count: item.container_size,
          })),
          count: browseResult.items.length,
          message:
            browseId === CLASSIFICATION_VOLUME_ID
              ? `Classification Volume root contains ${browseResult.items.length} item(s).`
              : `Found ${browseResult.items.length} item(s) in classification folder ${browseId}`,
        };
      }
      case 'get_node_classifications': {
        if (!node_id) throw new Error('node_id required');
        const classResult = await client.getRMClassifications(node_id);
        return {
          node_id,
          classifications: classResult.classifications,
          count: classResult.classifications.length,
        };
      }
      case 'declare': {
        if (!node_id || !classification_id)
          throw new Error('node_id and classification_id required');
        const declareResult = await client.applyRMClassification({
          node_id,
          class_id: classification_id,
          official,
        });
        return {
          success: true,
          result: declareResult,
          message: `Node ${node_id} declared as record`,
        };
      }
      case 'undeclare': {
        if (!node_id || !classification_id)
          throw new Error('node_id and classification_id required');
        const undeclareResult = await client.removeRMClassification(node_id, classification_id);
        return {
          success: true,
          result: undeclareResult,
          message: `Record classification removed from node ${node_id}`,
        };
      }
      case 'update_details': {
        if (!node_id) throw new Error('node_id required');
        const updateResult = await client.updateRMRecordDetails({
          node_id,
          official,
          accession_code: accession,
          comments: subject,
        });
        return {
          success: true,
          result: updateResult,
          message: `Record ${node_id} details updated`,
        };
      }
      case 'make_confidential': {
        if (!node_id) throw new Error('node_id required');
        const confResult = await client.makeRMConfidential(node_id);
        return {
          success: true,
          result: confResult,
          message: `Node ${node_id} marked as confidential`,
        };
      }
      case 'remove_confidential': {
        if (!node_id) throw new Error('node_id required');
        const unconfResult = await client.removeRMConfidential(node_id);
        return {
          success: true,
          result: unconfResult,
          message: `Confidential flag removed from node ${node_id}`,
        };
      }
      case 'finalize': {
        if (!node_id && !node_ids) throw new Error('node_id or node_ids required');
        const idsToFinalize = node_ids || [node_id!];
        const finalizeResult = await client.finalizeRMRecords(idsToFinalize);
        return {
          success: true,
          result: finalizeResult,
          message: `${idsToFinalize.length} record(s) finalized`,
          node_ids: idsToFinalize,
        };
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },

  otcs_rm_holds: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, hold_id, node_id, node_ids, user_ids, name, hold_type, comment, alternate_id } =
      args as {
        action: string;
        hold_id?: number;
        node_id?: number;
        node_ids?: number[];
        user_ids?: number[];
        name?: string;
        hold_type?: 'Legal' | 'Administrative';
        comment?: string;
        alternate_id?: string;
      };

    switch (action) {
      case 'list_holds': {
        const holdsResult = await client.listRMHolds();
        return {
          holds: holdsResult.holds,
          count: holdsResult.holds.length,
          message: `Found ${holdsResult.holds.length} hold(s)`,
        };
      }
      case 'get_hold': {
        if (!hold_id) throw new Error('hold_id required');
        const hold = await client.getRMHold(hold_id);
        return { hold, message: `Retrieved hold ${hold_id}` };
      }
      case 'create_hold': {
        if (!name) throw new Error('name required');
        const newHold = await client.createRMHold({
          name,
          comment,
          type: hold_type,
          alternate_hold_id: alternate_id,
        });
        return {
          success: true,
          hold: newHold,
          message: `Hold "${name}" created`,
        };
      }
      case 'update_hold': {
        if (!hold_id) throw new Error('hold_id required');
        const updatedHold = await client.updateRMHold(hold_id, {
          name,
          comment,
          alternate_hold_id: alternate_id,
        });
        return {
          success: true,
          hold: updatedHold,
          message: `Hold ${hold_id} updated`,
        };
      }
      case 'delete_hold':
        if (!hold_id) throw new Error('hold_id required');
        await client.deleteRMHold(hold_id);
        return { success: true, message: `Hold ${hold_id} deleted` };
      case 'get_node_holds': {
        if (!node_id) throw new Error('node_id required');
        const nodeHoldsResult = await client.getNodeRMHolds(node_id);
        return {
          node_id,
          holds: nodeHoldsResult.holds,
          count: nodeHoldsResult.holds.length,
        };
      }
      case 'apply_hold': {
        if (!hold_id || !node_id) throw new Error('hold_id and node_id required');
        const applyResult = await client.applyRMHold(node_id, hold_id);
        return {
          success: true,
          result: applyResult,
          message: `Hold ${hold_id} applied to node ${node_id}`,
        };
      }
      case 'remove_hold': {
        if (!hold_id || !node_id) throw new Error('hold_id and node_id required');
        const removeResult = await client.removeRMHold(node_id, hold_id);
        return {
          success: true,
          result: removeResult,
          message: `Hold ${hold_id} removed from node ${node_id}`,
        };
      }
      case 'apply_batch': {
        if (!hold_id || !node_ids || node_ids.length === 0)
          throw new Error('hold_id and node_ids required');
        const applyBatchResult = await client.applyRMHoldBatch(node_ids, hold_id);
        return {
          success: applyBatchResult.success,
          result: applyBatchResult,
          message: `Hold ${hold_id} applied to ${applyBatchResult.count}/${node_ids.length} node(s)${applyBatchResult.failed.length > 0 ? `, ${applyBatchResult.failed.length} failed` : ''}`,
        };
      }
      case 'remove_batch': {
        if (!hold_id || !node_ids || node_ids.length === 0)
          throw new Error('hold_id and node_ids required');
        const removeBatchResult = await client.removeRMHoldBatch(node_ids, hold_id);
        return {
          success: removeBatchResult.success,
          result: removeBatchResult,
          message: `Hold ${hold_id} removed from ${removeBatchResult.count}/${node_ids.length} node(s)${removeBatchResult.failed.length > 0 ? `, ${removeBatchResult.failed.length} failed` : ''}`,
        };
      }
      case 'get_hold_items': {
        if (!hold_id) throw new Error('hold_id required');
        const holdItemsResult = await client.getRMHoldItems(hold_id);
        return {
          hold_id,
          items: holdItemsResult.items,
          count: holdItemsResult.items.length,
          total_count: holdItemsResult.total_count,
        };
      }
      case 'get_hold_users': {
        if (!hold_id) throw new Error('hold_id required');
        const holdUsersResult = await client.getRMHoldUsers(hold_id);
        return {
          hold_id,
          users: holdUsersResult.users,
          count: holdUsersResult.users.length,
        };
      }
      case 'add_hold_users': {
        if (!hold_id || !user_ids || user_ids.length === 0)
          throw new Error('hold_id and user_ids required');
        const addUsersResult = await client.addRMHoldUsers(hold_id, user_ids);
        return {
          success: true,
          result: addUsersResult,
          message: `${user_ids.length} user(s) added to hold ${hold_id}`,
        };
      }
      case 'remove_hold_users': {
        if (!hold_id || !user_ids || user_ids.length === 0)
          throw new Error('hold_id and user_ids required');
        const removeUsersResult = await client.removeRMHoldUsers(hold_id, user_ids);
        return {
          success: true,
          result: removeUsersResult,
          message: `${user_ids.length} user(s) removed from hold ${hold_id}`,
        };
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },

  otcs_rm_xref: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      action,
      type_name,
      node_id,
      target_node_id,
      node_ids,
      target_node_ids,
      name,
      reciprocal_name,
    } = args as {
      action: string;
      type_name?: string;
      node_id?: number;
      target_node_id?: number;
      node_ids?: number[];
      target_node_ids?: number[];
      name?: string;
      reciprocal_name?: string;
    };

    switch (action) {
      case 'list_types': {
        const xrefTypesResult = await client.listRMCrossRefTypes();
        return {
          types: xrefTypesResult.types,
          count: xrefTypesResult.types.length,
        };
      }
      case 'get_type': {
        if (!type_name) throw new Error('type_name required');
        const xrefType = await client.getRMCrossRefType(type_name);
        return { type: xrefType };
      }
      case 'create_type': {
        if (!name) throw new Error('name required');
        const newType = await client.createRMCrossRefType(name, reciprocal_name);
        return {
          success: true,
          type: newType,
          message: `Cross-reference type "${name}" created`,
        };
      }
      case 'delete_type':
        if (!type_name) throw new Error('type_name required');
        await client.deleteRMCrossRefType(type_name);
        return {
          success: true,
          message: `Cross-reference type "${type_name}" deleted`,
        };
      case 'get_node_xrefs': {
        if (!node_id) throw new Error('node_id required');
        const nodeXrefsResult = await client.getNodeRMCrossRefs(node_id);
        return {
          node_id,
          cross_references: nodeXrefsResult.cross_references,
          count: nodeXrefsResult.cross_references.length,
        };
      }
      case 'apply': {
        if (!node_id || !target_node_id || !type_name)
          throw new Error('node_id, target_node_id, and type_name required');
        const applyXrefResult = await client.applyRMCrossRef({
          node_id,
          ref_node_id: target_node_id,
          xref_type: type_name,
        });
        return {
          success: true,
          result: applyXrefResult,
          message: `Cross-reference created between ${node_id} and ${target_node_id}`,
        };
      }
      case 'remove': {
        if (!node_id || !target_node_id || !type_name)
          throw new Error('node_id, target_node_id, and type_name required');
        const removeXrefResult = await client.removeRMCrossRef(node_id, type_name, target_node_id);
        return { success: true, result: removeXrefResult };
      }
      case 'apply_batch': {
        if (!node_ids || !target_node_ids || !type_name)
          throw new Error('node_ids, target_node_ids, and type_name required');
        if (node_ids.length !== target_node_ids.length)
          throw new Error('node_ids and target_node_ids must have same length');
        const applyBatchResult = await client.applyRMCrossRefBatch(
          node_ids,
          type_name,
          target_node_ids[0],
        );
        return {
          success: true,
          result: applyBatchResult,
          message: `${node_ids.length} cross-reference(s) created`,
        };
      }
      case 'remove_batch': {
        if (!node_ids || !target_node_ids || !type_name)
          throw new Error('node_ids, target_node_ids, and type_name required');
        if (node_ids.length !== target_node_ids.length)
          throw new Error('node_ids and target_node_ids must have same length');
        const removeBatchResult = await client.removeRMCrossRefBatch(
          node_ids,
          type_name,
          target_node_ids[0],
        );
        return {
          success: true,
          result: removeBatchResult,
          message: `${node_ids.length} cross-reference(s) removed`,
        };
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },

  otcs_rm_rsi: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      action,
      rsi_id,
      node_id,
      class_id,
      stage_id,
      name,
      new_name,
      status,
      status_date,
      description,
      subject,
      title,
      disp_control,
      discontinue,
      discontinue_date,
      discontinue_comment,
      stage,
      object_type,
      event_type,
      date_to_use,
      retention_years,
      retention_months,
      retention_days,
      action_code,
      disposition,
      comment,
      page,
      limit,
    } = args as {
      action: string;
      rsi_id?: number;
      node_id?: number;
      class_id?: number;
      stage_id?: number;
      name?: string;
      new_name?: string;
      status?: string;
      status_date?: string;
      description?: string;
      subject?: string;
      title?: string;
      disp_control?: boolean;
      discontinue?: boolean;
      discontinue_date?: string;
      discontinue_comment?: string;
      stage?: string;
      object_type?: 'LIV' | 'LRM';
      event_type?: number;
      date_to_use?: number;
      retention_years?: number;
      retention_months?: number;
      retention_days?: number;
      action_code?: number;
      disposition?: string;
      comment?: string;
      page?: number;
      limit?: number;
    };

    switch (action) {
      case 'list': {
        const listResult = await client.listRMRSIs({ page, limit });
        return {
          rsis: listResult.rsis,
          count: listResult.rsis.length,
          total_count: listResult.total_count,
        };
      }
      case 'get': {
        if (!rsi_id) throw new Error('rsi_id required');
        const rsi = await client.getRMRSI(rsi_id);
        return {
          rsi,
          schedule_count: rsi.schedules?.length || 0,
        };
      }
      case 'create': {
        if (!name || !status) throw new Error('name and status required');
        const newRsi = await client.createRMRSI({
          name,
          status,
          status_date,
          description,
          subject,
          title,
          disp_control,
        });
        return {
          success: true,
          rsi: newRsi,
          message: `RSI "${name}" created with ID ${newRsi.id}`,
        };
      }
      case 'update': {
        if (!rsi_id) throw new Error('rsi_id required');
        const updatedRsi = await client.updateRMRSI(rsi_id, {
          new_name,
          status,
          status_date,
          description,
          subject,
          title,
          disp_control,
          discontinue,
          discontinue_date,
          discontinue_comment,
        });
        return {
          success: true,
          rsi: updatedRsi,
          message: `RSI ${rsi_id} updated`,
        };
      }
      case 'delete':
        if (!rsi_id) throw new Error('rsi_id required');
        await client.deleteRMRSI(rsi_id);
        return { success: true, message: `RSI ${rsi_id} deleted` };
      case 'get_node_rsis': {
        if (!node_id) throw new Error('node_id required');
        const nodeRsisResult = await client.getNodeRMRSIs(node_id);
        return {
          node_id,
          rsis: nodeRsisResult.rsis,
          count: nodeRsisResult.rsis.length,
        };
      }
      case 'assign':
        if (!node_id || !class_id || !rsi_id)
          throw new Error('node_id, class_id, and rsi_id required');
        await client.assignRMRSI({ node_id, class_id, rsi_id, status_date });
        return {
          success: true,
          message: `RSI ${rsi_id} assigned to node ${node_id}`,
        };
      case 'remove':
        if (!node_id || !class_id) throw new Error('node_id and class_id required');
        await client.removeRMRSI(node_id, class_id);
        return {
          success: true,
          message: `RSI removed from node ${node_id}`,
        };
      case 'get_items': {
        if (!rsi_id) throw new Error('rsi_id required');
        const itemsResult = await client.getRMRSIItems(rsi_id, {
          page,
          limit,
        });
        return {
          rsi_id,
          items: itemsResult.items,
          count: itemsResult.items.length,
          total_count: itemsResult.total_count,
        };
      }
      case 'get_schedules': {
        if (!rsi_id) throw new Error('rsi_id required');
        const schedules = await client.getRMRSISchedules(rsi_id);
        return {
          rsi_id,
          schedules,
          count: schedules.length,
        };
      }
      case 'create_schedule': {
        if (!rsi_id || !stage || !object_type || event_type === undefined)
          throw new Error('rsi_id, stage, object_type, and event_type required');
        const newSchedule = await client.createRMRSISchedule({
          rsi_id,
          stage,
          object_type,
          event_type,
          date_to_use,
          retention_years,
          retention_months,
          retention_days,
          action_code,
          disposition,
          description,
        });
        return {
          success: true,
          schedule: newSchedule,
          message: `Schedule stage "${stage}" created for RSI ${rsi_id}`,
        };
      }
      case 'approve_schedule':
        if (!rsi_id || !stage_id) throw new Error('rsi_id and stage_id required');
        await client.approveRMRSISchedule(rsi_id, stage_id, comment);
        return {
          success: true,
          message: `Schedule stage ${stage_id} approved`,
        };
      case 'get_approval_history': {
        if (!rsi_id) throw new Error('rsi_id required');
        const history = await client.getRMRSIApprovalHistory(rsi_id);
        return { rsi_id, history, count: history.length };
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
};
