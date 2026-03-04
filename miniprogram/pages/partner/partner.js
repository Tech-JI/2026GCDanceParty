// 点击个人页面，可以点开自己的舞伴，看看舞伴的信息
const db = wx.cloud.database();

Page({
  data: {
    openid: '', // 用户的openid
    hiddenmodalput: true, // 弹窗是否显示
    dataobj: {}, // 舞伴的数据
    user: {}, // 用户的数据
    done: false // 页面和数据是否加载完成
  },

  // 一个回调函数
  invite() {
    this.setData({
      hiddenmodalput: false
    })
  },

  // 弹窗弹出
  modalcancel() {
    this.setData({
      hiddenmodalput: true
    })
  },
  modalconfirm() {
    this.setData({
      hiddenmodalput: true
    });
    this.delete();
    ;
  },

  // 解除舞伴
  async delete() {
    const accountUserId = wx.getStorageSync('accountUserId');
    if (!accountUserId) {
      wx.showToast({ title: '请重新登录', icon: 'error' });
      return;
    }

    wx.showLoading({ title: '解除中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'delete_partner',
        data: { currentAccountUserId: accountUserId }
      });
      wx.hideLoading();
      if (res.result && res.result.success) {
        wx.showToast({ title: '解除成功', icon: 'success', mask: true });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/mine/mine' });
        }, 1200);
      } else {
        wx.showModal({
          title: '解除失败',
          content: (res.result && res.result.message) || '操作失败，请重试',
          showCancel: false
        });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showModal({ title: '错误', content: e.message || '网络错误', showCancel: false });
    }
  },

  // 获得用户的openid
  get_openid() {
    const openid = wx.getStorageSync('openid');
    const accountUserId = wx.getStorageSync('accountUserId');
    this.setData({
      done: false
    });
    const loadInvitationState = (currentUser) => {
      db.collection('Invitations').where({
        senderAccountUserId: currentUser._id,
        receiverAccountUserId: this.data.dataobj._id
      }).get({
        success: res => {
          if (res.data.length) {
            this.setData({ done: true });
            return;
          }
          db.collection('Invitations').where({ senderid: currentUser._openid, receiverid: this.data.dataobj._openid }).get({
            success: legacyRes => {
              console.log(legacyRes.data.length);
              this.setData({ done: true });
            }
          })
        }
      })
    };

    if (accountUserId) {
      db.collection('ActiveUser').doc(accountUserId).get({
        success: res => {
          if (!res.data) {
            return;
          }
          this.setData({
            user: res.data
          })
          loadInvitationState(res.data);
        }
      });
      return;
    }

    db.collection('ActiveUser').where({ _openid: openid }).get({
      success: res => {
        if (!res.data.length) {
          return;
        }
        var user2 = res.data[0];
        this.setData({
          user: user2
        })
        loadInvitationState(user2);
      }
    });
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    db.collection("ActiveUser").doc(options.personid).get({
      success: res => {
        if (!res.data) {
          db.collection("ActiveUser").where({ _openid: options.personid }).get({
            success: legacyRes => {
              if (!legacyRes.data.length) {
                return;
              }
              this.setData({ dataobj: legacyRes.data[0] })
            }
          })
          return;
        }
        this.setData({
          dataobj: res.data
        })
      },
      fail: () => {
        db.collection("ActiveUser").where({ _openid: options.personid }).get({
          success: legacyRes => {
            if (!legacyRes.data.length) {
              return;
            }
            this.setData({ dataobj: legacyRes.data[0] })
          }
        })
      }
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    this.get_openid();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})