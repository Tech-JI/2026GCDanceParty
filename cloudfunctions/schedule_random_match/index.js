const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const ADMIN_SETTINGS_DOC_ID = '2d12bec269d35e3d032bf9d31885d8f8';

exports.main = async () => {
  try {
    const adminSettingsRes = await db.collection('AdminSettings').doc(ADMIN_SETTINGS_DOC_ID).get().catch(() => ({ data: null }));
    const adminSettings = (adminSettingsRes && adminSettingsRes.data) ? adminSettingsRes.data : {};
    const matching = adminSettings.matching || {};

    const enabled = !!matching.scheduleEnabled;
    const targetHour = Number.isInteger(matching.scheduleHour) ? matching.scheduleHour : 21;
    const targetMinute = Number.isInteger(matching.scheduleMinute) ? matching.scheduleMinute : 0;

    if (!enabled) {
      return {
        success: true,
        message: '已关闭自动匹配计划'
      };
    }

    const now = new Date();
    const nowHour = now.getHours();
    const nowMinute = now.getMinutes();
    if (nowHour !== targetHour || nowMinute !== targetMinute) {
      return {
        success: true,
        message: '当前不在执行时间窗',
        now: `${nowHour}:${nowMinute}`,
        target: `${targetHour}:${targetMinute}`
      };
    }

    // 防止同一分钟重复执行
    const currentMinuteKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${nowHour}-${nowMinute}`;
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

    await db.collection('AdminSettings').doc(ADMIN_SETTINGS_DOC_ID).update({
      data: {
        'matching.lastScheduleMinuteKey': currentMinuteKey,
        'matching.lastScheduleRunAt': new Date()
      }
    }).catch(() => {});

    return {
      success: true,
      message: '定时触发执行完成',
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
