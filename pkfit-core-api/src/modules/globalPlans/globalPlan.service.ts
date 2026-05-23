import { globalPlanRepository } from './globalPlan.repository.js';
import type { CreateGlobalPlanInput, UpdateGlobalPlanInput } from './globalPlan.schema.js';

export class GlobalPlanService {
  async getAllPlans(includeInactive = false) {
    if (includeInactive) {
      return globalPlanRepository.findAll();
    }
    return globalPlanRepository.findActive();
  }

  async getPlanById(id: string) {
    return globalPlanRepository.findById(id);
  }

  async createPlan(input: CreateGlobalPlanInput) {
    return globalPlanRepository.create(input);
  }

  async updatePlan(id: string, input: UpdateGlobalPlanInput) {
    // Optionally verify if plan exists
    await globalPlanRepository.findById(id);
    return globalPlanRepository.update(id, input);
  }

  async deletePlan(id: string) {
    await globalPlanRepository.findById(id);
    return globalPlanRepository.delete(id);
  }
}

export const globalPlanService = new GlobalPlanService();
