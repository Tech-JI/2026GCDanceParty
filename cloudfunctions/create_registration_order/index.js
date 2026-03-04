// 云函数：创建报名订单
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { competitionId, partnerNumericId } = event;
    
    // 获取当前用户信息
    const currentUserResult = await db.collection('ActiveUser')
      .where({
        'openid': wxContext.OPENID
      })
      .get();
    
    if (currentUserResult.data.length === 0) {
      return {
        success: false,
        message: '用户信息不存在'
      };
    }
    
    const currentUser = currentUserResult.data[0];
    
    // 验证用户状态
    if (!currentUser.profile.completed) {
      return {
        success: false,
        message: '请先完善个人资料'
      };
    }
    
    if (!currentUser.partner.hasPartner) {
      return {
        success: false,
        message: '请先找到舞伴再报名'
      };
    }
    
    // 验证舞伴ID
    if (currentUser.partner.partnerNumericId !== partnerNumericId) {
      return {
        success: false,
        message: '舞伴信息不匹配'
      };
    }
    
    // 获取舞伴信息
    const partnerResult = await db.collection('ActiveUser')
      .where({
        'numericId': partnerNumericId
      })
      .get();
    
    if (partnerResult.data.length === 0) {
      return {
        success: false,
        message: '舞伴信息不存在'
      };
    }
    
    const partner = partnerResult.data[0];
    
    if (!partner.partner.hasPartner || partner.partner.partnerNumericId !== currentUser.numericId) {
      return {
        success: false,
        message: '舞伴关系不匹配'
      };
    }
    
    // 检查是否已经报名过这个比赛
    const existingOrderResult = await db.collection('RegistrationOrders')
      .where(_.or([
        {
          'user1NumericId': currentUser.numericId,
          'user2NumericId': partnerNumericId,
          'competitionId': competitionId,
          'status': _.in(['pending', 'paid', 'confirmed'])
        },
        {
          'user1NumericId': partnerNumericId,
          'user2NumericId': currentUser.numericId,
          'competitionId': competitionId,
          'status': _.in(['pending', 'paid', 'confirmed'])
        }
      ]))
      .get();
    
    if (existingOrderResult.data.length > 0) {
      return {
        success: false,
        message: '您已经报名过这个比赛了'
      };
    }
    
    // 获取比赛信息和价格
    const adminSettingsResult = await db.collection('AdminSettings')
      .doc('admin_settings')
      .get();
    
    let competitionInfo = null;
    let basePrice = 100; // 默认价格
    
    if (adminSettingsResult.data && adminSettingsResult.data.competitions) {
      competitionInfo = adminSettingsResult.data.competitions.find(comp => comp.id === competitionId);
      if (competitionInfo) {
        basePrice = competitionInfo.price || 100;
      }
    }
    
    if (!competitionInfo) {
      return {
        success: false,
        message: '比赛信息不存在'
      };
    }
    
    // 计算优惠
    let discount = 0;
    let discountReason = '';
    
    // 检查可用优惠
    const userRegistrationCount = await db.collection('RegistrationOrders')
      .where(_.or([
        {
          'user1NumericId': currentUser.numericId,
          'status': _.in(['paid', 'confirmed'])
        },
        {
          'user2NumericId': currentUser.numericId,
          'status': _.in(['paid', 'confirmed'])
        }
      ]))
      .count();
    
    const partnerRegistrationCount = await db.collection('RegistrationOrders')
      .where(_.or([
        {
          'user1NumericId': partnerNumericId,
          'status': _.in(['paid', 'confirmed'])
        },
        {
          'user2NumericId': partnerNumericId,
          'status': _.in(['paid', 'confirmed'])
        }
      ]))
      .count();
    
    // 新用户优惠：双方都是第一次报名，优惠20%
    if (userRegistrationCount.total === 0 && partnerRegistrationCount.total === 0) {
      discount = 0.2;
      discountReason = '新用户优惠';
    } 
    // 老用户带新用户优惠：一方是老用户，优惠10%
    else if (userRegistrationCount.total === 0 || partnerRegistrationCount.total === 0) {
      discount = 0.1;
      discountReason = '新老用户组合优惠';
    }
    
    // 计算最终价格
    const finalPrice = Math.max(basePrice * (1 - discount), 1); // 最低1分钱
    
    // 生成订单ID
    const orderId = `REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建订单
    const orderData = {
      orderId: orderId,
      competitionId: competitionId,
      competitionName: competitionInfo.name,
      user1NumericId: currentUser.numericId,
      user1Name: currentUser.name,
      user1OpenId: currentUser.openid,
      user2NumericId: partnerNumericId,
      user2Name: partner.name,
      user2OpenId: partner.openid,
      registeredBy: currentUser.numericId,
      basePrice: basePrice,
      discount: discount,
      discountReason: discountReason,
      finalPrice: finalPrice,
      status: 'pending',
      createdTime: new Date(),
      expiryTime: new Date(Date.now() + 30 * 60 * 1000) // 30分钟后过期
    };
    
    const result = await db.collection('RegistrationOrders').add({
      data: orderData
    });
    
    if (result._id) {
      return {
        success: true,
        message: '报名订单创建成功',
        orderId: orderId,
        orderInfo: {
          competitionName: competitionInfo.name,
          user1Name: currentUser.name,
          user2Name: partner.name,
          basePrice: basePrice,
          discount: discount,
          discountReason: discountReason,
          finalPrice: finalPrice,
          expiryTime: orderData.expiryTime
        }
      };
    } else {
      return {
        success: false,
        message: '订单创建失败'
      };
    }
    
  } catch (error) {
    console.error('创建报名订单失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};