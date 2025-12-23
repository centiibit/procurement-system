import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rccbvkrjairpjoxfhtzt.supabase.co'

const supabaseKey = 'sb_publishable_lHXKO0qMbluRI1CYR0BKQA_OJSZBPNY'

export const supabase = createClient(supabaseUrl, supabaseKey)
