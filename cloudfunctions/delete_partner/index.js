// 云函数：解除舞伴关系
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

const emptyPartner = {
  hasPartner: false,
  partnerName: '',
  partnerAccountUserId: '',
  partnerNumericId: '',
  matchTime: null,
  matchType: '',
  allowRandomMatch: false
};

exports.main = async (event, context) => {
  try {
    const { currentAccountUserId } = event;

    if (!currentAccountUserId) {
      return { success: false, message: '缺少账号信息，请重新登录' };
    }

    const userResult = await db.collection('ActiveUser').doc(currentAccountUserId).get();
    const currentUser = userResult.data;

    if (!currentUser) {
      return { success: false, message: '用户不存在' };
    }

    if (!currentUser.partner || !currentUser.partner.hasPartner) {
      return { success: false, message: '您当前没有舞伴' };
    }

    const partnerAccountUserId = currentUser.partner.partnerAccountUserId;

    // 清除当前用户的舞伴信息
    await db.collection('ActiveUser').doc(currentAccountUserId).update({
      data: { partner: emptyPartner }
    });

    // 清除对方的舞伴信息
    if (partnerAccountUserId) {
      try {
        await db.collection('ActiveUser').doc(partnerAccountUserId).update({
          data: { partner: emptyPartner }
        });
      } catch (e) {
        console.warn('清除对方舞伴信息失败:', e);
      }
    }

    return { success: true, message: '解除舞伴成功' };

  } catch (e) {
    console.error('delete_partner error:', e);
    return { success: false, message: e.message || '解除失败' };
  }
}
