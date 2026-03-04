const db = wx.cloud.database();

function isCloudFileId(path) {
  return typeof path === 'string' && path.startsWith('cloud://');
}

function getTempFileUrl(fileId) {
  if (!isCloudFileId(fileId)) {
    return Promise.resolve(fileId || '/icons/person.png');
  }

  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: [fileId],
      success: (res) => {
        const fileInfo = res.fileList && res.fileList[0];
        resolve((fileInfo && fileInfo.tempFileURL) || '/icons/person.png');
      },
      fail: () => resolve('/icons/person.png')
    });
  });
}

Page({
  data: {
    msg: '', // 填写邀请信息 想说的话
    openid: '', // 用户的openid
    hiddenmodalput: true, // 邀请框是否弹出
    dataobj: {}, // 邀请对象的数据信息
    user: {}, // 用户的数据信息
    time: '', // 用户邀请的时间
    hasInvited: false, // 是否发出了邀请
    done: false, // 页面和数据库是否加载完成了
    wordcount: 0 // 邀请信息的字数
  },
  searchinput(e) {
    this.setData({
      msg: e.detail.value,
      wordcount: e.detail.value.length
    })
  },
  // 点击邀请键
  invite() {
    var user = this.data.user;
    if (user.canedit == true) {
      this.setData({
        hiddenmodalput: false
      })
    }
    else {
      wx.showToast({
        title: "您被禁止权限",
        icon: 'error',
        mask: true
      })
    }
  },

  // 邀请框是否弹出
  modalcancel() {
    this.setData({
      hiddenmodalput: true
    })
  },
  async modalconfirm() {
    console.log(this.data.hasInvited);
    this.setData({
      hiddenmodalput: true
    });
    var hasInvited = this.data.hasInvited;
    var user = this.data.user;
    var dataobj = this.data.dataobj;
    var msg = this.data.msg;
    var userAccountUserId = this.data.user._id;
    var targetAccountUserId = this.data.dataobj._id;
    var targetNumericId = this.data.dataobj.numericId;
    const hasPartner = !!(user.partner && user.partner.hasPartner);
    if (user.free == false) {
      wx.showToast({
        title: "您不能邀请舞伴",
        icon: 'error',
        mask: true
      })
    }
    else {
      if (dataobj.free == false) {
        wx.showToast({
          title: "Ta不能接受邀请",
          icon: 'error',
          mask: true
        })
      }
      else {
        if (hasPartner) {
          wx.showToast({
            title: "您已经有舞伴了",
            icon: 'error',
            mask: true
          })
        }
        else if (hasInvited == true) {
          wx.showToast({
            title: "邀请过Ta了",
            icon: 'error',
            mask: true
          })
        }
        else if (user._id == targetAccountUserId) {
          wx.showToast({
            title: "别邀请自己哦",
            icon: 'error',
            mask: true
          })
        }
        else {
          if (!targetNumericId) {
            wx.showToast({
              title: '目标用户缺少数字ID',
              icon: 'none'
            });
            return;
          }

          wx.showLoading({ title: '发送中...' });
          try {
            const result = await wx.cloud.callFunction({
              name: 'send_partner_invitation',
              data: {
                currentAccountUserId: userAccountUserId,
                targetNumericId: targetNumericId,
                message: msg || ''
              }
            });
            wx.hideLoading();

            if (result.result && result.result.success) {
              this.setData({ hasInvited: true });
              wx.showToast({
                title: '邀请成功',
                icon: 'success',
                mask: true
              });
            } else {
              wx.showToast({
                title: (result.result && result.result.message) || '邀请失败',
                icon: 'none'
              });
            }
          } catch (error) {
            wx.hideLoading();
            wx.showToast({
              title: '邀请失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    }
  },

  // 获得用户的openid
  get_openid() {
    const openid = wx.getStorageSync('openid');
    const accountUserId = wx.getStorageSync('accountUserId');
    if (!accountUserId && !openid) {
      this.setData({ done: true });
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({
      done: false
    });
    const loadInvitationState = (currentUser) => {
      db.collection('Invitations').where({
        senderAccountUserId: currentUser._id,
        receiverAccountUserId: this.data.dataobj._id,
        status: 'pending'
      }).get({
        success: res => {
          this.setData({ hasInvited: res.data.length > 0, done: true });
        },
        fail: () => {
          this.setData({ done: true });
        }
      });
    };

    if (accountUserId) {
      db.collection('ActiveUser').doc(accountUserId).get({
        success: res => {
          if (!res.data) {
            this.setData({ done: true });
            wx.showToast({ title: '用户不存在', icon: 'none' });
            return;
          }
          this.setData({ user: res.data });
          loadInvitationState(res.data);
        },
        fail: () => {
          this.setData({ done: true });
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      });
      return;
    }

    db.collection('ActiveUser').where({ _openid: openid }).get({
      success: res => {
        if (!res.data.length) {
          this.setData({ done: true });
          wx.showToast({ title: '请先登录', icon: 'none' });
          return;
        }
        var user2 = res.data[0];
        this.setData({
          user: user2
        })
        loadInvitationState(user2);
      },
      fail: () => {
        this.setData({ done: true });
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if (!options.personid) {
      this.setData({ done: true });
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    console.log(options.personid)
    db.collection("ActiveUser").doc(options.personid).get({
      success: async (res) => {
        if (!res.data) {
          db.collection("ActiveUser").where({ _openid: options.personid }).get({
            success: async (legacyRes) => {
              if (!legacyRes.data.length) {
                this.setData({ done: true });
                wx.showToast({ title: '用户不存在', icon: 'none' });
                return;
              }
              var legacyObj = legacyRes.data[0];
              legacyObj.image = await getTempFileUrl(legacyObj.image);
              this.setData({ dataobj: legacyObj });
              this.get_openid();
            }
          })
          return;
        }
        var dataobj2 = res.data;
        dataobj2.image = await getTempFileUrl(dataobj2.image);
        this.setData({
          dataobj: dataobj2
        });
        this.get_openid();
      },
      fail: () => {
        db.collection("ActiveUser").where({ _openid: options.personid }).get({
          success: async (legacyRes) => {
            if (!legacyRes.data.length) {
              this.setData({ done: true });
              wx.showToast({ title: '用户不存在', icon: 'none' });
              return;
            }
            var legacyObj = legacyRes.data[0];
            legacyObj.image = await getTempFileUrl(legacyObj.image);
            this.setData({ dataobj: legacyObj });
            this.get_openid();
          }
        })
      }
    });
  },
})