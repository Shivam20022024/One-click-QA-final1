import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminUser() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@testplatform.ai',
    password: 'admin123',
    email_confirm: true,
    user_metadata: { full_name: 'System Admin' }
  });

  if (error) {
    if (error.message.includes('already registered')) {
      console.log('User already exists. Updating password...');
      await supabase.auth.admin.updateUserById((data as any)?.user?.id || '', { password: 'admin123' });
      console.log('Password updated successfully!');
    } else {
      console.error('Error creating user:', error.message);
    }
  } else {
    console.log('Admin user provisioned successfully:', data.user.email);
  }
}

createAdminUser();
