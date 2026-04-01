// 会员支付页面
const { getCurrentUser } = require('../../utils/userFlow.js');

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
    currentUser: {},
    loading: true,
    showPaymentModal: false,
    paymentAmount: 130, // 基础支付金额
    paymentStatus: 'unpaid', // unpaid, processing, paid, activated
    orderNumber: '',
    userRecordId: '',
    puqProofFileId: '',
    puqProofPreview: '',
    uploadingProof: false
  },

  onLoad() {
    const canAccess = this.checkUserAccess();
    if (canAccess) {
      this.loadData();
    }
  },

  onShow() {
    const canAccess = this.checkUserAccess();
    if (canAccess) {
      this.loadData();
    }
  },

  // 检查用户访问权限
  checkUserAccess() {
    // 只检查登录状态
    const openid = wx.getStorageSync('openid');
    const accountUserId = wx.getStorageSync('accountUserId');
    if (!openid && !accountUserId) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  // 加载数据
  loadData() {
    this.setData({ loading: true });

    return getCurrentUser()
      .then((currentUser) => {
        if (!currentUser) {
          wx.showToast({
            title: '用户信息获取失败',
            icon: 'none'
          });
          this.setData({ loading: false });
          return Promise.reject('用户信息获取失败');
        }

        const reg = currentUser.registration || {};
        let paymentStatus = 'unpaid';
        if (reg.paymentStatus === 'activated' || reg.paymentStatus === 'paid') {
          paymentStatus = 'activated';
        } else if (reg.paymentStatus === 'processing') {
          paymentStatus = 'processing';
        }

        const puqProofFileId = reg.discountProof || '';
        const avatarPath = currentUser.avatar || currentUser.image || '';
        const avatarPromise = getTempFileUrl(avatarPath);
        const proofPromise = puqProofFileId ? getTempFileUrl(puqProofFileId) : Promise.resolve('');

        return Promise.all([avatarPromise, proofPromise]).then((urls) => {
          currentUser.avatar = urls[0];
          this.setData({
            currentUser: currentUser,
            paymentStatus: paymentStatus,
            puqProofFileId: puqProofFileId,
            puqProofPreview: urls[1] || '',
            loading: false
          });
        });
      })
      .catch((error) => {
        console.error('加载数据失败:', error);
        if (typeof error === 'string' && error.indexOf('未登录') !== -1) {
          wx.reLaunch({ url: '/pages/login/login' });
        }
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      });
  },

  // 显示支付二维码
  onShowPaymentQR() {
    // 生成订单号
    const orderNumber = 'DANCE_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    this.setData({
      showPaymentModal: true,
      orderNumber: orderNumber,
      puqProofFileId: '',
      puqProofPreview: ''
    });
  },

  // 关闭支付模态框
  onClosePaymentModal() {
    this.setData({
      showPaymentModal: false
    });
  },

  onChoosePuqProof() {
    if (this.data.uploadingProof) {
      return;
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths && res.tempFilePaths[0];
        if (!tempFilePath) {
          wx.showToast({ title: '未选择图片', icon: 'none' });
          return;
        }

        this.setData({
          uploadingProof: true,
          puqProofPreview: tempFilePath
        });

        wx.showLoading({ title: '上传截图中...' });

        const fileName = tempFilePath.split('/').pop() || 'puq_proof.jpg';
        const cloudPath = 'payment_proofs/puq_' + Date.now() + '_' + fileName;

        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
          success: (uploadRes) => {
            const fileId = uploadRes.fileID || '';
            if (!fileId) {
              this.setData({
                uploadingProof: false,
                puqProofFileId: '',
                puqProofPreview: ''
              });
              wx.hideLoading();
              wx.showToast({ title: '截图上传失败', icon: 'none' });
              return;
            }

            this.setData({
              puqProofFileId: fileId,
              uploadingProof: false
            });

            wx.hideLoading();
            wx.showToast({ title: '截图上传成功', icon: 'success' });
          },
          fail: (error) => {
            console.error('上传PUQ截图失败:', error);
            this.setData({
              uploadingProof: false,
              puqProofFileId: '',
              puqProofPreview: ''
            });
            wx.hideLoading();
            wx.showToast({ title: '截图上传失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        const msg = (err && err.errMsg) ? err.errMsg : '';
        if (msg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选择图片失败', icon: 'none' });
        }
      }
    });
  },

  // 提交支付信息
  onSubmitPayment() {
    

    if (this.data.uploadingProof) {
      wx.showToast({
        title: '截图上传中，请稍后',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '提交中...'
    });

    const db = wx.cloud.database();

    if (!this.data.currentUser || !this.data.currentUser._id) {
      wx.hideLoading();
      wx.showToast({ title: '用户信息缺失', icon: 'none' });
      return;
    }

    const activeUserUpdatePromise = db.collection('ActiveUser').doc(this.data.currentUser._id).update({
      data: {
        'registration.discountProof': this.data.puqProofFileId,
        'registration.discountStatus': 'pending',
        'registration.paymentStatus': 'processing',
        'registration.orderId': this.data.orderNumber,
        'registration.paymentTime': new Date()
      }
    });

    Promise.all([activeUserUpdatePromise])
      .then(() => {
        wx.hideLoading();

        wx.showModal({
          title: '提交成功',
          content: '支付信息和PUQ截图已提交，等待管理员手动核销。核销通过后将自动激活账号。',
          showCancel: false,
          confirmText: '知道了',
          success: () => {
            this.setData({
              showPaymentModal: false,
              paymentStatus: 'processing'
            });
            this.loadData();
          }
        });
      })
      .catch((error) => {
        wx.hideLoading();
        console.error('提交支付信息失败:', error);
        wx.showToast({
          title: '提交失败，请重试',
          icon: 'none'
        });
      });
  },

  // 查询支付状态
  onCheckPaymentStatus() {
    wx.showLoading({
      title: '查询中...'
    });

    this.loadData()
      .then(() => {
        wx.hideLoading();

        if (this.data.paymentStatus === 'activated') {
          wx.showToast({
            title: '账号已激活！',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: '仍在审核中，请耐心等待',
            icon: 'none'
          });
        }
      })
      .catch((error) => {
        wx.hideLoading();
        console.error('查询状态失败:', error);
        wx.showToast({
          title: '查询失败',
          icon: 'none'
        });
      });
  },

  navigateToHome() {
    wx.switchTab({
      url: '/pages/home/home'
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadData()
      .then(() => {
        wx.stopPullDownRefresh();
      })
      .catch(() => {
        wx.stopPullDownRefresh();
      });
  },

  // 格式化日期
  formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取支付状态文字
  getStatusText(status) {
    switch(status) {
      case 'unpaid': return '未支付';
      case 'processing': return '审核中';
      case 'activated': return '已激活';
      default: return '未知状态';
    }
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: '会员支付',
      path: '/pages/registration/registration'
    };
  }
});