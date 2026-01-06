/**
 * Generates a unique booking code in format: NL-XXXX
 * Where XXXX is alphanumeric (4 characters)
 */
export function generateBookingCode() {
  const prefix = 'NL';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars like 0, O, I, 1
  let code = '';
  
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `${prefix}-${code}`;
}

