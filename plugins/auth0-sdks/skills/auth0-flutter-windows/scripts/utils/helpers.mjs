/**
 * Shared helper utilities.
 */

import { confirm } from "@inquirer/prompts"

/**
 * Ask the user to confirm an action.
 *
 * @param {string} message - Confirmation prompt message
 * @returns {Promise<boolean>}
 */
export async function confirmWithUser(message) {
  return confirm({ message, default: true })
}
