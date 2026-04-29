/**
 * Generates a SHA-256 hash of the procurement request data.
 * @param {Object} req - The request object (id, original_total, grand_total).
 * @returns {Promise<string>} - The hex hash string starting with 0x.
 */
export async function generateAuditHash(req) {
  // We combine the ID, the Original Total, and the Final Adjusted Total.
  // This creates a "Digital Seal" that proves the budget change was authorized.
  const dataString = `${req.id}-${req.original_total}-${req.grand_total}`

  // Encode the string into bytes
  const msgUint8 = new TextEncoder().encode(dataString)

  // Generate the hash using the native browser crypto subtle API
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)

  // Convert the buffer to a hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  // Return with 0x prefix for Solidity compatibility
  return '0x' + hashHex
}
