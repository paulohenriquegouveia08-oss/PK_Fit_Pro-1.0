import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import type { CreateGlobalPlanInput, UpdateGlobalPlanInput } from './globalPlan.schema.js';

const supabase = () => getSupabaseAdmin();

export class GlobalPlanRepository {
  async findAll() {
    const { data, error } = await supabase()
      .from('global_plans')
      .select('*')
      .order('price', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  }

  async findActive() {
    const { data, error } = await supabase()
      .from('global_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  }

  async findById(id: string) {
    const { data, error } = await supabase()
      .from('global_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async create(input: CreateGlobalPlanInput) {
    const { data, error } = await supabase()
      .from('global_plans')
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, input: UpdateGlobalPlanInput) {
    const { data, error } = await supabase()
      .from('global_plans')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase()
      .from('global_plans')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }
}

export const globalPlanRepository = new GlobalPlanRepository();
