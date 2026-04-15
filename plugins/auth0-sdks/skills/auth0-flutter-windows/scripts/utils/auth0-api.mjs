/**
 * Auth0 CLI API wrapper utilities.
 * Thin wrappers around `auth0 api` commands for programmatic use.
 */

import { execa } from "execa"

/**
 * GET an Auth0 Management API endpoint.
 * @param {string} endpoint - API path (e.g. 'connections')
 * @returns {Promise<any>} Parsed JSON response
 */
export async function auth0ApiGet(endpoint) {
  const { stdout } = await execa("auth0", ["api", "get", endpoint, "--no-input"])
  return JSON.parse(stdout)
}

/**
 * POST to an Auth0 Management API endpoint.
 * @param {string} endpoint - API path
 * @param {object} data - Request body
 * @returns {Promise<any>} Parsed JSON response
 */
export async function auth0ApiPost(endpoint, data) {
  const { stdout } = await execa("auth0", [
    "api", "post", endpoint,
    "--data", JSON.stringify(data),
    "--no-input",
  ])
  return JSON.parse(stdout)
}

/**
 * PATCH an Auth0 Management API endpoint.
 * @param {string} endpoint - API path (e.g. 'connections/con_abc123')
 * @param {object} data - Request body
 * @returns {Promise<any>} Parsed JSON response
 */
export async function auth0ApiPatch(endpoint, data) {
  const { stdout } = await execa("auth0", [
    "api", "patch", endpoint,
    "--data", JSON.stringify(data),
    "--no-input",
  ])
  return JSON.parse(stdout)
}
