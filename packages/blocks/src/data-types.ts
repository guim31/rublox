/**
 * Blocks of data and services (J5, SPEC § 4.5): tables of the Data tab, API connections,
 * objects (JSON) and "when the shared variable changes". Types are saved in projects: never
 * rename one.
 */
export const DATA_BLOCK_TYPES = {
  tableRows: 'rx_table_rows',
  tableWhere: 'rx_table_where',
  tableCount: 'rx_table_count',
  tableSort: 'rx_table_sort',
  tableGet: 'rx_table_get',
  tableAdd: 'rx_table_add',
  tableSet: 'rx_table_set',
  tableRemove: 'rx_table_remove',
  tableClear: 'rx_table_clear',
  tableOnChange: 'rx_table_on_change',
  sharedOnChange: 'rx_shared_on_change',
  apiRequest: 'rx_api_request',
  apiSend: 'rx_api_send',
  objectGet: 'rx_object_get',
  objectCreate: 'rx_object_create',
  objectSet: 'rx_object_set',
  jsonParse: 'rx_json_parse',
  jsonStringify: 'rx_json_stringify',
} as const
