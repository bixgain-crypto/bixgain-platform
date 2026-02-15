/**
 * LocalStorage-based data layer for BixGain.
 * Replaces all Supabase/database calls with localStorage persistence.
 */

const STORAGE_KEYS = {
  USER: 'bixgain_user',
  PROFILE: 'bixgain_profile',
  TRANSACTIONS: 'bixgain_transactions',
  TASKS: 'bixgain_tasks',
  USER_TASKS: 'bixgain_user_tasks',
  QUIZ_SESSIONS: 'bixgain_quiz_sessions',
  QUIZZES: 'bixgain_quizzes',
  STORE_ITEMS: 'bixgain_store_items',
  CODE_WINDOWS: 'bixgain_code_windows',
  REDEMPTIONS: 'bixgain_redemptions',
  REFERRAL_HISTORY: 'bixgain_referral_history',
  ABUSE_FLAGS: 'bixgain_abuse_flags',
  PLATFORM_METRICS: 'bixgain_platform_metrics',
  ALL_PROFILES: 'bixgain_all_profiles',
} as const;

function getItem<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function setItem(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateId(prefix = ''): string {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ============== User / Auth ==============

export interface LocalUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface LocalProfile {
  user_id: string;
  display_name: string;
  referral_code: string;
  balance: number;
  total_earned: number;
  xp: number;
  role: 'user' | 'admin';
  daily_streak: number;
  level: number;
  last_login: string;
  referred_by?: string;
  created_at: string;
}

export function getStoredUser(): LocalUser | null {
  return getItem<LocalUser | null>(STORAGE_KEYS.USER, null);
}

export function setStoredUser(user: LocalUser | null) {
  if (user) {
    setItem(STORAGE_KEYS.USER, user);
  } else {
    localStorage.removeItem(STORAGE_KEYS.USER);
  }
}

export function getStoredProfile(): LocalProfile | null {
  return getItem<LocalProfile | null>(STORAGE_KEYS.PROFILE, null);
}

export function setStoredProfile(profile: LocalProfile | null) {
  if (profile) {
    setItem(STORAGE_KEYS.PROFILE, profile);
    // Also update in all_profiles for leaderboard
    const allProfiles = getItem<LocalProfile[]>(STORAGE_KEYS.ALL_PROFILES, []);
    const idx = allProfiles.findIndex(p => p.user_id === profile.user_id);
    if (idx >= 0) {
      allProfiles[idx] = profile;
    } else {
      allProfiles.push(profile);
    }
    setItem(STORAGE_KEYS.ALL_PROFILES, allProfiles);
  } else {
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
  }
}

export function createNewProfile(user: LocalUser): LocalProfile {
  const isAdmin = user.email === 'bixgain@gmail.com';
  const profile: LocalProfile = {
    user_id: user.id,
    display_name: user.displayName || 'Miner',
    referral_code: `BIX-${user.id.slice(-6).toUpperCase()}`,
    balance: 100,
    total_earned: 100,
    xp: 0,
    role: isAdmin ? 'admin' : 'user',
    daily_streak: 0,
    level: 1,
    last_login: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  setStoredProfile(profile);

  // Log welcome bonus transaction
  addTransaction({
    user_id: user.id,
    amount: 100,
    type: 'signup',
    description: 'Welcome Bonus',
  });

  return profile;
}

// ============== Transactions ==============

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export function getTransactions(userId?: string): Transaction[] {
  const all = getItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  if (userId) return all.filter(t => t.user_id === userId);
  return all;
}

export function addTransaction(tx: Omit<Transaction, 'id' | 'created_at'>) {
  const transactions = getItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  transactions.unshift({
    ...tx,
    id: generateId('tx_'),
    created_at: new Date().toISOString(),
  });
  setItem(STORAGE_KEYS.TRANSACTIONS, transactions);
}

// ============== Tasks ==============

export function getTasks(): any[] {
  return getItem<any[]>(STORAGE_KEYS.TASKS, getDefaultTasks());
}

export function setTasks(tasks: any[]) {
  setItem(STORAGE_KEYS.TASKS, tasks);
}

export function addTask(task: any) {
  const tasks = getTasks();
  tasks.push({ ...task, is_active: 1 });
  setTasks(tasks);
}

export function updateTask(taskId: string, updates: any) {
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx >= 0) {
    tasks[idx] = { ...tasks[idx], ...updates };
    setTasks(tasks);
  }
}

export function deleteTask(taskId: string) {
  setTasks(getTasks().filter(t => t.id !== taskId));
}

// ============== User Tasks (completions) ==============

export function getCompletedTaskIds(userId: string): string[] {
  const userTasks = getItem<any[]>(STORAGE_KEYS.USER_TASKS, []);
  return userTasks.filter(ut => ut.user_id === userId && ut.status === 'completed').map(ut => ut.task_id);
}

export function markTaskCompleted(userId: string, taskId: string) {
  const userTasks = getItem<any[]>(STORAGE_KEYS.USER_TASKS, []);
  userTasks.push({ user_id: userId, task_id: taskId, status: 'completed', created_at: new Date().toISOString() });
  setItem(STORAGE_KEYS.USER_TASKS, userTasks);
}

// ============== Quizzes ==============

export function getQuizzes(difficulty?: string, limit?: number): any[] {
  let quizzes = getItem<any[]>(STORAGE_KEYS.QUIZZES, getDefaultQuizzes());
  if (difficulty) quizzes = quizzes.filter(q => q.difficulty === difficulty);
  if (limit) quizzes = quizzes.slice(0, limit);
  return quizzes;
}

// ============== Quiz Sessions ==============

export function createQuizSession(session: any): any {
  const sessions = getItem<any[]>(STORAGE_KEYS.QUIZ_SESSIONS, []);
  const newSession = { ...session, id: generateId('qs_'), created_at: new Date().toISOString() };
  sessions.push(newSession);
  setItem(STORAGE_KEYS.QUIZ_SESSIONS, sessions);
  return newSession;
}

export function getQuizSession(sessionId: string): any | null {
  const sessions = getItem<any[]>(STORAGE_KEYS.QUIZ_SESSIONS, []);
  return sessions.find(s => s.id === sessionId) || null;
}

export function updateQuizSession(sessionId: string, updates: any) {
  const sessions = getItem<any[]>(STORAGE_KEYS.QUIZ_SESSIONS, []);
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], ...updates };
    setItem(STORAGE_KEYS.QUIZ_SESSIONS, sessions);
  }
}

// ============== Store Items ==============

export function getStoreItems(): any[] {
  return getItem<any[]>(STORAGE_KEYS.STORE_ITEMS, getDefaultStoreItems());
}

// ============== Code Windows ==============

export function getCodeWindows(): any[] {
  return getItem<any[]>(STORAGE_KEYS.CODE_WINDOWS, []);
}

export function addCodeWindow(window: any): any {
  const windows = getCodeWindows();
  const newWindow = { ...window, id: generateId('cw_'), created_at: new Date().toISOString() };
  windows.unshift(newWindow);
  setItem(STORAGE_KEYS.CODE_WINDOWS, windows);
  return newWindow;
}

export function updateCodeWindow(windowId: string, updates: any) {
  const windows = getCodeWindows();
  const idx = windows.findIndex(w => w.id === windowId);
  if (idx >= 0) {
    windows[idx] = { ...windows[idx], ...updates };
    setItem(STORAGE_KEYS.CODE_WINDOWS, windows);
  }
}

// ============== Redemptions ==============

export function getRedemptions(userId?: string): any[] {
  const all = getItem<any[]>(STORAGE_KEYS.REDEMPTIONS, []);
  if (userId) return all.filter(r => r.user_id === userId);
  return all;
}

export function addRedemption(redemption: any) {
  const redemptions = getRedemptions();
  redemptions.push({ ...redemption, id: generateId('rd_'), created_at: new Date().toISOString() });
  setItem(STORAGE_KEYS.REDEMPTIONS, redemptions);
}

// ============== Referral History ==============

export function getReferralHistory(userId?: string): any[] {
  const all = getItem<any[]>(STORAGE_KEYS.REFERRAL_HISTORY, []);
  if (userId) return all.filter(r => r.referrer_id === userId);
  return all;
}

export function addReferralHistory(entry: any) {
  const history = getItem<any[]>(STORAGE_KEYS.REFERRAL_HISTORY, []);
  history.push({ ...entry, id: generateId('ref_'), created_at: new Date().toISOString() });
  setItem(STORAGE_KEYS.REFERRAL_HISTORY, history);
}

// ============== All Profiles (for leaderboard) ==============

export function getAllProfiles(): LocalProfile[] {
  return getItem<LocalProfile[]>(STORAGE_KEYS.ALL_PROFILES, []);
}

// ============== Abuse Flags ==============

export function getAbuseFlags(): any[] {
  return getItem<any[]>(STORAGE_KEYS.ABUSE_FLAGS, []);
}

export function updateAbuseFlag(flagId: string, updates: any) {
  const flags = getAbuseFlags();
  const idx = flags.findIndex(f => f.id === flagId);
  if (idx >= 0) {
    flags[idx] = { ...flags[idx], ...updates };
    setItem(STORAGE_KEYS.ABUSE_FLAGS, flags);
  }
}

// ============== Platform Metrics ==============

export function getPlatformMetrics(): any[] {
  return getItem<any[]>(STORAGE_KEYS.PLATFORM_METRICS, []);
}

// ============== Default Data ==============

function getDefaultTasks(): any[] {
  return [
    { id: 'task_social_1', title: 'Follow BixGain on Twitter', description: 'Follow our official Twitter account for the latest updates.', category: 'social', task_type: 'one-time', reward_amount: 50, xp_reward: 25, required_level: 0, link: 'https://twitter.com/bixgain', is_active: 1 },
    { id: 'task_social_2', title: 'Join Telegram Group', description: 'Join our active Telegram community.', category: 'social', task_type: 'one-time', reward_amount: 50, xp_reward: 25, required_level: 0, link: 'https://t.me/bixgain', is_active: 1 },
    { id: 'task_social_3', title: 'Retweet Pinned Post', description: 'Retweet our latest pinned tweet to spread the word.', category: 'social', task_type: 'one-time', reward_amount: 75, xp_reward: 40, required_level: 0, link: 'https://twitter.com/bixgain', is_active: 1 },
    { id: 'task_watch_1', title: 'Watch Tutorial Video', description: 'Watch our platform walkthrough video.', category: 'watch', task_type: 'one-time', reward_amount: 100, xp_reward: 50, required_level: 0, link: 'https://youtube.com/@bixgain', is_active: 1 },
    { id: 'task_daily_1', title: 'Daily Login Bonus', description: 'Log in every day to earn bonus tokens.', category: 'daily', task_type: 'daily', reward_amount: 25, xp_reward: 10, required_level: 0, link: '', is_active: 1 },
    { id: 'task_milestone_1', title: 'Reach Level 5', description: 'Advance your miner to Level 5.', category: 'milestone', task_type: 'one-time', reward_amount: 500, xp_reward: 250, required_level: 5, link: '', is_active: 1 },
    { id: 'task_referral_1', title: 'Invite 3 Friends', description: 'Refer 3 new miners to the platform.', category: 'referral', task_type: 'one-time', reward_amount: 300, xp_reward: 150, required_level: 0, link: '', is_active: 1 },
  ];
}

function getDefaultQuizzes(): any[] {
  return [
    { id: 'q1', question: 'What is Bitcoin?', options: JSON.stringify(['A digital currency', 'A physical coin', 'A bank', 'A website']), correct_option: 0, reward_amount: 5, difficulty: 'easy' },
    { id: 'q2', question: 'Who created Bitcoin?', options: JSON.stringify(['Vitalik Buterin', 'Satoshi Nakamoto', 'Elon Musk', 'Mark Zuckerberg']), correct_option: 1, reward_amount: 5, difficulty: 'easy' },
    { id: 'q3', question: 'What is a blockchain?', options: JSON.stringify(['A chain of blocks', 'A distributed ledger', 'A type of database', 'All of the above']), correct_option: 3, reward_amount: 5, difficulty: 'easy' },
    { id: 'q4', question: 'What does DeFi stand for?', options: JSON.stringify(['Decentralized Finance', 'Digital Finance', 'Defined Finance', 'Deferred Finance']), correct_option: 0, reward_amount: 5, difficulty: 'easy' },
    { id: 'q5', question: 'What is an NFT?', options: JSON.stringify(['Non-Fungible Token', 'New Financial Tool', 'Network File Transfer', 'Node Function Type']), correct_option: 0, reward_amount: 5, difficulty: 'easy' },
    { id: 'q6', question: 'What is Ethereum primarily known for?', options: JSON.stringify(['Smart contracts', 'Being faster than Bitcoin', 'Having no fees', 'Being a stablecoin']), correct_option: 0, reward_amount: 8, difficulty: 'medium' },
    { id: 'q7', question: 'What is a crypto wallet?', options: JSON.stringify(['A physical wallet for coins', 'Software to store private keys', 'A bank account', 'A trading platform']), correct_option: 1, reward_amount: 8, difficulty: 'medium' },
    { id: 'q8', question: 'What consensus mechanism does Bitcoin use?', options: JSON.stringify(['Proof of Stake', 'Proof of Work', 'Delegated Proof of Stake', 'Proof of Authority']), correct_option: 1, reward_amount: 8, difficulty: 'medium' },
    { id: 'q9', question: 'What is gas in Ethereum?', options: JSON.stringify(['Fuel for mining machines', 'Transaction fee unit', 'A type of token', 'A smart contract language']), correct_option: 1, reward_amount: 8, difficulty: 'medium' },
    { id: 'q10', question: 'What is a DAO?', options: JSON.stringify(['Decentralized Autonomous Organization', 'Digital Asset Offering', 'Direct Access Online', 'Distributed Application Overlay']), correct_option: 0, reward_amount: 8, difficulty: 'medium' },
    { id: 'q11', question: 'What is the EVM?', options: JSON.stringify(['Ethereum Virtual Machine', 'Electronic Value Monitor', 'Extended Verification Module', 'Encrypted Vault Manager']), correct_option: 0, reward_amount: 10, difficulty: 'hard' },
    { id: 'q12', question: 'What is a Merkle Tree used for in blockchain?', options: JSON.stringify(['Storing user passwords', 'Efficient data verification', 'Mining new blocks', 'Encrypting transactions']), correct_option: 1, reward_amount: 10, difficulty: 'hard' },
    { id: 'q13', question: 'What is the Byzantine Generals Problem?', options: JSON.stringify(['A cryptography algorithm', 'A consensus challenge in distributed systems', 'A type of smart contract bug', 'A mining difficulty adjustment']), correct_option: 1, reward_amount: 10, difficulty: 'hard' },
    { id: 'q14', question: 'What is impermanent loss?', options: JSON.stringify(['Loss from hacking', 'Loss in LP value vs holding', 'Transaction fee losses', 'Gas price fluctuations']), correct_option: 1, reward_amount: 10, difficulty: 'hard' },
    { id: 'q15', question: 'What is a zero-knowledge proof?', options: JSON.stringify(['Proving knowledge without revealing it', 'An empty blockchain block', 'A transaction with no fees', 'A wallet with zero balance']), correct_option: 0, reward_amount: 10, difficulty: 'hard' },
  ];
}

function getDefaultStoreItems(): any[] {
  return [
    { id: 'store_1', name: 'BixGain Premium Badge', description: 'Exclusive profile badge showing your premium status.', price: 500, image_url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&q=80' },
    { id: 'store_2', name: 'Custom Username Color', description: 'Stand out with a unique color for your name in chat and leaderboard.', price: 1000, image_url: 'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=400&q=80' },
    { id: 'store_3', name: '2x Earnings Boost (24h)', description: 'Double all your BIX earnings for 24 hours.', price: 2500, image_url: 'https://images.unsplash.com/photo-1518544801976-3e159e50e5bb?w=400&q=80' },
    { id: 'store_4', name: 'BixGain Merch T-Shirt', description: 'Limited edition BixGain branded t-shirt shipped to your address.', price: 5000, image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80' },
  ];
}

// ============== Clear all data ==============

export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}
