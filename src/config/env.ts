/**
 * Centralised environment URLs for the ParaBank automation framework.
 *
 * - UI_BASE_URL:  Origin used by the browser (Page) for all user-facing navigation.
 * - API_BASE_URL: REST service root used by APIRequestContext for admin/service calls.
 *
 * Keeping these separate guarantees that UI tests never resolve relative
 * navigation against the API base (and that API calls never resolve against
 * the UI origin by accident).
 */
export const UI_BASE_URL = 'https://parabank.parasoft.com';

export const API_BASE_URL = 'https://parabank.parasoft.com/parabank/services/bank';
