import {
  getStoredUser,
  getStoredProfile,
  setStoredProfile,
  addTransaction,
  getTasks,
  markTaskCompleted,
  getQuizzes,
  createQuizSession,
  getQuizSession,
  updateQuizSession,
  getCodeWindows,
  addCodeWindow,
  updateCodeWindow,
  getRedemptions,
  addRedemption,
  getAllProfiles,
  getAbuseFlags,
  updateAbuseFlag,
  getPlatformMetrics,
  addTask as addTaskToStorage,
  updateTask as updateTaskInStorage,
  deleteTask as deleteTaskFromStorage,
} from './local-storage';

function requireUser() {
  const user = getStoredUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

function requireProfile() {
  const profile = getStoredProfile();
  if (!profile) throw new Error('Profile not found');
  return profile;
}

export const rewardEngine = {
  // Task system
  completeTask: async (taskId: string) => {
    const user = requireUser();
    const profile = requireProfile();

    markTaskCompleted(user.id, taskId);

    const tasks = getTasks();
    const task = tasks.find(t => t.id === taskId);
    const amount = task?.reward_amount || 0;

    profile.balance += amount;
    profile.total_earned += amount;
    profile.xp += (task?.xp_reward || 0);
    profile.level = Math.floor(profile.xp / 1000000) + 1;
    setStoredProfile(profile);

    addTransaction({
      user_id: user.id,
      amount,
      type: 'task',
      description: `Task completed: ${task?.title || taskId}`,
    });

    return { success: true, earned: amount };
  },

  // Daily check-in
  dailyCheckin: async () => {
    const user = requireUser();
    const profile = requireProfile();

    const multiplier = Math.min(1 + (profile.daily_streak || 0) * 0.5, 5);
    const amount = Math.round(10 * multiplier);

    profile.balance += amount;
    profile.total_earned += amount;
    profile.daily_streak = (profile.daily_streak || 0) + 1;
    profile.last_login = new Date().toISOString();
    setStoredProfile(profile);

    addTransaction({
      user_id: user.id,
      amount,
      type: 'daily_checkin',
      description: 'Daily Check-in Reward',
    });

    return { success: true, earned: amount };
  },

  // Quiz system
  startQuiz: async (questionCount: number, difficulty: string) => {
    requireUser();

    const questions = getQuizzes(difficulty, questionCount);
    if (questions.length === 0) throw new Error('No questions found for this difficulty');

    const session = createQuizSession({
      user_id: requireUser().id,
      question_count: questions.length,
      difficulty,
      question_ids: JSON.stringify(questions.map(q => q.id)),
      answered_ids: '[]',
      score: 0,
      earned: 0,
      status: 'active',
    });

    return { sessionId: session.id, questions };
  },

  quizAnswer: async (sessionId: string, questionId: string, selectedOption: number, _timeTaken: number) => {
    requireUser();

    const quizzes = getQuizzes();
    const question = quizzes.find(q => q.id === questionId);
    if (!question) throw new Error('Question not found');

    const session = getQuizSession(sessionId);
    if (!session) throw new Error('Session not found');

    const isCorrect = question.correct_option === selectedOption;
    const answeredIds = JSON.parse(session.answered_ids || '[]');
    answeredIds.push(questionId);

    const newScore = isCorrect ? (session.score || 0) + 1 : (session.score || 0);
    const reward = isCorrect ? (question.reward_amount || 0) : 0;
    const newEarned = (session.earned || 0) + reward;

    updateQuizSession(sessionId, {
      answered_ids: JSON.stringify(answeredIds),
      score: newScore,
      earned: newEarned,
    });

    return {
      isCorrect,
      correctOption: question.correct_option,
      sessionScore: newScore,
      sessionEarned: newEarned,
    };
  },

  finishQuiz: async (sessionId: string) => {
    const user = requireUser();
    const profile = requireProfile();

    const session = getQuizSession(sessionId);
    if (!session) throw new Error('Session not found');

    const isPerfect = session.score === session.question_count;
    const bonusReward = isPerfect ? Math.round(session.earned * 0.5) : 0;
    const totalReward = session.earned + bonusReward;
    const xp = session.score * 100;

    updateQuizSession(sessionId, {
      status: 'finished',
      finished_at: new Date().toISOString(),
    });

    if (totalReward > 0) {
      profile.balance += totalReward;
      profile.total_earned += totalReward;
      profile.xp += xp;
      profile.level = Math.floor(profile.xp / 1000000) + 1;
      setStoredProfile(profile);

      addTransaction({
        user_id: user.id,
        amount: totalReward,
        type: 'quiz',
        description: `Quiz reward: ${session.score}/${session.question_count} correct`,
      });
    }

    return {
      success: true,
      score: session.score,
      totalQuestions: session.question_count,
      earned: session.earned,
      bonusReward,
      totalReward,
      xp,
      isPerfect,
    };
  },

  // Games
  gameResult: async (gameType: string, betAmount: number, _outcome: string) => {
    const user = requireUser();
    const profile = requireProfile();

    if (profile.balance < betAmount) throw new Error('Insufficient balance');

    const isWin = Math.random() > 0.5;
    const profit = isWin ? betAmount : -betAmount;
    const multiplier = isWin ? 2 : 0;

    profile.balance += profit;
    setStoredProfile(profile);

    addTransaction({
      user_id: user.id,
      amount: profit,
      type: 'game',
      description: `${gameType} result: ${isWin ? 'win' : 'loss'}`,
    });

    return {
      success: true,
      isWin,
      multiplier,
      profit,
      newBalance: profile.balance,
      message: isWin ? `You won ${betAmount} BIX!` : `You lost ${betAmount} BIX.`,
    };
  },

  // Referrals
  processReferral: async (referralCode: string) => {
    const user = requireUser();
    const allProfiles = getAllProfiles();
    const referrer = allProfiles.find(p => p.referral_code === referralCode);

    if (referrer) {
      const profile = requireProfile();
      profile.referred_by = referrer.user_id;
      setStoredProfile(profile);
    }

    return { success: true };
  },

  redeemTaskCode: async (code: string) => {
    const user = requireUser();
    const profile = requireProfile();

    const windows = getCodeWindows();
    const window = windows.find(
      w => w.code === code.toUpperCase() && w.is_active === 1 && new Date(w.valid_until) > new Date()
    );

    if (!window) throw new Error('Invalid or expired code');

    if (window.max_redemptions && (window.current_redemptions || 0) >= window.max_redemptions) {
      throw new Error('Code has reached max redemptions');
    }

    const redemptions = getRedemptions(user.id);
    if (redemptions.find(r => r.window_id === window.id)) {
      throw new Error('You have already redeemed this code');
    }

    addRedemption({ user_id: user.id, window_id: window.id, task_id: window.task_id });
    updateCodeWindow(window.id, { current_redemptions: (window.current_redemptions || 0) + 1 });

    const amount = 100;
    profile.balance += amount;
    profile.total_earned += amount;
    setStoredProfile(profile);

    addTransaction({
      user_id: user.id,
      amount,
      type: 'code',
      description: `Redeemed code: ${code}`,
    });

    return { success: true, earned: amount, message: `Successfully redeemed code! +${amount} BIX` };
  },

  getPendingRewards: async () => {
    return [];
  },

  // Admin methods
  adminGetMetrics: async () => {
    return getPlatformMetrics();
  },

  adminGetAbuseFlags: async () => {
    return { flags: getAbuseFlags() };
  },

  adminResolveFlag: async (flagId: string) => {
    updateAbuseFlag(flagId, { resolved: 1 });
    return { success: true };
  },

  adminCreateTask: async (task: any) => {
    addTaskToStorage(task);
    return { success: true };
  },

  adminToggleTask: async (taskId: string, isActive: number) => {
    updateTaskInStorage(taskId, { is_active: isActive });
    return { success: true };
  },

  adminDeleteTask: async (taskId: string) => {
    deleteTaskFromStorage(taskId);
    return { success: true };
  },

  adminListCodeWindows: async () => {
    return getCodeWindows();
  },

  adminGenerateCodeWindow: async (taskId: string | null, validHours: number, maxRedemptions?: number) => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + validHours);

    const window = addCodeWindow({
      task_id: taskId || 'general',
      code,
      valid_from: new Date().toISOString(),
      valid_until: validUntil.toISOString(),
      max_redemptions: maxRedemptions || null,
      current_redemptions: 0,
      is_active: 1,
    });

    return window;
  },

  adminDisableCodeWindow: async (windowId: string) => {
    updateCodeWindow(windowId, { is_active: 0 });
    return { success: true };
  },
};
