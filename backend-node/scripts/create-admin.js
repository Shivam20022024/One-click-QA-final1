"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
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
            await supabase.auth.admin.updateUserById(data?.user?.id || '', { password: 'admin123' });
            console.log('Password updated successfully!');
        }
        else {
            console.error('Error creating user:', error.message);
        }
    }
    else {
        console.log('Admin user provisioned successfully:', data.user.email);
    }
}
createAdminUser();
//# sourceMappingURL=create-admin.js.map