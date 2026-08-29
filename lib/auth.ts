export type AppRole = 'ops' | 'po' | 'release_manager' | 'admin';
export type Permission = 'execute_task' | 'add_instruction' | 'launch_mep' | 'create_mep' | 'manage_users';
const levels: Record<AppRole, number> = { ops: 1, po: 2, release_manager: 3, admin: 4 };
const required: Record<Permission, number> = { execute_task: 1, add_instruction: 1, launch_mep: 2, create_mep: 3, manage_users: 4 };
export const can = (role: AppRole | null, permission: Permission) => role ? levels[role] >= required[permission] : false;
export const roleLabel: Record<AppRole, string> = { ops: 'OPS', po: 'Product Owner', release_manager: 'Release Manager', admin: 'Administrateur' };

export interface Profile { id: string; email: string; display_name: string; role: AppRole; created_at: string; }
