import { supabase } from './src/shared/services/supabase';

async function checkPlans() {
    const { data, error } = await supabase.from('plans').select('*').limit(5);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Plans:', data);
    }
}

checkPlans();
