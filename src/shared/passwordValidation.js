// Password validation utilities
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventSequential: true,
};
// Common weak passwords to reject
const COMMON_PASSWORDS = [
  'password', '123456', 'password123', 'admin', 'qwerty', 'letmein',
  'welcome', 'monkey', 'dragon', 'password1', 'abc123', 'password12',
  'qwerty123', 'admin123', 'root', 'user', 'guest', 'test', 'demo'
];
function validatePasswordStrength(password) {
  const errors = [];
  // Check length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }
  // Check for uppercase letters
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  // Check for lowercase letters
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  // Check for numbers
  if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  // Check for special characters
  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  // Check for common passwords
  if (PASSWORD_REQUIREMENTS.preventCommonPasswords && COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common and easily guessable');
  }
  // Check for sequential characters
  if (PASSWORD_REQUIREMENTS.preventSequential) {
    const sequences = ['123456', 'abcdef', 'qwerty', 'asdfgh', 'zxcvbn'];
    if (sequences.some(seq => password.toLowerCase().includes(seq))) {
      errors.push('Password contains sequential characters that make it easily guessable');
    }
  }
  // Check for repeated characters (more than 3 in a row)
  if (/(.)\1{3,}/.test(password)) {
    errors.push('Password contains too many repeated characters');
  }
  return {
    isValid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password)
  };
}
function calculatePasswordStrength(password) {
  let score = 0;
  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  // Character variety scoring
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

  // Pattern penalties
  if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
  if (/123456|abcdef|qwerty|asdfgh|zxcvbn/i.test(password)) score -= 2; // Sequential patterns

  return Math.max(0, Math.min(5, score));
}

function generatePasswordPolicy() {
  return {
    requirements: PASSWORD_REQUIREMENTS,
    description: `Password must be ${PASSWORD_REQUIREMENTS.minLength}-${PASSWORD_REQUIREMENTS.maxLength} characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.`,
    commonPasswordsBlocked: COMMON_PASSWORDS.length,
    strengthLevels: {
      0: 'Very Weak',
      1: 'Weak',
      2: 'Fair',
      3: 'Good',
      4: 'Strong',
      5: 'Very Strong'
    }
  };
}

module.exports = {
  validatePasswordStrength,
  generatePasswordPolicy,
  PASSWORD_REQUIREMENTS
};
