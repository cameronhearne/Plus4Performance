export const DAY_ORDER_MON = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_NAMES_JS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getSessionForToday(plan, intakeData) {
  const allSessions = (plan?.phases || []).flatMap(p => p.sessions || []);
  if (!allSessions.length) return { session: null, isRestDay: false, tomorrowSession: null };

  const numTrainingDays = parseInt(intakeData?.trainingDays || '4', 10);
  const scheduleType    = intakeData?.scheduleType || 'rolling';
  const preferredDays   = intakeData?.preferredDays || [];
  const startDateStr    = intakeData?.startDate;

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayName = DAY_NAMES_JS[todayDate.getDay()];

  const startDate = startDateStr ? new Date(startDateStr) : new Date(todayDate);
  startDate.setHours(0, 0, 0, 0);
  const daysElapsed = Math.max(0, Math.floor((todayDate - startDate) / 86400000));

  if (scheduleType === 'fixed' && preferredDays.length > 0) {
    const sortedDays = [...preferredDays].sort((a, b) => DAY_ORDER_MON.indexOf(a) - DAY_ORDER_MON.indexOf(b));

    if (!sortedDays.includes(todayName)) {
      let tomorrowSession = null;
      for (let i = 1; i <= 7; i++) {
        const nextDate = new Date(todayDate);
        nextDate.setDate(todayDate.getDate() + i);
        const nextName = DAY_NAMES_JS[nextDate.getDay()];
        if (sortedDays.includes(nextName)) {
          const nextElapsed = daysElapsed + i;
          const weeksPassed = Math.floor(nextElapsed / 7);
          const nextDayIdx  = sortedDays.indexOf(nextName);
          const sessionIdx  = (weeksPassed * sortedDays.length + nextDayIdx) % allSessions.length;
          tomorrowSession   = allSessions[sessionIdx];
          break;
        }
      }
      return { session: null, isRestDay: true, tomorrowSession };
    }

    const weeksPassed = Math.floor(daysElapsed / 7);
    const dayIdx      = sortedDays.indexOf(todayName);
    const sessionIdx  = (weeksPassed * sortedDays.length + dayIdx) % allSessions.length;
    return { session: allSessions[sessionIdx], isRestDay: false, tomorrowSession: null };
  }

  // Rolling: train first N days of each 7-day cycle
  const dayInCycle = daysElapsed % 7;
  const fullWeeks  = Math.floor(daysElapsed / 7);

  if (dayInCycle >= numTrainingDays) {
    const sessionsCompleted = (fullWeeks + 1) * numTrainingDays;
    return { session: null, isRestDay: true, tomorrowSession: allSessions[sessionsCompleted % allSessions.length] };
  }

  const sessionsCompleted = fullWeeks * numTrainingDays + dayInCycle;
  return { session: allSessions[sessionsCompleted % allSessions.length], isRestDay: false, tomorrowSession: null };
}
