// edit页面时点入个人界面后点击编辑个人信息跳出的页面
const db = wx.cloud.database(); // 获得数据库

Page({
  data: {
    openid: '', // 用户的openid
    dataobj: {}, // 用户自己的数据 record
    done: false, // 页面 数据库 是否加载完成的bool
    messagelove: '', // 用户填写的 “我喜欢的” 的字符串
    lovelength: 0, // messagelove的字数，用于设置字数限制
    nicknamelength: 0,
    messagelength: 0, // 用户填写的 “个性名片” 的字数限制
    messagemsg: '', // 用户填写的 “个性名片” 的字符串
    messagenickname: '',
    avatarUrl: "",
    upload_file: false,
    messageschool: '',
    genderOptions: ['男', '女'],
    genderIndex: -1,
    selectedGender: ''
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      avatar_submit: true,
      user_avatar: avatarUrl,
      avatarUrl: avatarUrl,
      upload_file: true
    })
  },
  inputschool(e) {
    this.setData({ messageschool: e.detail.value });
  },

  inputgender(e) {
    const index = Number(e.detail.value);
    this.setData({
      genderIndex: index,
      selectedGender: this.data.genderOptions[index]
    });
  },

  selectGender(e) {
    const val = e.currentTarget.dataset.value;
    this.setData({
      selectedGender: val,
      genderIndex: val === '男' ? 0 : 1
    });
  },

  choosegender() {
    wx.showActionSheet({
      itemList: ['男', '女'],
      success: (res) => {
        const options = ['男', '女'];
        this.setData({
          genderIndex: res.tapIndex,
          selectedGender: options[res.tapIndex]
        });
      }
    });
  },

  // 输入框触发的函数 用于储存用户输入内容的函数
  inputnickname(e) {
    var msg = e.detail.value;
    this.setData({
      nicknamelength: msg.length
    });
    if (msg.length <= 30) {
      this.setData({
        messagenickname: msg,
      });
    }
  },

  // 输入框触发的函数 用于储存用户输入内容的函数
  inputlove(e) {
    var msg = e.detail.value;
    this.setData({
      lovelength: msg.length
    });
    if (msg.length <= 30) {
      this.setData({
        messagelove: msg,
      });
    }
  },
  textcheck(e) {
    var msg = e.detail.value;
    this.setData({
      messagelength: msg.length
    });
    if (msg.length <= 400) {
      this.setData({
        messagemsg: msg
      })
    }
  },

  // 提交按钮，确认编辑的内容
  btnSub(e) {
    const openid = wx.getStorageSync('openid');
    const accountUserId = wx.getStorageSync('accountUserId');
    const updateCurrentUser = (data) => {
      if (accountUserId) {
        return db.collection('ActiveUser').doc(accountUserId).update({ data });
      }
      return db.collection('ActiveUser').where({ _openid: openid }).update({ data });
    };

    if (this.data.upload_file) {
      wx.cloud.uploadFile({
        cloudPath: (openid || accountUserId || Date.now()) + ".jpg",
        filePath: this.data.avatarUrl, // 文件路径
        success: res => {
          this.setData({
            user_avatar: res.fileID,
            avatarUrl: res.fileID
          })
          console.log(e);
          var newgrade = e.detail.value.editgrade;
          var newlove = this.data.messagelove;
          var newmessage = this.data.messagemsg;
          var newnickname = this.data.messagenickname;
          console.log(newmessage);
          updateCurrentUser({
            grade: newgrade,
            love: newlove,
            message: newmessage,
            nickname: newnickname,
            school: this.data.messageschool,
            gender: this.data.selectedGender,
            image: res.fileID
          }).then((res) => {
            console.log(res)
          })
          wx.switchTab({
            url: '../mine/mine',
          })
        }
      })
    }
    else {
      var newgrade = e.detail.value.editgrade;
      var newlove = this.data.messagelove;
      var newmessage = this.data.messagemsg;
      var newnickname = this.data.messagenickname;
      console.log(newmessage);
      updateCurrentUser({
        grade: newgrade,
        love: newlove,
        message: newmessage,
        nickname: newnickname,
        school: this.data.messageschool,
        gender: this.data.selectedGender,
      }).then((res) => {
        console.log('✅ 用户信息更新成功:', res);
      })
      wx.switchTab({
        url: '../mine/mine',
      })
    }
  },
  /**
   * 生命周期函数--监听页面加载
   */

  // 获得用户的openid
  get_openid() {
    const accountUserId = wx.getStorageSync('accountUserId');
    this.setData({
      done: false
    });
    const onLoadCurrentUser = (userRecord) => {
      const genderOptions = ['男', '女'];
      const genderIndex = genderOptions.indexOf(userRecord.gender || '');
      this.setData({
        dataobj: userRecord,
        avatarUrl: userRecord.image,
        done: true,
        lovelength: (userRecord.love || '').length,
        messagelove: userRecord.love || '',
        messagemsg: userRecord.message || '',
        messagenickname: userRecord.nickname || '',
        messageschool: userRecord.school || '',
        genderIndex: genderIndex,
        selectedGender: userRecord.gender || ''
      });
    };

    if (accountUserId) {
      db.collection("ActiveUser").doc(accountUserId).get({
        success: res => {
          if (!res.data) {
            return;
          }
          onLoadCurrentUser(res.data);
        }
      });
      return;
    }

    // 从数据库中找到用户的信息
    db.collection("ActiveUser").where({ _openid: wx.getStorageSync('openid') }).get({
      success: res => {
        if (!res.data.length) {
          return;
        }
        onLoadCurrentUser(res.data[0]);
      }
    });

  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.get_openid();
  },
})