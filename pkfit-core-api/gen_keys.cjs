const jwt = require('jsonwebtoken');

const secret = '0376487bdb869f524a0c338068c8f4cd9532e588d3453b6216666110435f16df';

const anonToken = jwt.sign(
  { role: 'anon', iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) },
  secret
);

const serviceRoleToken = jwt.sign(
  { role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) },
  secret
);

console.log('ANON_KEY=' + anonToken);
console.log('SERVICE_ROLE_KEY=' + serviceRoleToken);
