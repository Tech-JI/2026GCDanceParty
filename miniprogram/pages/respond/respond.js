// 从信箱页面点入邀请函看到的具体的邀请信息
const db = wx.cloud.database();
const _ = db.command;

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
    openid: '', // 用户的openid
    hiddenmodalput: true, // 弹窗是否显示
    dataobj: {}, // 邀请者的数据信息
    user: {}, // 用户的数据信息
    invitations: {}, // 邀请函
    done: false, // 页面数据库是否加载完成
    taid: '', // 邀请者的openid
  },

  hasPartner(user = {}) {
    if (!user || typeof user !== 'object') {
      return false;
    }
    if (user.partner && typeof user.partner === 'object') {
      return !!user.partner.hasPartner;
    }
    return !!user.hasPartner;
  },

  // 接受舞伴
  accept() {
    this.setData({
      hiddenmodalput: false
    })
  },

  // 窗口的弹出
  modalcancel() {
    this.setData({
      hiddenmodalput: true
    })
  },

  // 接受邀请，走新链路 reply_invitation
  async acceptInvitation() {
    const currentInvitation = this.data.invitations || {};
    if (!currentInvitation._id && !currentInvitation.invitationId) {
      wx.showToast({
        title: '邀请不存在或已处理',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '处理中...' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'reply_invitation',
        data: {
          currentAccountUserId: wx.getStorageSync('accountUserId') || '',
          invitationId: currentInvitation.invitationId || '',
          invitationDocId: currentInvitation._id || '',
          action: 'accept',
          reply: '接受了您的邀请'
        }
      });

      wx.hideLoading();

      if (result.result && result.result.success) {
        wx.showModal({
          title: '配对成功',
          content: '已成为舞伴，可在“我的”页面查看',
          showCancel: false,
          success: () => {
            wx.switchTab({
              url: '/pages/mine/mine'
            });
          }
        });
        return;
      }

      wx.showToast({
        title: (result.result && result.result.message) || '处理失败',
        icon: 'none'
      });
      this.get_openid();
    } catch (error) {
      wx.hideLoading();
      console.error('接受邀请失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 点击接受舞伴
  modalconfirm() {
    var dataobj = this.data.dataobj;
    var user = this.data.user;
    this.setData({
      hiddenmodalput: true
    });
    if (user.free == false) {
      wx.showToast({
        title: "您不能接受邀请",
        icon: 'error',
        mask: true
      })
    }
    else {
      if (dataobj.free == false) {
        wx.showToast({
          title: "Ta不能拥有舞伴",
          icon: 'error',
          mask: true
        })
      }
      else {
        const currentUserHasPartner = this.hasPartner(user);
        const senderHasPartner = this.hasPartner(dataobj);

        if (!currentUserHasPartner) {
          if (!senderHasPartner) {
            console.log(this.data.user)
            console.log(this.data.dataobj)
            this.acceptInvitation()
          }
          else {
            wx.showToast({
              title: "Ta已经有舞伴了",
              icon: 'error',
              mask: true
            })
          }
        }
        else {
          wx.showToast({
            title: "您已经有舞伴了",
            icon: 'error',
            mask: true
          })
        }
      }
    }
  },

  // 获得用户的openid
  get_openid() {
    const openid = wx.getStorageSync('openid');
    const accountUserId = wx.getStorageSync('accountUserId');
    this.setData({
      hasPartner: false,
      done: false,
    });
    const loadInvitation = (currentUser) => {
      db.collection('Invitations').where({
        senderAccountUserId: this.data.dataobj._id,
        receiverAccountUserId: currentUser._id,
        status: 'pending'
      }).orderBy('sentTime', 'desc').get({
        success: res2 => {
          if (res2.data.length) {
            this.setData({ invitations: res2.data[0], done: true });
            console.log(res2.data[0])
            return;
          }
          db.collection('Invitations').where({
            senderid: this.data.dataobj._openid,
            receiverid: currentUser._openid,
            status: 'pending'
          }).orderBy('sentTime', 'desc').get({
            success: legacyRes => {
              if (!legacyRes.data.length) {
                this.setData({ invitations: {}, done: true });
                wx.showToast({
                  title: '该邀请已处理',
                  icon: 'none'
                });
                return;
              }
              this.setData({ invitations: legacyRes.data[0], done: true });
              console.log(legacyRes.data[0])
            }
          })
        },
        fail: () => {
          this.setData({ invitations: {}, done: true });
        }
      })
    };

    if (accountUserId) {
      db.collection('ActiveUser').doc(accountUserId).get({
        success: res3 => {
          if (!res3.data) {
            return;
          }
          this.setData({ user: res3.data });
          loadInvitation(res3.data);
        }
      });
      return;
    }

    db.collection('ActiveUser').where({ _openid: openid }).get({
      success: res3 => {
        if (!res3.data.length) {
          return;
        }
        var user2 = res3.data[0];
        this.setData({
          user: user2
        });
        loadInvitation(user2);
      }
    });
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.setData({
      taid: options.personid
    });
    db.collection("ActiveUser").doc(options.personid).get({
      success: async (res3) => {
        if (!res3.data) {
          db.collection("ActiveUser").where({ _openid: options.personid }).get({
            success: async (legacyRes) => {
              if (!legacyRes.data.length) {
                return;
              }
              var legacyObj = legacyRes.data[0];
              legacyObj.image = await getTempFileUrl(legacyObj.image);
              this.setData({ dataobj: legacyObj });
            }
          })
          return;
        }
        var dataobj2 = res3.data;
        dataobj2.image = await getTempFileUrl(dataobj2.image);
        this.setData({
          dataobj: dataobj2
        });
      },
      fail: () => {
        db.collection("ActiveUser").where({ _openid: options.personid }).get({
          success: async (legacyRes) => {
            if (!legacyRes.data.length) {
              return;
            }
            var legacyObj = legacyRes.data[0];
            legacyObj.image = await getTempFileUrl(legacyObj.image);
            this.setData({ dataobj: legacyObj });
          }
        })
      }
    });
    this.get_openid();
  },

})