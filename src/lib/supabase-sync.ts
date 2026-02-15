// DEPRECATED: Supabase sync has been removed. All data uses localStorage now.
export const supabaseSync = {
  insert: async (_table: string, data: any) => ({ data, error: null, offline: true }),
  sync: async () => {},
};
