// 个人页面
const db = wx.cloud.database();
const _ = db.command;
const userFlow = require("../../utils/userFlow"); // 用户流程控制
const AuthUtil = require("../../utils/authUtil"); // 认证工具类


Page({
  data: {
    openid: '',
    dataobj: {},
    partnerobj: {},
    hasPartner: false,
    partnerDisplayName: '',
    partnerDisplayNumericId: '',
    done: false,
    allowRandomMatch: false,
    invitation: {},
    accept: {},
    invitedone: false,
    acceptdone: false,
    // 图片资源URL
    spinnerGif: '/icons/spinner.gif',
    backgroundImage: '/icons/background_mine.jpg'
  },

  // 图片加载错误处理
  onImageError(e) {
    console.log('图片加载失败:', e.detail);
  },

  edit() {
    var dataobj = this.data.dataobj;
    if (dataobj.canedit == true) {
      wx.navigateTo({
        url: "../edit/edit"
      })
    }
    else {
      wx.showToast({
        title: "您被禁言了",
        icon: 'error',
        mask: true
      })
    }

  },

  // 加载舞伴详情
  loadPartner(partnerAccountUserId, fallbackName = '', fallbackNumericId = '') {
    if (!partnerAccountUserId) {
      // 没有 accountUserId，仅展示名字
      this.setData({
        hasPartner: true,
        partnerDisplayName: fallbackName,
        partnerDisplayNumericId: fallbackNumericId
      });
      return;
    }

    db.collection('ActiveUser').doc(partnerAccountUserId).get({
      success: (res) => {
        const partner = res.data;
        if (!partner) {
          this.setData({
            hasPartner: true,
            partnerDisplayName: fallbackName,
            partnerDisplayNumericId: fallbackNumericId
          });
          return;
        }
        const resolveImage = (imgPath) => {
          if (imgPath && imgPath.startsWith('cloud://')) {
            wx.cloud.getTempFileURL({
              fileList: [imgPath],
              success: (urlRes) => {
                const fileInfo = urlRes.fileList && urlRes.fileList[0];
                this.setData({
                  hasPartner: true,
                  partnerDisplayName: partner.name || fallbackName,
                  partnerDisplayNumericId: partner.numericId || fallbackNumericId,
                  partnerobj: { ...partner, image: (fileInfo && fileInfo.tempFileURL) || '/icons/person.png' }
                });
              },
              fail: () => {
                this.setData({
                  hasPartner: true,
                  partnerDisplayName: partner.name || fallbackName,
                  partnerDisplayNumericId: partner.numericId || fallbackNumericId,
                  partnerobj: { ...partner, image: '/icons/person.png' }
                });
              }
            });
          } else {
            this.setData({
              hasPartner: true,
              partnerDisplayName: partner.name || fallbackName,
              partnerDisplayNumericId: partner.numericId || fallbackNumericId,
              partnerobj: { ...partner, image: imgPath || '/icons/person.png' }
            });
          }
        };
        resolveImage(partner.image);
      },
      fail: () => {
        this.setData({
          hasPartner: true,
          partnerDisplayName: fallbackName,
          partnerDisplayNumericId: fallbackNumericId
        });
      }
    });
  },

  get_openid() {
    const accountUserId = wx.getStorageSync('accountUserId');
    console.log('🔍 mine页面会话信息:', { accountUserId });

    if (!accountUserId) {
      console.error('❌ 本地会话为空，跳转到登录页');
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }

    const loadUserSuccess = (userData) => {
      const partnerInfo = userData.partner || {};
      const hasPartner = !!partnerInfo.hasPartner;

      this.setData({
        done: true,
        dataobj: userData,
        openid: userData._openid || '',
        hasPartner,
        allowRandomMatch: !!partnerInfo.allowRandomMatch,
        partnerDisplayName: partnerInfo.partnerName || '',
        partnerDisplayNumericId: partnerInfo.partnerNumericId || '',
        partnerobj: {}
      });

      if (hasPartner) {
        this.loadPartner(
          partnerInfo.partnerAccountUserId || '',
          partnerInfo.partnerName || '',
          partnerInfo.partnerNumericId || ''
        );
      }
    };

    const wxOpenid = wx.getStorageSync('wxOpenid') || '';

    const tryByOpenid = () => {
      const id = wx.getStorageSync('openid') || wxOpenid;
      if (!id) {
        wx.showToast({ title: '用户数据加载失败', icon: 'error' });
        return;
      }
      db.collection('ActiveUser').where({ _openid: id }).get({
        success: (res) => {
          if (!res.data || !res.data.length) {
            wx.showToast({ title: '用户数据未找到', icon: 'error' });
            return;
          }
          loadUserSuccess(res.data[0]);
        },
        fail: () => wx.showToast({ title: '用户数据加载失败', icon: 'error' })
      });
    };

    if (accountUserId) {
      db.collection("ActiveUser").doc(accountUserId).get({
        success: (resDoc) => {
          if (!resDoc.data) { tryByOpenid(); return; }
          loadUserSuccess(resDoc.data);
        },
        fail: () => tryByOpenid()
      });
      return;
    }

    tryByOpenid();
  },

  toggleRandomMatch(e) {
    const val = e.detail.value;
    this.setData({ allowRandomMatch: val });
    const accountUserId = wx.getStorageSync('accountUserId');
    db.collection('ActiveUser').doc(accountUserId).update({
      data: { 'partner.allowRandomMatch': val }
    }).then(() => {
      wx.showToast({ title: val ? '随机匹配已开启' : '随机匹配已关闭', icon: 'none' });
    });
  },

  //前往邀请函页面
  toinvitation() {
    wx.navigateTo({
      url: "../invitation/invitation"
    });
  },
  
  // 登出功能
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          console.log('😪 用户确认退出登录');
          
          // 清除登录状态
          AuthUtil.clearLoginState();
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });
          
          // 延迟跳转到登录页
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      }
    });
  },
  
  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function (options) {
    console.log('👤 个人中心页面显示，检查登录状态...');
    
    // 只检查登录状态，不强制检查资料完整度
    const accountUserId = wx.getStorageSync('accountUserId');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    
    if (!accountUserId || !isLoggedIn) {
      console.log('❌ 用户未登录，跳转到登录页');
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }
    
    console.log('✅ 用户已登录，加载个人信息');
    this.setData({
      done: false
    });
    this.get_openid();
  },
  
  // 登出功能
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          console.log('😪 用户确认退出登录');
          
          // 清除登录状态
          AuthUtil.clearLoginState();
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });
          
          // 延迟跳转到登录页
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      }
    });
  },
})