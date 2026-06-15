import { useSelector } from 'react-redux';

/**
 * Hook to check if the current admin has specific permissions.
 */
export const usePermissions = () => {
  const { user } = useSelector((state) => state.auth);

  const hasPermission = (permissions) => {
    if (!user || user.role !== 'ADMIN') return false;

    const userPerms = user.permissions;
    // null/undefined = legacy super admin (full access). [] = no permissions.
    if (userPerms == null || userPerms.includes('ALL')) return true;

    const required = Array.isArray(permissions) ? permissions : [permissions];
    if (required.length === 0) return true;

    return required.some(p => userPerms.includes(p));
  };

  const isSuperAdmin = () => {
    if (user?.role !== 'ADMIN') return false;
    const userPerms = user.permissions;
    return userPerms == null || userPerms.includes('ALL');
  };

  return { hasPermission, isSuperAdmin, permissions: user?.permissions ?? null };
};
