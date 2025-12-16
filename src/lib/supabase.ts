import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Restaurant {
  id: string
  user_id: string
  restaurant_name: string
  address?: string
  date_visited: string
  dishes_ordered: string
  rating: number
  value_rating: number
  notes?: string
  photo_url?: string
  google_place_id?: string
  google_rating?: number
  google_maps_url?: string
  google_photo_url?: string
  created_at: string
  updated_at: string
}   