//这个页面是：在邀请中查看自己发出的邀请时看到的
const db = wx.cloud.database(); // 获得数据库

Page({
  data: {
    openid: '', // 用户的openid
    hiddenmodalput: true, // 弹窗是否隐藏的bool
    dataobj: {}, // 用户邀请对象的数据
    user: {}, // 用户的数据
  },
  invite() {
    this.setData({
      hiddenmodalput: false
    })
  },

  // 点击撤回邀请按钮的回调函数 弹出显示框
  modalcancel() {
    this.setData({
      hiddenmodalput: true
    })
  },
  async modalconfirm() {
    this.setData({ hiddenmodalput: true });

    const myAccountUserId = wx.getStorageSync('accountUserId');
    const targetAccountUserId = this.data.dataobj._id;

    if (!myAccountUserId || !targetAccountUserId) {
      wx.showToast({ title: '信息缺失，无法撤回', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '撤回中...' });
    try {
      const res = await db.collection('Invitations')
        .where({
          senderAccountUserId: myAccountUserId,
          receiverAccountUserId: targetAccountUserId,
          status: 'pending'
        })
        .update({
          data: {
            status: 'cancelled',
            replyTime: new Date(),
            reply: '发送者撤回了邀请'
          }
        });
      wx.hideLoading();
      if (res.stats && res.stats.updated > 0) {
        wx.showToast({ title: '撤销成功', icon: 'success', mask: true });
        wx.switchTab({ url: '/pages/invitation/invitation' });
      } else {
        wx.showToast({ title: '邀请已处理或不存在', icon: 'none' });
        wx.switchTab({ url: '/pages/invitation/invitation' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '撤回失败，请重试', icon: 'none' });
    }
  },

  // 获得用户的openid
  get_openid() {
    const accountUserId = wx.getStorageSync('accountUserId');
    if (accountUserId) {
      db.collection('ActiveUser').doc(accountUserId).get({
        success: res => {
          if (!res.data) {
            return;
          }
          this.setData({
            user: res.data
          })
        }
      });
      return;
    }

    // 从数据库中根据openid得到该用户的信息
    db.collection('ActiveUser').where({ _openid: wx.getStorageSync('openid') }).get({
      success: res => {
        if (!res.data.length) {
          return;
        }
        console.log(1);
        var user2 = res.data[0];
        this.setData({
          user: user2
        })
      }
    });
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 传入了邀请对象的openid
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
  }
})