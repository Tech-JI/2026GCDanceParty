// 云函数：随机舞伴分配
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const ADMIN_SETTINGS_DOC_IDS = ['admin_settings', '2d12bec269d35e3d032bf9d31885d8f8']

function parseScheduleInt(value, fallback) {
  const num = Number(value);
  return Number.isInteger(num) ? num : fallback;
}

function getScheduleConfig(matchingSetting = {}) {
  const enabled = typeof matchingSetting.scheduleEnabled === 'boolean'
    ? matchingSetting.scheduleEnabled
    : !!matchingSetting.randomMatchEnabled;

  return {
    enabled,
    hour: parseScheduleInt(matchingSetting.scheduleHour, 21),
    minute: parseScheduleInt(matchingSetting.scheduleMinute, 0),
    timezone: (matchingSetting.timezone || 'Asia/Shanghai').toString()
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

function isAdminUser(userDoc, adminOpenIds, openid) {
  if (Array.isArray(adminOpenIds) && adminOpenIds.includes(openid)) return true;
  if (!userDoc) return false;
  if (userDoc.isAdmin === true) return true;
  if (userDoc.role === 'admin') return true;
  return false;
}

async function checkManualAdminAuth(wxContext, adminOpenIds) {
  if (!wxContext.OPENID) {
    return {
      ok: false,
      response: {
        success: false,
        code: 403,
        message: '未登录，禁止操作'
      }
    };
  }

  const currentUserRes = await db.collection('ActiveUser').where({ _openid: wxContext.OPENID }).limit(1).get();
  const currentUser = currentUserRes.data && currentUserRes.data.length ? currentUserRes.data[0] : null;
  if (!isAdminUser(currentUser, adminOpenIds, wxContext.OPENID)) {
    return {
      ok: false,
      response: {
        success: false,
        code: 403,
        message: '仅管理员可操作'
      }
    };
  }

  return { ok: true };
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const action = event && event.action ? event.action : 'run';
    const triggerType = event && event.triggerType ? event.triggerType : 'manual';
    const isScheduleTrigger = triggerType === 'schedule';

    // 读取管理员配置与运行配置
    const { docId: adminSettingsDocId, data: adminSettings } = await resolveAdminSettingsDoc();
    const adminOpenIds = Array.isArray(adminSettings.adminOpenIds) ? adminSettings.adminOpenIds : [];
    const matchingSetting = adminSettings.matching || {};
    const scheduleConfig = getScheduleConfig(matchingSetting);

    // 仅管理员可读取/修改调度配置
    if (action === 'getSchedule') {
      const auth = await checkManualAdminAuth(wxContext, adminOpenIds);
      if (!auth.ok) return auth.response;
      return {
        success: true,
        data: {
          enabled: scheduleConfig.enabled,
          hour: scheduleConfig.hour,
          minute: scheduleConfig.minute,
          timezone: scheduleConfig.timezone
        }
      };
    }

    if (action === 'setSchedule') {
      const auth = await checkManualAdminAuth(wxContext, adminOpenIds);
      if (!auth.ok) return auth.response;

      const enabled = !!event.enabled;
      const hour = Number(event.hour);
      const minute = Number(event.minute);
      const timezone = (event.timezone || 'Asia/Shanghai').toString();
      if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
        return {
          success: false,
          message: '时间配置无效'
        };
      }

      const scheduleData = {
        'matching.scheduleEnabled': enabled,
        'matching.randomMatchEnabled': enabled,
        'matching.scheduleHour': hour,
        'matching.scheduleMinute': minute,
        'matching.timezone': timezone,
        'matching.updatedAt': new Date(),
        'matching.updatedBy': wxContext.OPENID
      };

      await db.collection('AdminSettings').doc(adminSettingsDocId).update({ data: scheduleData }).catch(async () => {
        await db.collection('AdminSettings').doc(adminSettingsDocId).set({
          data: {
            adminOpenIds,
            matching: {
              ...matchingSetting,
              scheduleEnabled: enabled,
              randomMatchEnabled: enabled,
              scheduleHour: hour,
              scheduleMinute: minute,
              timezone,
              updatedAt: new Date(),
              updatedBy: wxContext.OPENID
            }
          }
        });
      });

      // 回读校验，确保配置已真实写入数据库
      const verifyRes = await db.collection('AdminSettings').doc(adminSettingsDocId).get().catch(() => ({ data: null }));
      const verifyData = (verifyRes && verifyRes.data) ? verifyRes.data : {};
      const savedMatching = verifyData.matching || {};
      const savedSchedule = getScheduleConfig(savedMatching);

      return {
        success: true,
        message: '匹配计划已保存',
        data: {
          enabled: savedSchedule.enabled,
          hour: savedSchedule.hour,
          minute: savedSchedule.minute,
          timezone: savedSchedule.timezone
        },
        debug: {
          updatedBy: savedMatching.updatedBy || wxContext.OPENID
        }
      };
    }

    if (isScheduleTrigger) {
      // 定时触发要求：无用户身份
      if (wxContext.OPENID) {
        return {
          success: false,
          code: 403,
          message: '定时任务鉴权失败'
        };
      }
    } else {
      // 手动触发要求：必须是管理员
      const auth = await checkManualAdminAuth(wxContext, adminOpenIds);
      if (!auth.ok) return auth.response;
    }

    const dryRun = !!(event && event.dryRun);
    const runId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // 获取所有愿意随机分配且无舞伴的用户
    const singleUsersResult = await db.collection('ActiveUser')
      .where({
        'partner.hasPartner': false,
        'partner.allowRandomMatch': true,
        'profile.completed': true,
        // 仅显式隐藏账号不参与随机匹配
        'visibility.hiddenFromUsers': _.neq(true)
      })
      .get();

    if (dryRun) {
      return {
        success: true,
        message: '鉴权通过',
        runId,
        triggerType,
        candidateCount: singleUsersResult.data.length,
        dryRun: true
      };
    }
    
    if (singleUsersResult.data.length < 2) {
      await db.collection('MatchTaskLog').add({
        data: {
          runId,
          triggerType,
          operatorOpenId: wxContext.OPENID || '',
          status: 'skipped',
          reason: 'NOT_ENOUGH_CANDIDATES',
          candidateCount: singleUsersResult.data.length,
          matchCount: 0,
          createdAt: new Date()
        }
      }).catch(() => {});
      return {
        success: false,
        message: '愿意随机分配的单身用户不足2人',
        count: singleUsersResult.data.length,
        runId
      };
    }
    
    const singleUsers = singleUsersResult.data;
    const matches = [];
    const processed = new Set();
    
    // 简单的随机配对算法
    for (let i = 0; i < singleUsers.length - 1; i++) {
      if (processed.has(singleUsers[i]._id)) continue;
      
      for (let j = i + 1; j < singleUsers.length; j++) {
        if (processed.has(singleUsers[j]._id)) continue;
        
        const user1 = singleUsers[i];
        const user2 = singleUsers[j];
        
        // 可以在这里添加更复杂的匹配逻辑
        // 如：性别互补、学校偏好、年龄匹配等
        
        // 简单配对：不同性别优先
        if (user1.gender !== user2.gender) {
          matches.push({
            user1: user1,
            user2: user2
          });
          processed.add(user1._id);
          processed.add(user2._id);
          break;
        }
      }
    }
    
    // 如果还有同性别的用户，也进行配对
    const remaining = singleUsers.filter(user => !processed.has(user._id));
    for (let i = 0; i < remaining.length - 1; i += 2) {
      matches.push({
        user1: remaining[i],
        user2: remaining[i + 1]
      });
      processed.add(remaining[i]._id);
      processed.add(remaining[i + 1]._id);
    }
    
    // 执行配对：更新数据库
    const matchResults = [];
    
    for (const match of matches) {
      const user1 = match.user1;
      const user2 = match.user2;
      const now = new Date();
      
      // 并行更新双方
      await Promise.all([
        db.collection('ActiveUser').doc(user1._id).update({
          data: {
            'partner.hasPartner': true,
            'partner.partnerName': user2.name,
            'partner.partnerAccountUserId': user2._id,
            'partner.partnerNumericId': user2.numericId,
            'partner.matchTime': now,
            'partner.matchType': 'random',
            'partner.allowRandomMatch': false
          }
        }),
        db.collection('ActiveUser').doc(user2._id).update({
          data: {
            'partner.hasPartner': true,
            'partner.partnerName': user1.name,
            'partner.partnerAccountUserId': user1._id,
            'partner.partnerNumericId': user1.numericId,
            'partner.matchTime': now,
            'partner.matchType': 'random',
            'partner.allowRandomMatch': false
          }
        })
      ]);
      
      matchResults.push({
        user1: {
          name: user1.name,
          numericId: user1.numericId
        },
        user2: {
          name: user2.name,
          numericId: user2.numericId
        }
      });
    }
    
    // 更新管理员设置中的最后匹配时间
    await db.collection('AdminSettings').doc(adminSettingsDocId).update({
      data: {
        'matching.lastMatchTime': new Date(),
        'matching.lastMatchCount': matches.length,
        'matching.lastRunId': runId,
        'matching.lastTriggerType': triggerType
      }
    }).catch(async () => {
      await db.collection('AdminSettings').doc(adminSettingsDocId).set({
        data: {
          ...adminSettings,
          adminOpenIds,
          matching: {
            ...matchingSetting,
            lastMatchTime: new Date(),
            lastMatchCount: matches.length,
            lastRunId: runId,
            lastTriggerType: triggerType
          }
        }
      });
    });

    await db.collection('MatchTaskLog').add({
      data: {
        runId,
        triggerType,
        operatorOpenId: wxContext.OPENID || '',
        status: 'success',
        candidateCount: singleUsers.length,
        matchCount: matches.length,
        totalProcessed: processed.size,
        matches: matchResults,
        createdAt: new Date()
      }
    }).catch(() => {});
    
    return {
      success: true,
      message: `成功配对 ${matches.length} 对舞伴`,
      runId,
      triggerType,
      matchCount: matches.length,
      totalProcessed: processed.size,
      matches: matchResults
    };
    
  } catch (error) {
    console.error('随机配对失败:', error);
    await db.collection('MatchTaskLog').add({
      data: {
        runId: `match_error_${Date.now()}`,
        triggerType: (event && event.triggerType) || 'manual',
        operatorOpenId: (wxContext && wxContext.OPENID) || '',
        status: 'error',
        error: error.message,
        createdAt: new Date()
      }
    }).catch(() => {});
    return {
      success: false,
      message: error.message || '服务端异常',
      error: error.message
    };
  }
};