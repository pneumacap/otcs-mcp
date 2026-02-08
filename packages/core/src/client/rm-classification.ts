import type {
  RMClassification,
  RMClassificationsResponse,
  RMClassificationApplyParams,
  RMRecordUpdateParams,
} from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    getRMClassifications(nodeId: number): Promise<RMClassificationsResponse>;
    applyRMClassification(
      params: RMClassificationApplyParams,
    ): Promise<{ success: boolean; classification?: RMClassification }>;
    removeRMClassification(nodeId: number, classId: number): Promise<{ success: boolean }>;
    updateRMRecordDetails(params: RMRecordUpdateParams): Promise<{ success: boolean }>;
    makeRMConfidential(nodeId: number): Promise<{ success: boolean }>;
    removeRMConfidential(nodeId: number): Promise<{ success: boolean }>;
    finalizeRMRecords(nodeIds: number[]): Promise<{ success: boolean; finalized_count: number }>;
    /** @internal */ parseRMClassification(data: any): RMClassification;
  }
}

OTCSClient.prototype.getRMClassifications = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<RMClassificationsResponse> {
  const response = await this.request<any>('GET', `/v1/nodes/${nodeId}/rmclassifications`);

  const classifications: RMClassification[] = [];
  const dataArray = response.data || [];
  const metadataToken = response.rm_metadataToken;

  if (Array.isArray(dataArray)) {
    for (const item of dataArray) {
      classifications.push(this.parseRMClassification(item));
    }
  } else if (dataArray && typeof dataArray === 'object') {
    if (dataArray.rmclassifications) {
      for (const item of dataArray.rmclassifications) {
        classifications.push(this.parseRMClassification(item));
      }
    } else if (dataArray.id || dataArray.class_id) {
      classifications.push(this.parseRMClassification(dataArray));
    }
  }

  return {
    node_id: nodeId,
    classifications,
    rm_metadataToken: metadataToken,
  };
};

OTCSClient.prototype.applyRMClassification = async function (
  this: OTCSClient,
  params: RMClassificationApplyParams,
): Promise<{ success: boolean; classification?: RMClassification }> {
  const current = await this.getRMClassifications(params.node_id);

  const formData = new URLSearchParams();
  formData.append('class_id', params.class_id.toString());
  if (current.rm_metadataToken) {
    formData.append('rm_metadataToken', current.rm_metadataToken);
  }
  if (params.official !== undefined) formData.append('official', params.official.toString());
  if (params.vital_record !== undefined)
    formData.append('vital_record', params.vital_record.toString());
  if (params.essential !== undefined) formData.append('essential', params.essential.toString());

  const response = await this.request<any>(
    'POST',
    `/v1/nodes/${params.node_id}/rmclassifications`,
    undefined,
    formData,
  );

  return {
    success: true,
    classification: response.data ? this.parseRMClassification(response.data) : undefined,
  };
};

OTCSClient.prototype.removeRMClassification = async function (
  this: OTCSClient,
  nodeId: number,
  classId: number,
): Promise<{ success: boolean }> {
  const current = await this.getRMClassifications(nodeId);
  let url = `/v1/nodes/${nodeId}/rmclassifications/${classId}`;
  if (current.rm_metadataToken) {
    url += `?rm_metadataToken=${encodeURIComponent(current.rm_metadataToken)}`;
  }
  await this.request<any>('DELETE', url);
  return { success: true };
};

OTCSClient.prototype.updateRMRecordDetails = async function (
  this: OTCSClient,
  params: RMRecordUpdateParams,
): Promise<{ success: boolean }> {
  const current = await this.getRMClassifications(params.node_id);

  const formData = new URLSearchParams();
  if (current.rm_metadataToken) {
    formData.append('rm_metadataToken', current.rm_metadataToken);
  }
  if (params.official !== undefined) formData.append('official', params.official.toString());
  if (params.vital_record !== undefined)
    formData.append('vital_record', params.vital_record.toString());
  if (params.essential !== undefined) formData.append('essential', params.essential.toString());
  if (params.accession_code) formData.append('accession_code', params.accession_code);
  if (params.alt_retention) formData.append('alt_retention', params.alt_retention);
  if (params.comments) formData.append('comments', params.comments);

  await this.request<any>(
    'PUT',
    `/v1/nodes/${params.node_id}/rmclassifications`,
    undefined,
    formData,
  );
  return { success: true };
};

OTCSClient.prototype.makeRMConfidential = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<{ success: boolean }> {
  await this.request<any>('PUT', `/v1/nodes/${nodeId}/rmclassifications/makeConfidential`);
  return { success: true };
};

OTCSClient.prototype.removeRMConfidential = async function (
  this: OTCSClient,
  nodeId: number,
): Promise<{ success: boolean }> {
  await this.request<any>('PUT', `/v1/nodes/${nodeId}/rmclassifications/removeConfidential`);
  return { success: true };
};

OTCSClient.prototype.finalizeRMRecords = async function (
  this: OTCSClient,
  nodeIds: number[],
): Promise<{ success: boolean; finalized_count: number }> {
  const formData = new URLSearchParams();
  formData.append('ids', nodeIds.join(','));

  await this.request<any>('PUT', `/v1/rmclassifications/finalizerecords`, undefined, formData);
  return { success: true, finalized_count: nodeIds.length };
};

OTCSClient.prototype.parseRMClassification = function (
  this: OTCSClient,
  data: any,
): RMClassification {
  return {
    id: data.rmclassification_id || data.id || data.class_id || 0,
    name: data.name || data.classification_name || '',
    class_id: data.rmclassification_id || data.class_id,
    classification_id: data.rmclassification_id || data.classification_id,
    classification_name: data.classification_name,
    official: data.official,
    vital_record: data.vital_record,
    confidential: data.confidential,
    finalized: data.finalized,
    essential: data.essential,
    rsi_id: data.rsi_id,
    rsi_name: data.rsi_name,
    status: data.file_status || data.status,
    create_date: data.record_date || data.create_date,
    modify_date: data.status_date || data.modify_date,
  };
};
