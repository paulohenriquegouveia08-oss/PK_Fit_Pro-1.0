import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'pkfit-core-api/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('users').select('*');
  console.log('Users:', data);
  if(error) console.error(error);
}
run();
