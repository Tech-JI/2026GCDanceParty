// 云函数：搜索舞伴 <--本云函数因为前后不同届接续开发原因 出现了功能接口的差错 殷须后人修改--2026——>
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { searchId } = event;
    
    if (!searchId) {
      return {
        success: false,
        message: '请输入要搜索的数字ID'
      };
    }
    
    // 查找目标用户
    const targetUserResult = await db.collection('ActiveUser')
      .where({
        'numericId': searchId,
        'profile.completed': true,
        // 仅显式隐藏账号对普通用户不可见
        'visibility.hiddenFromUsers': _.neq(true)
      })
      .get();
    
    if (targetUserResult.data.length === 0) {
      return {
        success: false,
        message: '未找到该用户或用户资料未完善'
      };
    }
    
    const targetUser = targetUserResult.data[0];

    if (targetUser.visibility && targetUser.visibility.hiddenFromUsers) {
      return {
        success: false,
        message: '未找到该用户'
      };
    }
    
    // 检查隐私设置
    if (!targetUser.privacy.allowSearch) {
      return {
        success: false,
        message: '该用户设置为不允许被搜索'
      };
    }
    
    // 检查是否已有舞伴
    if (targetUser.partner.hasPartner) {
      return {
        success: false,
        message: '该用户已有舞伴',
        userInfo: {
          name: targetUser.name,
          numericId: targetUser.numericId,
          hasPartner: true
        }
      };
    }
    
    // 构建返回信息
    const userInfo = {
      _id: targetUser._id,
      name: targetUser.name,
      numericId: targetUser.numericId,
      hasPartner: false,
      profile: {
        school: targetUser.school,
        major: targetUser.major,
        grade: targetUser.grade,
        experience: targetUser.experience
      }
    };
    
    // 根据隐私设置决定返回哪些信息
    if (targetUser.privacy.showSchool) {
      userInfo.profile.school = targetUser.school;
    } else {
      userInfo.profile.school = '隐藏';
    }
    
    if (targetUser.privacy.showMajor) {
      userInfo.profile.major = targetUser.major;
    } else {
      userInfo.profile.major = '隐藏';
    }
    
    if (targetUser.privacy.showGrade) {
      userInfo.profile.grade = targetUser.grade;
    } else {
      userInfo.profile.grade = '隐藏';
    }
    
    if (targetUser.privacy.showExperience) {
      userInfo.profile.experience = targetUser.experience;
    } else {
      userInfo.profile.experience = '隐藏';
    }
    
    if (targetUser.image) {
      userInfo.image = targetUser.image;
    }
    
    if (targetUser.privacy.showSignature && targetUser.signature) {
      userInfo.signature = targetUser.signature;
    }
    
    return {
      success: true,
      message: '找到用户',
      userInfo: userInfo,
      canInvite: !targetUser.partner.hasPartner && targetUser.privacy.allowInvitation
    };
    
  } catch (error) {
    console.error('搜索失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};