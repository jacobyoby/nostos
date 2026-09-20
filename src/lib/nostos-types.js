/**
 * @typedef {object} ContactField
 * @property {string} value
 * @property {string | null} [verified_on]
 *
 * @typedef {object} Service
 * @property {string} name
 * @property {string | null} [evidence_url]
 * @property {string | null} [verified_on]
 *
 * @typedef {object} HoursSlot
 * @property {string} day
 * @property {string} open
 * @property {string} close
 *
 * @typedef {object} LibraryRecord
 * @property {string} fscskey
 * @property {string} fscs_seq
 * @property {string} system_name
 * @property {string} outlet_name
 * @property {string} [outlet_type]
 * @property {string} [address]
 * @property {string} [city]
 * @property {string} [zip]
 * @property {string} [county]
 * @property {string} [phone]
 * @property {number} [lat]
 * @property {number} [lon]
 * @property {number} [hours_open_weekly]
 * @property {HoursSlot[] | { days?: HoursSlot[], source_url?: string | null, verified_on?: string | null } | null} [hours]
 * @property {string} [website]
 * @property {string | null} [municipality_code]
 * @property {boolean | null} [has_legal_help_program]
 * @property {string | null} [legal_help_evidence]
 * @property {Service[] | null} [services]
 * @property {ContactField | string | null} [admin_phone]
 * @property {ContactField | string | null} [admin_email]
 * @property {ContactField | string | null} [contact_form_url]
 * @property {ContactField | string | null} [director]
 * @property {ContactField | string | null} [board_url]
 * @property {{ status?: string; notes?: string | null }} [outreach]
 */

export {};
