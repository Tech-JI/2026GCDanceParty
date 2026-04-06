// 云函数：发送舞伴邀请
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { targetNumericId, message, currentAccountUserId } = event;
    if (!currentAccountUserId) {
      return {
        success: false,
        message: '缺少当前账号信息，请重新登录'
      };
    }
    
    // 获取当前用户信息
    const currentUserResult = await db.collection('ActiveUser').doc(currentAccountUserId).get();

    if (!currentUserResult.data) {
      return {
        success: false,
        message: '用户信息不存在'
      };
    }

    const currentUser = currentUserResult.data;

    if (currentUser.visibility && currentUser.visibility.hiddenFromUsers) {
      return {
        success: false,
        message: '当前账号不可发起邀请'
      };
    }
    
    if (currentUser.wxOpenid && currentUser.wxOpenid !== wxContext.OPENID) {
      return {
        success: false,
        message: '账号会话已失效，请重新登录'
      };
    }
    
    // 验证当前用户状态
    if (!currentUser.partner || typeof currentUser.partner !== 'object') {
      return {
        success: false,
        message: '当前用户舞伴信息异常，请重新登录'
      };
    }
    const currentReg = currentUser.registration || {};
    if (!currentReg.registered) {
      return {
        success: false,
        message: '您的报名尚未激活，请先完成支付并等待核销后，再发送邀请'
      };
    }
    if (currentUser.partner.hasPartner) {
      return {
        success: false,
        message: '您已经有舞伴了，无法发送邀请'
      };
    }
    
    if (!currentUser.profile || !currentUser.profile.completed) {
      return {
        success: false,
        message: '请先完善个人资料'
      };
    }
    
    // 查找目标用户
    const targetUserResult = await db.collection('ActiveUser')
      .where({
        'numericId': targetNumericId
      })
      .get();
    
    if (targetUserResult.data.length === 0) {
      return {
        success: false,
        message: '目标用户不存在'
      };
    }
    
    const targetUser = targetUserResult.data[0];

    if (targetUser.visibility && targetUser.visibility.hiddenFromUsers) {
      return {
        success: false,
        message: '目标用户不存在'
      };
    }
    
    // 验证目标用户状态
    if (!targetUser.partner || typeof targetUser.partner !== 'object') {
      return {
        success: false,
        message: '目标用户资料不完整，暂时无法邀请'
      };
    }
    const targetReg = targetUser.registration || {};
    if (!targetReg.registered) {
      return {
        success: false,
        message: '对方尚未完成报名激活，暂不可邀请'
      };
    }
    if (targetUser.partner.hasPartner) {
      return {
        success: false,
        message: '对方已经有舞伴了'
      };
    }
    if (currentUser.numericId === targetNumericId) {
      return {
        success: false,
        message: '不能向自己发送邀请'
      };
    }

    if (!targetUser.privacy || targetUser.privacy.allowInvitation === false) {
      return {
        success: false,
        message: '对方设置为不接收邀请'
      };
    }
    
    // 检查是否已经发送过邀请
    const existingInvitationResult = await db.collection('Invitations')
      .where({
        'senderAccountUserId': currentUser._id,
        'fromNumericId': currentUser.numericId,
        'toNumericId': targetNumericId,
        'status': 'pending'
      })
      .get();
    
    if (existingInvitationResult.data.length > 0) {
      return {
        success: false,
        message: '您已经向该用户发送过邀请，请等待回复'
      };
    }
    
    // 检查对方是否已经向我发送过邀请
    const reverseInvitationResult = await db.collection('Invitations')
      .where({
        'receiverAccountUserId': currentUser._id,
        'fromNumericId': targetNumericId,
        'toNumericId': currentUser.numericId,
        'status': 'pending'
      })
      .get();
    
    if (reverseInvitationResult.data.length > 0) {
      return {
        success: false,
        message: '对方已经向您发送了邀请，请前往邀请页面查看并回复',
        hasReverseInvitation: true
      };
    }
    
    // 创建邀请记录
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const invitation = {
      invitationId: invitationId,
      senderAccountUserId: currentUser._id,
      receiverAccountUserId: targetUser._id,
      fromOpenId: wxContext.OPENID,
      fromNumericId: currentUser.numericId,
      fromName: currentUser.name,
      toNumericId: targetNumericId,
      toName: targetUser.name,
      toOpenId: targetUser.openId || targetUser._openid,
      message: message || '希望成为您的舞伴！',
      status: 'pending',
      sentTime: new Date(),
      expiryTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
    };
    
    const result = await db.collection('Invitations').add({
      data: invitation
    });
    
    if (result._id) {
      return {
        success: true,
        message: '邀请发送成功',
        invitationId: invitationId
      };
    } else {
      return {
        success: false,
        message: '邀请发送失败'
      };
    }
    
  } catch (error) {
    console.error('发送邀请失败:', error);
    return {
      success: false,
      message: error.message || '发送邀请失败',
      error: error.message
    };
  }
};