// 邀请页面
const db = wx.cloud.database();
const _ = db.command;
const userFlow = require("../../utils/userFlow"); // 用户流程控制

function isCloudFileId(path) {
  return typeof path === 'string' && path.startsWith('cloud://');
}

function getTempFileUrlMap(fileIds = []) {
  const uniqueFileIds = [...new Set(fileIds.filter((fileId) => isCloudFileId(fileId)))];
  if (!uniqueFileIds.length) {
    return Promise.resolve({});
  }

  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: uniqueFileIds,
      success: (res) => {
        const urlMap = {};
        (res.fileList || []).forEach((item) => {
          if (item && item.fileID && item.tempFileURL) {
            urlMap[item.fileID] = item.tempFileURL;
          }
        });
        resolve(urlMap);
      },
      fail: () => resolve({})
    });
  });
}

Page({
  data: {
    openid: '',
    invitation: [],
    dataobj: [{
      Invitation: {},
      Receiver: {}
    }],
    number: 0,
    tempobj: {},
    done: false
  },
  get_openid() {
    this.setData({
      tempobj: {},
      number: 0,
      done: false
    })

    const accountUserId = wx.getStorageSync('accountUserId');
    const loadInvitations = (currentUser) => {
      wx.cloud.callFunction({
        name: 'invite_invitation',
        data: {
          senderAccountUserId: currentUser._id,
          senderid: currentUser._openid
        }
      })
        .then(resfindinvitation => {
          console.log(resfindinvitation.result.data);
          this.setData({
            length: resfindinvitation.result.data.length,
            tempobj: resfindinvitation.result.data
          });
          this.process();
        })
        .catch(console.error)
    };

    if (accountUserId) {
      db.collection('ActiveUser').doc(accountUserId).get({
        success: (resDoc) => {
          if (!resDoc.data) {
            return;
          }
          loadInvitations(resDoc.data);
        }
      });
      return;
    }

    db.collection('ActiveUser').where({ _openid: wx.getStorageSync('openid') }).get({
      success: (resLegacy) => {
        if (!resLegacy.data.length) {
          return;
        }
        loadInvitations(resLegacy.data[0]);
      }
    })
  },



  process() {
    var invitations = this.data.tempobj;
    console.log(invitations);
    var receiverids = [];
    var dataobj = [];
    for (var i = 0; i < invitations.length; i++) {
      receiverids[i] = invitations[i].receiverAccountUserId
        ? { _id: invitations[i].receiverAccountUserId }
        : { _openid: invitations[i].receiverid }
    }
    console.log(receiverids);
    console.log(invitations);
    if (receiverids.length != 0) {
      db.collection("ActiveUser").where(_.or(receiverids)).get({
        success: async (res) => {
          console.log(res.data);
          var receivers = res.data;
          const receiverImageIds = receivers.map((receiver) => receiver.image).filter((image) => isCloudFileId(image));
          const imageUrlMap = await getTempFileUrlMap(receiverImageIds);
          for (var j = 0; j < receivers.length; j++) {
            for (var k = 0; k < receivers.length; k++) {
              const receiverMatched = receiverids[j]._id
                ? (receiverids[j]._id == receivers[k]._id)
                : (receiverids[j]._openid == receivers[k]._openid);
              if (receiverMatched) {
                const normalizedReceiver = {
                  ...receivers[k],
                  image: isCloudFileId(receivers[k].image)
                    ? (imageUrlMap[receivers[k].image] || '/icons/person.png')
                    : (receivers[k].image || '/icons/person.png')
                };
                dataobj[j] = {
                  Invitation: invitations[j],
                  Receiver: normalizedReceiver
                };
                break;
              }
            }
          }
          console.log(dataobj);
          this.setData({
            dataobj: dataobj.reverse(),
            done: true,
            number: res.data.length
          });
        }
      })
    }
    else {
      this.setData({
        done: true,
        number: 0
      })
    }
  },
  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    wx.redirectTo({
      url: '/pages/invitation/invitation'
    });
  },
})