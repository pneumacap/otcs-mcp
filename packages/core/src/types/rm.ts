// ============ Records Management Types ============

/**
 * RM Classification on a node
 */
export interface RMClassification {
  id: number;
  name: string;
  class_id?: number;
  classification_id?: number;
  classification_name?: string;
  official?: boolean;
  vital_record?: boolean;
  confidential?: boolean;
  finalized?: boolean;
  essential?: boolean;
  rsi_id?: number;
  rsi_name?: string;
  status?: string;
  create_date?: string;
  modify_date?: string;
}

/**
 * RM Classifications response
 */
export interface RMClassificationsResponse {
  node_id: number;
  classifications: RMClassification[];
  rm_metadataToken?: string;
}

/**
 * Parameters for applying RM classification
 */
export interface RMClassificationApplyParams {
  node_id: number;
  class_id: number;
  official?: boolean;
  vital_record?: boolean;
  essential?: boolean;
}

/**
 * Parameters for updating record details
 */
export interface RMRecordUpdateParams {
  node_id: number;
  official?: boolean;
  vital_record?: boolean;
  essential?: boolean;
  accession_code?: string;
  alt_retention?: string;
  comments?: string;
}

/**
 * Hold (Legal or Administrative)
 */
export interface RMHold {
  id: number;
  name: string;
  comment?: string;
  type?: string; // 'LegalHold' or 'AdminHold'
  type_name?: string;
  parent_id?: number;
  create_date?: string;
  modify_date?: string;
  create_user_id?: number;
  items_count?: number;
  alternate_hold_id?: string;
}

/**
 * Hold list response
 */
export interface RMHoldsResponse {
  holds: RMHold[];
  total_count?: number;
}

/**
 * Node holds response
 */
export interface RMNodeHoldsResponse {
  node_id: number;
  holds: RMHold[];
}

/**
 * Hold items response
 */
export interface RMHoldItemsResponse {
  hold_id: number;
  items: Array<{
    id: number;
    name: string;
    type: number;
    type_name: string;
  }>;
  total_count?: number;
  page?: number;
  limit?: number;
}

/**
 * Hold users response
 */
export interface RMHoldUsersResponse {
  hold_id: number;
  users: Array<{
    id: number;
    name: string;
    display_name?: string;
  }>;
}

/**
 * Parameters for creating/updating a hold
 */
export interface RMHoldParams {
  name: string;
  comment?: string;
  type?: string;
  parent_id?: number;
  alternate_hold_id?: string;
  date_applied?: string; // YYYY-MM-DD format, defaults to today
}

/**
 * Cross-reference type
 */
export interface RMCrossRefType {
  name: string;
  description?: string;
  in_use?: boolean;
}

/**
 * Cross-reference on a node
 */
export interface RMCrossRef {
  xref_type: string;
  xref_type_name?: string;
  ref_node_id: number;
  ref_node_name?: string;
  ref_node_type?: number;
  ref_node_type_name?: string;
}

/**
 * Node cross-references response
 */
export interface RMNodeCrossRefsResponse {
  node_id: number;
  cross_references: RMCrossRef[];
}

/**
 * All cross-reference types response
 */
export interface RMCrossRefTypesResponse {
  types: RMCrossRefType[];
}

/**
 * Parameters for applying cross-reference
 */
export interface RMCrossRefApplyParams {
  node_id: number;
  xref_type: string;
  ref_node_id: number;
  comment?: string;
}

// ============ RSI (Record Series Identifier) Types ============

/**
 * RSI Schedule stage - defines retention period and disposition action
 */
export interface RMRSISchedule {
  id: number;
  rsi_id: number;
  stage: string;
  object_type: 'LIV' | 'LRM'; // LIV = Classified Objects, LRM = RM Classifications
  event_type: number; // 1=Calculated Date, 2=Calendar, 3=Event Based, 4=Fixed Date, 5=Permanent
  date_to_use?: number; // 91=Create, 92=Reserved, 93=Modify, 94=Status, 95=Record, etc.
  retention_years?: number;
  retention_months?: number;
  retention_days?: number;
  action_code?: number; // 0=None, 1=Change Status, 7=Close, 8=Finalize, 9=Mark Official, 32=Destroy, etc.
  disposition?: string;
  description?: string;
  new_status?: string;
  rule_code?: string;
  rule_comment?: string;
  fixed_date?: string;
  event_condition?: string;
  year_end_month?: number;
  year_end_day?: number;
  approved?: boolean;
  approval_date?: string;
  approved_by?: number;
}

/**
 * RSI (Record Series Identifier) - retention schedule
 */
export interface RMRSI {
  id: number;
  name: string;
  status: string;
  status_date?: string;
  description?: string;
  subject?: string;
  title?: string;
  disp_control?: boolean;
  discontinued?: boolean;
  discontinue_date?: string;
  discontinue_comment?: string;
  source_app?: string;
  editing_app?: string;
  schedules?: RMRSISchedule[];
}

/**
 * RSI list response
 */
export interface RMRSIListResponse {
  rsis: RMRSI[];
  total_count: number;
  page?: number;
  limit?: number;
}

/**
 * RSI items response - nodes assigned to an RSI
 */
export interface RMRSIItemsResponse {
  rsi_id: number;
  items: Array<{
    id: number;
    name: string;
    type: number;
    type_name: string;
  }>;
  total_count: number;
  page?: number;
  limit?: number;
}

/**
 * Node RSIs response - RSIs assigned to a node
 */
export interface RMNodeRSIsResponse {
  node_id: number;
  rsis: Array<{
    rsi_id: number;
    rsi_name: string;
    class_id?: number;
    class_name?: string;
  }>;
}

/**
 * Parameters for creating an RSI
 */
export interface RMRSICreateParams {
  name: string;
  status: string;
  status_date?: string;
  description?: string;
  subject?: string;
  title?: string;
  disp_control?: boolean;
  source_app?: string;
  editing_app?: string;
}

/**
 * Parameters for updating an RSI
 */
export interface RMRSIUpdateParams {
  name?: string;
  new_name?: string;
  status?: string;
  status_date?: string;
  description?: string;
  subject?: string;
  title?: string;
  discontinue?: boolean;
  discontinue_date?: string;
  discontinue_comment?: string;
  disp_control?: boolean;
  editing_app?: string;
}

/**
 * Parameters for creating an RSI schedule
 */
export interface RMRSIScheduleCreateParams {
  rsi_id: number;
  stage: string;
  object_type: 'LIV' | 'LRM';
  event_type: number;
  date_to_use?: number;
  retention_years?: number;
  retention_months?: number;
  retention_days?: number;
  action_code?: number;
  disposition?: string;
  description?: string;
  new_status?: string;
  rule_code?: string;
  rule_comment?: string;
  fixed_date?: string;
  event_condition?: string;
  year_end_month?: number;
  year_end_day?: number;
  category_id?: number;
  category_attribute_id?: number;
  fixed_retention?: boolean;
  maximum_retention?: boolean;
  retention_intervals?: number;
  min_num_versions_to_keep?: number;
  purge_superseded?: boolean;
  purge_majors?: boolean;
  mark_official_rendition?: boolean;
}

/**
 * Parameters for assigning RSI to a classified node
 */
export interface RMRSIAssignParams {
  node_id: number;
  class_id: number;
  rsi_id: number;
  status_date?: string;
}
