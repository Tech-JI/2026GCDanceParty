const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const ADMIN_SETTINGS_DOC_IDS = ['admin_settings', '2d12bec269d35e3d032bf9d31885d8f8'];

function parseScheduleInt(value, fallback) {
  const num = Number(value);
  return Number.isInteger(num) ? num : fallback;
}

function getScheduleConfig(matching = {}) {
  const enabled = typeof matching.scheduleEnabled === 'boolean'
    ? matching.scheduleEnabled
    : !!matching.randomMatchEnabled;

  return {
    enabled,
    hour: parseScheduleInt(matching.scheduleHour, 21),
    minute: parseScheduleInt(matching.scheduleMinute, 0),
    timezone: (matching.timezone || 'Asia/Shanghai').toString()
  };
}

async function resolveAdminSettingsDoc() {
  for (const docId of ADMIN_SETTINGS_DOC_IDS) {
    const res = await db.collection('AdminSettings').doc(docId).get().catch(() => ({ data: null }));
    if (res && res.data) {
      return { docId, data: res.data };
    }
  }

  return { docId: ADMIN_SETTINGS_DOC_IDS[0], data: {} };
}

function getTimePartsInTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const parts = formatter.formatToParts(new Date());
  const map = parts.reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute)
  };
}

exports.main = async () => {
  try {
    const { docId: adminSettingsDocId, data: adminSettings } = await resolveAdminSettingsDoc();
    const matching = adminSettings.matching || {};
    const scheduleConfig = getScheduleConfig(matching);

    if (!scheduleConfig.enabled) {
      return {
        success: true,
        message: '已关闭自动匹配计划'
      };
    }

    let nowParts;
    let timezoneUsed = scheduleConfig.timezone;
    try {
      nowParts = getTimePartsInTimezone(scheduleConfig.timezone);
    } catch (e) {
      timezoneUsed = 'Asia/Shanghai';
      nowParts = getTimePartsInTimezone(timezoneUsed);
    }

    if (nowParts.hour !== scheduleConfig.hour || nowParts.minute !== scheduleConfig.minute) {
      return {
        success: true,
        message: '当前不在执行时间窗',
        now: `${nowParts.hour}:${nowParts.minute}`,
        target: `${scheduleConfig.hour}:${scheduleConfig.minute}`,
        timezone: timezoneUsed
      };
    }

    // 防止同一分钟重复执行
    const currentMinuteKey = `${nowParts.year}-${nowParts.month}-${nowParts.day}-${nowParts.hour}-${nowParts.minute}`;
    if (matching.lastScheduleMinuteKey === currentMinuteKey) {
      return {
        success: true,
        message: '本分钟已执行，跳过'
      };
    }

    const res = await cloud.callFunction({
      name: 'random_match_partners',
      data: {
        triggerType: 'schedule'
      }
    });

    await db.collection('AdminSettings').doc(adminSettingsDocId).update({
      data: {
        'matching.lastScheduleMinuteKey': currentMinuteKey,
        'matching.lastScheduleRunAt': new Date()
      }
    }).catch(async () => {
      await db.collection('AdminSettings').doc(adminSettingsDocId).set({
        data: {
          ...adminSettings,
          matching: {
            ...matching,
            lastScheduleMinuteKey: currentMinuteKey,
            lastScheduleRunAt: new Date()
          }
        }
      });
    });

    return {
      success: true,
      message: '定时触发执行完成',
      timezone: timezoneUsed,
      result: res.result || {}
    };
  } catch (error) {
    return {
      success: false,
      message: '定时触发执行失败',
      error: error.message
    };
  }
};
