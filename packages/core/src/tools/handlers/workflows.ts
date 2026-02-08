/**
 * Workflow handlers — otcs_get_assignments, otcs_workflow_status,
 * otcs_workflow_definition, otcs_workflow_tasks, otcs_workflow_activities,
 * otcs_start_workflow, otcs_workflow_form, otcs_workflow_task,
 * otcs_draft_workflow, otcs_workflow_info, otcs_manage_workflow
 */

import type { OTCSClient } from '../../client/otcs-client';
import type { HandlerFn } from './index';

export const workflowHandlers: Record<string, HandlerFn> = {
  otcs_get_assignments: async (client: OTCSClient, _args: Record<string, unknown>) => {
    const assignments = await client.getAssignments();
    return {
      assignments,
      count: assignments.length,
      message:
        assignments.length > 0 ? `Found ${assignments.length} pending task(s)` : 'No pending tasks',
    };
  },

  otcs_workflow_status: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      mode,
      status,
      kind,
      map_id,
      search_name,
      business_workspace_id,
      start_date,
      end_date,
      wfretention,
    } = args as any;
    if (mode === 'active') {
      const workflows = await client.getActiveWorkflows({
        map_id,
        search_name,
        business_workspace_id,
        start_date,
        end_date,
        status,
        kind,
      });
      return {
        workflows,
        count: workflows.length,
        filters: { map_id, status, kind },
      };
    }
    const workflows = await client.getWorkflowStatus({
      wstatus: status,
      kind,
      wfretention,
    });
    return { workflows, count: workflows.length, filters: { status, kind } };
  },

  otcs_workflow_definition: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { map_id } = args as { map_id: number };
    const definition = await client.getWorkflowDefinition(map_id);
    return {
      definition,
      task_count: definition.tasks?.length || 0,
      data_package_count: definition.data_packages?.length || 0,
    };
  },

  otcs_workflow_tasks: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { process_id } = args as { process_id: number };
    const taskList = await client.getWorkflowTasks(process_id);
    return {
      ...taskList,
      summary: {
        completed: taskList.tasks?.completed?.length || 0,
        current: taskList.tasks?.current?.length || 0,
        next: taskList.tasks?.next?.length || 0,
      },
    };
  },

  otcs_workflow_activities: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { process_id, subprocess_id, limit } = args as {
      process_id: number;
      subprocess_id: number;
      limit?: number;
    };
    const activities = await client.getWorkflowActivities(process_id, subprocess_id, limit);
    return { activities, count: activities.length };
  },

  otcs_start_workflow: async (client: OTCSClient, args: Record<string, unknown>) => {
    // Default to direct mode - most reliable for starting workflows with attachments
    const { mode, workflow_id, doc_ids, role_info, attach_documents } = args as {
      mode?: string;
      workflow_id: number;
      doc_ids?: string;
      role_info?: Record<string, number>;
      attach_documents?: boolean;
    };
    const startMode = mode || 'direct';
    if (startMode === 'draft') {
      const result = await client.createDraftWorkflow(
        workflow_id,
        doc_ids,
        attach_documents ?? true,
      );
      return {
        success: true,
        draftprocess_id: result.draftprocess_id,
        workflow_type: result.workflow_type,
        message: `Draft workflow created with ID ${result.draftprocess_id}`,
      };
    } else if (startMode === 'initiate') {
      const result = await client.initiateWorkflow({
        workflow_id,
        role_info,
      });
      return {
        success: true,
        work_id: result.work_id,
        workflow_id: result.workflow_id,
        message: `Workflow initiated with instance ID ${result.work_id}`,
      };
    } else {
      const result = await client.startWorkflow(workflow_id, doc_ids);
      return {
        success: true,
        work_id: result.work_id,
        message: `Workflow started with instance ID ${result.work_id}`,
      };
    }
  },

  otcs_workflow_form: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { process_id, subprocess_id, task_id, detailed } = args as {
      process_id: number;
      subprocess_id: number;
      task_id: number;
      detailed?: boolean;
    };

    if (detailed) {
      const formInfo = await client.getWorkflowTaskFormFull(process_id, subprocess_id, task_id);
      const fields: Record<string, any> = {};
      for (const form of formInfo.forms) {
        if (form.schema?.properties) {
          for (const [key, prop] of Object.entries(form.schema.properties)) {
            fields[key] = {
              type: prop.type || 'string',
              label: form.options?.fields?.[key]?.label,
              required: form.schema.required?.includes(key),
              readonly: prop.readonly || form.options?.fields?.[key]?.readonly,
            };
          }
        }
      }
      return {
        title: formInfo.data.title,
        instructions: formInfo.data.instructions,
        priority: formInfo.data.priority,
        comments_enabled: formInfo.data.comments_on,
        attachments_enabled: formInfo.data.attachments_on,
        requires_accept: formInfo.data.member_accept,
        requires_authentication: formInfo.data.authentication,
        actions:
          formInfo.data.actions?.map((a: any) => ({
            key: a.key,
            label: a.label,
          })) || [],
        custom_actions:
          formInfo.data.custom_actions?.map((a: any) => ({
            key: a.key,
            label: a.label,
          })) || [],
        fields,
        form_count: formInfo.forms.length,
        raw_forms: formInfo.forms,
      };
    }

    const form = await client.getWorkflowTaskForm(process_id, subprocess_id, task_id);
    return {
      form,
      available_actions: form.actions?.map((a: any) => a.key) || [],
      custom_actions: form.custom_actions?.map((a: any) => a.key) || [],
    };
  },

  otcs_workflow_task: async (client: OTCSClient, args: Record<string, unknown>) => {
    const {
      action,
      process_id,
      subprocess_id,
      task_id,
      disposition,
      custom_action,
      comment,
      form_data,
    } = args as {
      action?: string;
      process_id: number;
      subprocess_id: number;
      task_id: number;
      disposition?: string;
      custom_action?: string;
      comment?: string;
      form_data?: Record<string, string>;
    };
    const taskAction = action || 'send';

    if (taskAction === 'check_group') {
      const isGroup = await client.checkGroupAssignment(process_id, subprocess_id, task_id);
      return {
        is_group_assignment: isGroup,
        requires_accept: isGroup,
        message: isGroup
          ? 'Task is group-assigned. Accept it first.'
          : 'Task is individually assigned.',
      };
    }

    if (taskAction === 'accept') {
      const result = await client.acceptWorkflowTask(process_id, subprocess_id, task_id);
      return {
        success: result.success,
        message: result.message || 'Task accepted',
        task_id,
        process_id,
      };
    }

    await client.sendWorkflowTask({
      process_id,
      subprocess_id,
      task_id,
      action: disposition,
      custom_action,
      comment,
      form_data,
    });
    const actionDesc = disposition || custom_action || 'action';
    return {
      success: true,
      message: `Task ${task_id} completed with ${actionDesc}`,
      details: {
        process_id,
        subprocess_id,
        task_id,
        action: actionDesc,
        comment,
        form_data,
      },
    };
  },

  otcs_draft_workflow: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, draftprocess_id, values, comment } = args as {
      action: string;
      draftprocess_id: number;
      values?: Record<string, unknown>;
      comment?: string;
    };

    if (action === 'get_form') {
      const formInfo = await client.getDraftWorkflowForm(draftprocess_id);
      const fields: Record<string, any> = {};
      for (const form of formInfo.forms) {
        if (form.schema?.properties) {
          for (const [key, prop] of Object.entries(form.schema.properties)) {
            fields[key] = {
              type: prop.type || 'string',
              label: form.options?.fields?.[key]?.label,
              required: form.schema.required?.includes(key),
              current_value: form.data?.[key],
            };
          }
        }
      }
      return {
        title: formInfo.data.title,
        instructions: formInfo.data.instructions,
        fields,
        form_count: formInfo.forms.length,
        raw_forms: formInfo.forms,
      };
    }

    if (action === 'update_form' || action === 'initiate') {
      const updateAction = action === 'initiate' ? 'Initiate' : 'formUpdate';
      await client.updateDraftWorkflowForm({
        draftprocess_id,
        action: updateAction,
        comment,
        values,
      });
      return {
        success: true,
        message:
          action === 'initiate'
            ? `Workflow initiated from draft ${draftprocess_id}`
            : `Form updated for draft ${draftprocess_id}`,
        values_updated: values ? Object.keys(values) : [],
      };
    }

    throw new Error(`Unknown action: ${action}`);
  },

  otcs_workflow_info: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { work_id } = args as { work_id: number };
    return await client.getWorkflowInfoFull(work_id);
  },

  otcs_manage_workflow: async (client: OTCSClient, args: Record<string, unknown>) => {
    const { action, process_id } = args as {
      action: string;
      process_id: number;
    };
    if (action === 'delete') {
      await client.deleteWorkflow(process_id);
      return { success: true, message: `Workflow ${process_id} deleted` };
    }
    await client.updateWorkflowStatus(process_id, action as any);
    return {
      success: true,
      message: `Workflow ${process_id} status changed to ${action}`,
    };
  },
};
