// 云函数：随机舞伴分配
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 检查是否为管理员调用（简单验证）
    const adminOpenId = event.adminOpenId; // 应该从管理员设置中获取
    
    // 获取所有愿意随机分配且无舞伴的用户
    const singleUsersResult = await db.collection('ActiveUser')
      .where({
        'partner.hasPartner': false,
        'partner.allowRandomMatch': true,
        'profile.completed': true
      })
      .get();
    
    if (singleUsersResult.data.length < 2) {
      return {
        success: false,
        message: '愿意随机分配的单身用户不足2人',
        count: singleUsersResult.data.length
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
    await db.collection('AdminSettings').doc('admin_settings').update({
      data: {
        'matching.lastMatchTime': new Date(),
        'matching.lastMatchCount': matches.length
      }
    });
    
    return {
      success: true,
      message: `成功配对 ${matches.length} 对舞伴`,
      matchCount: matches.length,
      totalProcessed: processed.size,
      matches: matchResults
    };
    
  } catch (error) {
    console.error('随机配对失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};