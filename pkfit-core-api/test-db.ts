import { getSupabaseAdmin } from './src/infra/database/supabase-admin.js';

async function test() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('users').select('name, photo_url, role').order('created_at', { ascending: false }).limit(3);
    console.log("USERS:", JSON.stringify({data, error}, null, 2));
    
    const { data: invData, error: invErr } = await supabase.from('invite_codes').select('code, metadata').order('created_at', { ascending: false }).limit(3);
    console.log("INVITES:", JSON.stringify({invData, invErr}, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
