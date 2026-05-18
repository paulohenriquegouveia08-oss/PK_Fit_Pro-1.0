import { logger } from '../core/logger'
import { supabase } from '../supabase/client'

export interface MappingResult {
  providerUserId: string
  isNew: boolean
}

export class MappingService {
  async getOrCreateProviderUserId(
    userId: string,
    academyId: string,
    provider: string = 'CONTROL_ID'
  ): Promise<MappingResult> {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('user_turnstile_mapping')
        .select('provider_user_id')
        .eq('user_id', userId)
        .eq('academy_id', academyId)
        .eq('provider', provider)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        logger.error('Error fetching mapping', { error: fetchError, userId, academyId })
        throw fetchError
      }

      if (existing) {
        logger.debug('Using existing mapping', {
          userId,
          providerUserId: existing.provider_user_id
        })
        return {
          providerUserId: existing.provider_user_id,
          isNew: false
        }
      }

      const providerUserId = this.generateProviderUserId(academyId)

      const { data: upserted, error: upsertError } = await supabase
        .from('user_turnstile_mapping')
        .upsert(
          {
            user_id: userId,
            academy_id: academyId,
            provider: provider,
            provider_user_id: providerUserId,
            synced_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'academy_id,user_id,provider'
          }
        )
        .select('provider_user_id')
        .single()

      if (upsertError) {
        logger.error('Error creating mapping', { error: upsertError, userId })
        throw upsertError
      }

      logger.info('Created new mapping', { userId, providerUserId: upserted.provider_user_id })
      return {
        providerUserId: upserted.provider_user_id,
        isNew: true
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('Failed to get or create mapping', { error: msg, userId, academyId })
      throw error
    }
  }

  async getProviderUserId(
    userId: string,
    academyId: string,
    provider: string = 'CONTROL_ID'
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('user_turnstile_mapping')
        .select('provider_user_id')
        .eq('user_id', userId)
        .eq('academy_id', academyId)
        .eq('provider', provider)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        logger.error('Error fetching provider user id', { error, userId })
        return null
      }

      return data?.provider_user_id || null
    } catch {
      return null
    }
  }

  async updateSyncedAt(
    userId: string,
    academyId: string,
    provider: string = 'CONTROL_ID'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_turnstile_mapping')
        .update({ synced_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('academy_id', academyId)
        .eq('provider', provider)

      if (error) {
        logger.error('Error updating synced_at', { error, userId })
      }
    } catch (error) {
      logger.error('Failed to update synced_at', { error })
    }
  }

  async deleteMapping(
    userId: string,
    academyId: string,
    provider: string = 'CONTROL_ID'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_turnstile_mapping')
        .delete()
        .eq('user_id', userId)
        .eq('academy_id', academyId)
        .eq('provider', provider)

      if (error) {
        logger.error('Error deleting mapping', { error, userId })
      }
    } catch (error) {
      logger.error('Failed to delete mapping', { error })
    }
  }

  private generateProviderUserId(academyId: string): string {
    const academyHash = this.hashString(academyId.substring(0, 8))
    const timestamp = Date.now().toString(16).padStart(12, '0')
    const random = Math.random().toString(16).substring(2, 10)

    return `${academyHash}${timestamp}${random}`.substring(0, 20)
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).padStart(4, '0')
  }
}

export const mappingService = new MappingService()
