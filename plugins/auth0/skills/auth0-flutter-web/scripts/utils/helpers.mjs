import { confirm } from "@inquirer/prompts"

/**
 * Ask the user a yes/no confirmation question.
 */
export async function confirmWithUser(message) {
  return await confirm({ message, default: true })
}
