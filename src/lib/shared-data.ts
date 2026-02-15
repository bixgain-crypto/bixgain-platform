import {
  getTasks,
  getQuizzes,
  getStoreItems,
  getAllProfiles,
  getReferralHistory,
  getPlatformMetrics,
} from './local-storage';

/**
 * Fetch shared data from localStorage instead of Supabase.
 * Keeps the same API signature so pages don't need major changes.
 */
export async function fetchSharedData(
  table: 'tasks' | 'quizzes' | 'store_items' | 'user_profiles' | 'referral_history' | 'platform_metrics',
  limit?: number
) {
  let data: any[];

  switch (table) {
    case 'tasks':
      data = getTasks();
      break;
    case 'quizzes':
      data = getQuizzes();
      break;
    case 'store_items':
      data = getStoreItems();
      break;
    case 'user_profiles':
      data = getAllProfiles();
      break;
    case 'referral_history':
      data = getReferralHistory();
      break;
    case 'platform_metrics':
      data = getPlatformMetrics();
      break;
    default:
      data = [];
  }

  if (limit) {
    data = data.slice(0, limit);
  }

  return data;
}
