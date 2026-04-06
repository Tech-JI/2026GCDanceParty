// 云函数：回复邀请
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

async function updateInvitationsAutoRejected(invitationIds = [], now) {
  const uniqueIds = [...new Set((invitationIds || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return;
  }

  const chunkSize = 50;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    await Promise.all(chunk.map((id) =>
      db.collection('Invitations').doc(id).update({
        data: {
          status: 'auto_rejected',
          replyTime: now,
          reply: '因为已配对而自动拒绝'
        }
      })
    ));
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { invitationId, invitationDocId, action, reply, currentAccountUserId } = event;
    if (!currentAccountUserId) {
      return {
        success: false,
        message: '缺少当前账号信息，请重新登录'
      };
    }

    if (!invitationDocId && !invitationId) {
      return {
        success: false,
        message: '邀请参数缺失'
      };
    }
    
    // 获取邀请信息
    let invitation = null;

    if (invitationDocId) {
      const invitationDoc = await db.collection('Invitations').doc(invitationDocId).get();
      invitation = invitationDoc.data || null;
    } else {
      const invitationResult = await db.collection('Invitations')
        .where({
          invitationId: invitationId
        })
        .limit(1)
        .get();
      invitation = invitationResult.data[0] || null;
    }

    if (!invitation) {
      return {
        success: false,
        message: '邀请不存在或已过期'
      };
    }

    const invitationStatus = (invitation.status || '').toString().trim().toLowerCase();
    if (invitationStatus !== 'pending') {
      return {
        success: false,
        message: invitationStatus ? `该邀请当前状态为 ${invitationStatus}，无法重复操作` : '该邀请状态异常，无法处理'
      };
    }

    if (invitation.expiryTime) {
      const expiryDate = new Date(invitation.expiryTime);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() <= Date.now()) {
        await db.collection('Invitations').doc(invitation._id).update({
          data: {
            status: 'expired',
            replyTime: new Date(),
            reply: invitation.reply || '邀请已过期'
          }
        });
        return {
          success: false,
          message: '邀请已过期'
        };
      }
    }
    
    // 验证权限：只有接收者才能回复
    const currentUserResult = await db.collection('ActiveUser').doc(currentAccountUserId).get();

    if (!currentUserResult.data) {
      return {
        success: false,
        message: '用户不存在'
      };
    }

    const currentUser = currentUserResult.data;

    if (currentUser.wxOpenid && currentUser.wxOpenid !== wxContext.OPENID) {
      return {
        success: false,
        message: '账号会话已失效，请重新登录'
      };
    }
    
    if (invitation.receiverAccountUserId !== currentUser._id) {
      return {
        success: false,
        message: '您没有权限回复此邀请'
      };
    }
    
    // 检查当前用户状态（兼容旧版字符串格式，自动修复）
    const emptyPartner = {
      hasPartner: false, partnerName: '', partnerAccountUserId: '',
      partnerNumericId: '', matchTime: null, matchType: '', allowRandomMatch: false
    };
    if (!currentUser.partner || typeof currentUser.partner !== 'object') {
      await db.collection('ActiveUser').doc(currentUser._id).update({ data: { partner: emptyPartner } });
      currentUser.partner = emptyPartner;
    }

    if (currentUser.partner.hasPartner) {
      return {
        success: false,
        message: '您已经有舞伴了，无法接受邀请'
      };
    }
    const currentReg = currentUser.registration || {};
    if (currentReg.paymentStatus !== 'paid' && action === 'accept') {
      return {
        success: false,
        message: '您的报名尚未激活，请先完成支付并等待核销后，再接受邀请'
      };
    }
    // 获取邀请发送者信息
    if (!invitation.senderAccountUserId) {
      return {
        success: false,
        message: '邀请数据缺少发送者信息'
      };
    }

    const senderResult = await db.collection('ActiveUser').doc(invitation.senderAccountUserId).get();
    const sender = senderResult.data || null;
    
    if (!sender) {
      return {
        success: false,
        message: '邀请发送者不存在'
      };
    }
    const senderReg = sender.registration || {};
    if (senderReg.paymentStatus !== 'paid' && action === 'accept') {
      return {
        success: false,
        message: '对方的报名状态已失效或已退费，无法完成配对'
      };
    }
    // 检查发送者状态（兼容旧版字符串格式，自动修复）
    if (!sender.partner || typeof sender.partner !== 'object') {
      await db.collection('ActiveUser').doc(sender._id).update({ data: { partner: emptyPartner } });
      sender.partner = emptyPartner;
    }

    if (sender.partner.hasPartner && action === 'accept') {
      return {
        success: false,
        message: '对方已经有舞伴了'
      };
    }
    
    const now = new Date();
    if (action === 'accept') {
      // 接受邀请：创建舞伴关系
      
      const currentUserPartner = {
        hasPartner: true,
        partnerName: sender.name,
        partnerAccountUserId: sender._id,
        partnerNumericId: sender.numericId,
        matchTime: now,
        matchType: 'invitation',
        allowRandomMatch: false
      };

      const senderPartner = {
        hasPartner: true,
        partnerName: currentUser.name,
        partnerAccountUserId: currentUser._id,
        partnerNumericId: currentUser.numericId,
        matchTime: now,
        matchType: 'invitation',
        allowRandomMatch: false
      };

      // 更新邀请状态
      await db.collection('Invitations').doc(invitation._id).update({
        data: {
          status: 'accepted',
          replyTime: now,
          reply: reply || '接受了您的邀请'
        }
      });

      // 更新当前用户（接收者）
      await db.collection('ActiveUser').doc(currentUser._id).update({
        data: {
          partner: currentUserPartner
        }
      });
      
      // 更新发送者
      await db.collection('ActiveUser').doc(sender._id).update({
        data: {
          partner: senderPartner
        }
      });

      // 再处理其余待处理邀请（分批，避免 batch 上限导致核心事务失败）
      const otherInvitations1 = await db.collection('Invitations')
        .where({
          receiverAccountUserId: currentUser._id,
          status: 'pending',
          _id: _.neq(invitation._id)
        })
        .get();
      
      const otherInvitations2 = await db.collection('Invitations')
        .where({
          senderAccountUserId: currentUser._id,
          status: 'pending',
          _id: _.neq(invitation._id)
        })
        .get();
      
      const otherInvitations3 = await db.collection('Invitations')
        .where({
          receiverAccountUserId: sender._id,
          status: 'pending',
          _id: _.neq(invitation._id)
        })
        .get();
      
      const otherInvitations4 = await db.collection('Invitations')
        .where({
          senderAccountUserId: sender._id,
          status: 'pending',
          _id: _.neq(invitation._id)
        })
        .get();
      
      const allOtherInvitations = [
        ...otherInvitations1.data,
        ...otherInvitations2.data,
        ...otherInvitations3.data,
        ...otherInvitations4.data
      ];

      const otherIds = allOtherInvitations.map((item) => item && item._id).filter(Boolean);
      try {
        await updateInvitationsAutoRejected(otherIds, now);
      } catch (autoRejectError) {
        console.error('自动拒绝其他邀请失败:', autoRejectError);
      }
      
      return {
        success: true,
        message: '成功接受邀请！您已与对方成为舞伴',
        partnerInfo: {
          name: sender.name,
          numericId: sender.numericId
        }
      };
      
    } else if (action === 'reject') {
      // 拒绝邀请
      await db.collection('Invitations').doc(invitation._id).update({
        data: {
          'status': 'rejected',
          'replyTime': now,
          'reply': reply || '感谢邀请，但暂时无法接受'
        }
      });
      
      return {
        success: true,
        message: '已拒绝邀请'
      };
      
    } else {
      return {
        success: false,
        message: '无效的操作'
      };
    }
    
  } catch (error) {
    console.error('回复邀请失败:', error);
    return {
      success: false,
      code: 'REPLY_INVITATION_ERROR',
      message: error.message || '回复邀请失败',
      error: error.message
    };
  }
};