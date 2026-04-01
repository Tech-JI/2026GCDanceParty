// 邀请管理页面
const { getCurrentUser, checkUserStatus } = require('../../utils/userFlow.js');

const db = wx.cloud.database();
const _ = db.command;

const formatTime = (t) => {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return String(t);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

Page({
  data: {
    receivedInvitations: [],
    sentInvitations: [],
    activeTab: 0,
    loading: true,
    replyMessage: '',
    currentInvitation: null,
    showReplyModal: false,
    pendingReceivedCount: 0,
    submittingReply: false
  },

  normalizeInvitation(item = {}, userMapById = {}) {
    const sentTime = item.sentTime || '';
    const replyTime = item.replyTime || '';
    const expiryTime = item.expiryTime || '';

    const senderUser = (item.senderAccountUserId && userMapById[item.senderAccountUserId]) || null;
    const receiverUser = (item.receiverAccountUserId && userMapById[item.receiverAccountUserId]) || null;

    let normalizedStatus = (item.status || '').toString().trim().toLowerCase();
    if (!normalizedStatus) {
      normalizedStatus = 'unknown';
    }
    if (normalizedStatus === 'pending' && expiryTime) {
      const expiryDate = new Date(expiryTime);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() <= Date.now()) {
        normalizedStatus = 'expired';
      }
    }

    return {
      ...item,
      invitationId: item.invitationId || item._id,
      invitationDocId: item._id || '',
      fromName: item.fromName || (senderUser ? senderUser.name : ''),
      fromNumericId: item.fromNumericId || (senderUser ? senderUser.numericId : ''),
      toName: item.toName || (receiverUser ? receiverUser.name : ''),
      toNumericId: item.toNumericId || (receiverUser ? receiverUser.numericId : ''),
      message: item.message || '',
      status: normalizedStatus,
      sentTime: formatTime(sentTime),
      expiryTime: formatTime(expiryTime),
      replyTime: formatTime(replyTime),
      reply: item.reply || ''
    };
  },

  async buildUserMaps(invitationList = []) {
    const accountUserIds = [];

    invitationList.forEach((item) => {
      if (item.senderAccountUserId) accountUserIds.push(item.senderAccountUserId);
      if (item.receiverAccountUserId) accountUserIds.push(item.receiverAccountUserId);
    });

    const uniqueIds = [...new Set(accountUserIds.filter(Boolean))];
    const userMapById = {};

    if (uniqueIds.length) {
      const byIdResult = await db.collection('ActiveUser').where({
        _id: _.in(uniqueIds)
      }).get();
      (byIdResult.data || []).forEach((user) => {
        userMapById[user._id] = user;
      });
    }

    return { userMapById };
  },

  // 检查用户访问权限
  checkUserAccess() {
    const openid = wx.getStorageSync('openid');
    const accountUserId = wx.getStorageSync('accountUserId');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    if (!isLoggedIn || (!openid && !accountUserId)) {
      wx.redirectTo({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  async onShow() {
    if (!this.checkUserAccess()) return;
    this.loadInvitations();
  },

  // 切换标签页
  onTabClick(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({
      activeTab: index
    });
  },

  // 加载邀请列表
  async loadInvitations() {
    this.setData({ loading: true });

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        wx.showToast({
          title: '用户信息获取失败',
          icon: 'none'
        });
        return;
      }

      // 获取收到的邀请
      const receivedResult = await wx.cloud.database()
        .collection('Invitations')
        .where({
          receiverAccountUserId: currentUser._id
        })
        .orderBy('sentTime', 'desc')
        .get();

      // 获取发送的邀请
      const sentResult = await wx.cloud.database()
        .collection('Invitations')
        .where({
          senderAccountUserId: currentUser._id
        })
        .orderBy('sentTime', 'desc')
        .get();

      const allInvitations = [...(receivedResult.data || []), ...(sentResult.data || [])];
      const { userMapById } = await this.buildUserMaps(allInvitations);

      const normalizedReceived = (receivedResult.data || []).map((item) =>
        this.normalizeInvitation(item, userMapById)
      );
      const normalizedSent = (sentResult.data || []).map((item) =>
        this.normalizeInvitation(item, userMapById)
      );

      // 计算待处理邀请数量
      const pendingReceivedCount = normalizedReceived.filter(item => item.status === 'pending').length;

      this.setData({
        receivedInvitations: normalizedReceived,
        sentInvitations: normalizedSent,
        pendingReceivedCount: pendingReceivedCount,
        loading: false
      });

    } catch (error) {
      console.error('加载邀请失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 显示回复模态框
  onShowReplyModal(e) {
    const invitation = e.currentTarget.dataset.invitation;
    this.setData({
      currentInvitation: invitation,
      showReplyModal: true,
      replyMessage: ''
    });
  },

  // 隐藏回复模态框
  onHideReplyModal() {
    this.setData({
      showReplyModal: false,
      currentInvitation: null,
      replyMessage: ''
    });
  },

  // 输入回复消息
  onReplyInput(e) {
    this.setData({
      replyMessage: e.detail.value
    });
  },

  // 阻止模态框内部点击冒泡
  onModalTap() {},

  // 接受邀请
  async onAcceptInvitation() {
    if (!this.data.currentInvitation) return;
    if (this.data.submittingReply) return;
    if (this.data.currentInvitation.status !== 'pending') {
      wx.showToast({
        title: '该邀请当前不可处理',
        icon: 'none'
      });
      return;
    }

    this.setData({ submittingReply: true });

    wx.showLoading({
      title: '处理中...'
    });

    try {
      if (this.data.currentInvitation.invitationDocId) {
        const latestInvitation = await db.collection('Invitations').doc(this.data.currentInvitation.invitationDocId).get();
        const latestStatus = (((latestInvitation && latestInvitation.data && latestInvitation.data.status) || '') + '').toLowerCase();
        if (latestStatus !== 'pending') {
          wx.hideLoading();
          wx.showModal({
            title: '无法处理',
            content: `该邀请当前状态为：${latestStatus || 'unknown'}`,
            showCancel: false
          });
          this.loadInvitations();
          return;
        }
      }

      const result = await wx.cloud.callFunction({
        name: 'reply_invitation',
        data: {
          currentAccountUserId: wx.getStorageSync('accountUserId') || '',
          invitationId: this.data.currentInvitation.invitationId,
          invitationDocId: this.data.currentInvitation.invitationDocId || '',
          action: 'accept',
          reply: this.data.replyMessage || '接受了您的邀请！期待与您一起跳舞！'
        }
      });

      wx.hideLoading();

      const callResult = (result && result.result) ? result.result : {};

      if (callResult.success) {
        wx.showModal({
          title: '配对成功！',
          content: `恭喜！您已与 ${callResult.partnerInfo.name}（ID: ${callResult.partnerInfo.numericId}）成为舞伴！`,
          showCancel: false,
          confirmText: '太好了',
          success: () => {
            this.onHideReplyModal();
            this.loadInvitations();
            // 跳转到我的页面查看舞伴信息
            wx.switchTab({
              url: '/pages/mine/mine'
            });
          }
        });
      } else {
        wx.showModal({
          title: '接受失败',
          content: callResult.message || callResult.error || '请重试',
          showCancel: false
        });
        this.loadInvitations();
      }

    } catch (error) {
      wx.hideLoading();
      console.error('接受邀请失败:', error);
      wx.showModal({
        title: '操作失败',
        content: (error && error.message) || '请重试',
        showCancel: false
      });
    } finally {
      this.setData({ submittingReply: false });
    }
  },

  // 拒绝邀请
  async onRejectInvitation() {
    if (!this.data.currentInvitation) return;
    if (this.data.submittingReply) return;
    if (this.data.currentInvitation.status !== 'pending') {
      wx.showToast({
        title: '该邀请当前不可处理',
        icon: 'none'
      });
      return;
    }

    this.setData({ submittingReply: true });

    wx.showLoading({
      title: '处理中...'
    });

    try {
      const result = await wx.cloud.callFunction({
        name: 'reply_invitation',
        data: {
          currentAccountUserId: wx.getStorageSync('accountUserId') || '',
          invitationId: this.data.currentInvitation.invitationId,
          invitationDocId: this.data.currentInvitation.invitationDocId || '',
          action: 'reject',
          reply: this.data.replyMessage || '感谢邀请，但暂时无法接受'
        }
      });

      wx.hideLoading();

      const callResult = (result && result.result) ? result.result : {};

      if (callResult.success) {
        wx.showToast({
          title: '已拒绝邀请',
          icon: 'success'
        });
        this.onHideReplyModal();
        this.loadInvitations();
      } else {
        wx.showModal({
          title: '拒绝失败',
          content: callResult.message || callResult.error || '请重试',
          showCancel: false
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('拒绝邀请失败:', error);
      wx.showModal({
        title: '操作失败',
        content: (error && error.message) || '请重试',
        showCancel: false
      });
    } finally {
      this.setData({ submittingReply: false });
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadInvitations();
    wx.stopPullDownRefresh();
  },

  // 格式化时间
  formatTime(time) {
    const date = new Date(time);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return Math.floor(diff / 60000) + '分钟前';
    } else if (diff < 86400000) { // 1天内
      return Math.floor(diff / 3600000) + '小时前';
    } else {
      return Math.floor(diff / 86400000) + '天前';
    }
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: '邀请管理',
      path: '/pages/invitation/invitation'
    };
  },
  navigateTo(e) {
    const url = e.currentTarget.dataset.url; 
    
    if (url) {
      wx.navigateTo({
        url: url,
        fail: (err) => {
          console.error('跳转失败:', err);
        }
      });
    }
  }
});