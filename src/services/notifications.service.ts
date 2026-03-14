import { supabase } from '../lib/supabase'

export interface SendNotificationOptions {
  user_id: string
  title: string
  message: string
  notification_type: string
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH'
  action_url?: string
  action_label?: string
  fleet_id?: string
}

export async function sendNotification(opts: SendNotificationOptions): Promise<{ sent: boolean; sendError: string | null }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? supabaseAnonKey}`,
      'Apikey': supabaseAnonKey,
    },
    body: JSON.stringify(opts),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to send notification')
  }
  return res.json()
}

export async function getNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data
}

export async function markAsRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true } as never)
    .eq('id', id)
  if (error) throw error
}

export async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true } as never)
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw error
}
