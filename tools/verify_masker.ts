import {
  maskSensitiveData,
  maskSensitiveString,
} from '../apps/api/src/common/utils/sensitive-data-masker';

console.log('--- Testing maskSensitiveData ---');
const testData = {
  id: 'user_123',
  password: 'secret_password_123',
  metadata: {
    apiKey: 'sk_live_1234567890abcdef',
    publicInfo: 'hello',
  },
  nested: [{ token: 'jwt_token_987654321' }],
};

console.log('Original:', JSON.stringify(testData, null, 2));
console.log('Masked:', JSON.stringify(maskSensitiveData(testData), null, 2));

console.log('\n--- Testing maskSensitiveString ---');
const testStr =
  'Error: Failed to connect to postgres://admin:very_secret_pass@127.0.0.1:5432/db. Reason: Invalid api_key=sk_test_999988887777 and token: abcdef123456789. Also check secret="mypassword"';
console.log('Original:', testStr);
console.log('Masked:', maskSensitiveString(testStr));
