const db = wx.cloud.database(); 

Page({
  data: {
    openid: '', 
    dataobj: {}, 
    done: false, 
    messagelove: '', 
    lovelength: 0, 
    nicknamelength: 0,
    messagelength: 0, 
    messagemsg: '', 
    messagenickname: '',
    avatarUrl: "",
    upload_file: false,
    selfieUrl: "",
    upload_selfie: false,
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
  onChooseSelfie() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          selfieUrl: res.tempFiles[0].tempFilePath,
          upload_selfie: true
        });
      }
    });
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

  inputnickname(e) {
    var msg = e.detail.value;
    this.setData({ nicknamelength: msg.length });
    if (msg.length <= 30) {
      this.setData({ messagenickname: msg });
    }
  },

  inputlove(e) {
    var msg = e.detail.value;
    this.setData({ lovelength: msg.length });
    if (msg.length <= 30) {
      this.setData({ messagelove: msg });
    }
  },

  textcheck(e) {
    var msg = e.detail.value;
    this.setData({ messagelength: msg.length });
    if (msg.length <= 400) {
      this.setData({ messagemsg: msg })
    }
  },

  async btnSub(e) {
    wx.showLoading({ title: '保存中' });
    const openid = wx.getStorageSync('openid');
    const accountUserId = wx.getStorageSync('accountUserId');
    const updateCurrentUser = (data) => {
      if (accountUserId) {
        return db.collection('ActiveUser').doc(accountUserId).update({ data });
      }
      return db.collection('ActiveUser').where({ _openid: openid }).update({ data });
    };

    var newgrade = e.detail.value.editgrade;
    var newlove = this.data.messagelove;
    var newmessage = this.data.messagemsg;
    var newnickname = this.data.messagenickname;
    
    let updateData = {
      grade: newgrade,
      love: newlove,
      message: newmessage,
      nickname: newnickname,
      school: this.data.messageschool,
      gender: this.data.selectedGender,
    };

    try {
      if (this.data.upload_file) {
        const res = await wx.cloud.uploadFile({
          cloudPath: 'avatars/' + (openid || accountUserId || Date.now()) + '_' + Date.now() + '.jpg',
          filePath: this.data.avatarUrl
        });
        updateData.image = res.fileID;
      }
      
      if (this.data.upload_selfie) {
        const res = await wx.cloud.uploadFile({
          cloudPath: 'selfies/' + (openid || accountUserId || Date.now()) + '_' + Date.now() + '.jpg',
          filePath: this.data.selfieUrl
        });
        updateData.selfieImage = res.fileID;
      }

      await updateCurrentUser(updateData);
      wx.hideLoading();
      wx.switchTab({ url: '../mine/mine' });

    } catch(err) {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'error' });
    }
  },

  get_openid() {
    const accountUserId = wx.getStorageSync('accountUserId');
    this.setData({ done: false });
    const onLoadCurrentUser = (userRecord) => {
      const genderOptions = ['男', '女'];
      const genderIndex = genderOptions.indexOf(userRecord.gender || '');       
      this.setData({
        dataobj: userRecord,
        avatarUrl: userRecord.image,
        selfieUrl: userRecord.selfieImage || '',
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
          if (!res.data) return;
          onLoadCurrentUser(res.data);
        }
      });
      return;
    }

    db.collection("ActiveUser").where({ _openid: wx.getStorageSync('openid') }).get({
      success: res => {
        if (!res.data.length) return;
        onLoadCurrentUser(res.data[0]);
      }
    });

  },
  
  onLoad: function (options) {
    this.get_openid();
  },
})
