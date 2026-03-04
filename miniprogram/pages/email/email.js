// 这个页面是点击信箱进入的页面，可以看到用户收到的邀请
const db = wx.cloud.database(); // 获得数据库 
const _ = db.command; // 数据库的一个命令
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
    openid: '', // 用户的openid
    number: 0, // 收到的邀请的数量
    dataobj: [],// 每个加工后邀请的信息
    tempobj: [], // 所有发给自己的邀请
    done: false, // 页面和数据库是否已经加载完成
  },

  // 获得用户的openid
  get_openid() {
    this.setData({
      number: 0,
      datatemp: [],
      dataobj: []
    });

    this.setData({
      done: false,
      number: 0,
    });

    const accountUserId = wx.getStorageSync('accountUserId');
    const loadInvitations = (currentUser) => {
      wx.cloud.callFunction({
        name: 'email_invitation',
        data: {
          receiverAccountUserId: currentUser._id,
          receiverid: currentUser._openid
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

  // 加工每个邀请的信息
  process() {
    var invitations = this.data.tempobj;
    console.log(invitations);
    var acceptids = [];
    var dataobj = [];
    for (var i = 0; i < invitations.length; i++) {
      acceptids[i] = invitations[i].senderAccountUserId
        ? { _id: invitations[i].senderAccountUserId }
        : { _openid: invitations[i].senderid }
    }
    console.log(acceptids);
    console.log(invitations);
    if (acceptids.length != 0) {
      db.collection("ActiveUser").where(_.or(acceptids)).get({
        success: async (res) => {
          console.log(res.data);
          var senders = res.data;
          const senderImageIds = senders.map((sender) => sender.image).filter((image) => isCloudFileId(image));
          const imageUrlMap = await getTempFileUrlMap(senderImageIds);
          for (var j = 0; j < senders.length; j++) {
            for (var k = 0; k < senders.length; k++) {
              const senderMatched = acceptids[j]._id
                ? (acceptids[j]._id == senders[k]._id)
                : (acceptids[j]._openid == senders[k]._openid);
              if (senderMatched) {
                const normalizedSender = {
                  ...senders[k],
                  image: isCloudFileId(senders[k].image)
                    ? (imageUrlMap[senders[k].image] || '/icons/person.png')
                    : (senders[k].image || '/icons/person.png')
                };
                dataobj[j] = {
                  Invitation: invitations[j],
                  Sender: normalizedSender
                };
                break;
              }
            }
          }
          console.log(dataobj);
          console.log(100);
          this.setData({
            dataobj: dataobj.reverse(),
            done: true,
            number: res.data.length
          });
        }
      })
    }
    else {
      console.log(200);
      this.setData({
        done: true,
        number: 0
      })
    }
  },
  // 在显示该页面时先调用
  onShow: function () {
    wx.redirectTo({
      url: '/pages/invitation/invitation'
    });
  },
})