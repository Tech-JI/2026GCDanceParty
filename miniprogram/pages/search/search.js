// 搜索舞伴页面逻辑
const { getCurrentUser, checkUserStatus } = require('../../utils/userFlow.js');

Page({
  data: {
    searchId: '',
    searchResult: null,
    isSearching: false,
    showResult: false,
    inviteMessage: ''
  },

  onLoad() {
    this.checkUserAccess();
  },

  // 检查用户登录状态
  async checkUserAccess() {
    const openid = wx.getStorageSync('openid');
    const accountUserId = wx.getStorageSync('accountUserId');
    if (!openid && !accountUserId) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return false;
    }
    return true;
  },

  // 输入搜索ID
  onSearchIdInput(e) {
    this.setData({
      searchId: e.detail.value.trim()
    });
  },

  // 执行搜索
  async onSearchTap() {
    if (!this.data.searchId) {
      wx.showToast({
        title: '请输入数字ID',
        icon: 'none'
      });
      return;
    }

    // 验证输入格式
    if (!/^\d+$/.test(this.data.searchId)) {
      wx.showToast({
        title: '请输入有效的数字ID',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isSearching: true,
      showResult: false
    });

    wx.showLoading({
      title: '搜索中...'
    });

    try {
      const result = await wx.cloud.callFunction({
        name: 'search_partner',
        data: {
          searchId: parseInt(this.data.searchId)
        }
      });

      wx.hideLoading();

      if (result.result.success) {
        this.setData({
          searchResult: result.result,
          showResult: true,
          isSearching: false
        });
      } else {
        wx.showToast({
          title: result.result.message || '搜索失败',
          icon: 'none',
          duration: 2000
        });
        this.setData({
          isSearching: false,
          showResult: false
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('搜索错误:', error);
      wx.showToast({
        title: '搜索失败，请重试',
        icon: 'none'
      });
      this.setData({
        isSearching: false,
        showResult: false
      });
    }
  },

  // 清空搜索结果
  onClearResult() {
    this.setData({
      searchResult: null,
      showResult: false,
      searchId: '',
      inviteMessage: ''
    });
  },

  // 输入邀请消息
  onInviteMessageInput(e) {
    this.setData({
      inviteMessage: e.detail.value
    });
  },

  // 发送邀请
  async onSendInvitation() {
    if (!this.data.searchResult || !this.data.searchResult.userInfo) {
      wx.showToast({
        title: '无法发送邀请',
        icon: 'none'
      });
      return;
    }

    if (!this.data.searchResult.canInvite) {
      wx.showToast({
        title: '该用户不接受邀请',
        icon: 'none'
      });
      return;
    }

    const message = this.data.inviteMessage.trim();
    if (!message) {
      wx.showToast({
        title: '请输入邀请消息',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '发送中...'
    });

    try {
      const result = await wx.cloud.callFunction({
        name: 'send_partner_invitation',
        data: {
          currentAccountUserId: wx.getStorageSync('accountUserId') || '',
          targetNumericId: this.data.searchResult.userInfo.numericId,
          message: message
        }
      });

      wx.hideLoading();

      if (result.result.success) {
        wx.showModal({
          title: '发送成功',
          content: '邀请已发送，请等待对方回复。您可以在邀请页面查看邀请状态。',
          showCancel: false,
          confirmText: '知道了',
          success: (res) => {
            if (res.confirm) {
              // 清空搜索结果
              this.onClearResult();
              // 跳转到邀请页面
              wx.switchTab({
                url: '/pages/invitation/invitation'
              });
            }
          }
        });
      } else {
        if (result.result.hasReverseInvitation) {
          wx.showModal({
            title: '提示',
            content: result.result.message,
            confirmText: '去查看',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                wx.switchTab({
                  url: '/pages/invitation/invitation'
                });
              }
            }
          });
        } else {
          wx.showToast({
            title: result.result.message || '发送失败',
            icon: 'none',
            duration: 2000
          });
        }
      }

    } catch (error) {
      wx.hideLoading();
      console.error('发送邀请错误:', error);
      wx.showToast({
        title: '发送failed，请重试',
        icon: 'none'
      });
    }
  },

  // 分享到微信
  onShareTap() {
    wx.showShareMenu({
      withShareTicket: true
    });
  },

  onShareAppMessage() {
    return {
      title: '查找舞伴',
      path: '/pages/search/search'
    };
  }
});