<template>
  <a-modal
    :visible="visible"
    title="账户信息"
    :footer="false"
    :mask-closable="false"
    :closable="true"
    @cancel="handleCancel"
    width="600px"
  >
    <a-spin :spinning="loading" tip="加载中..." style="width: 100%;">
      <div v-if="error" class="error-message">
        <a-alert type="error" :message="error" banner />
      </div>
      <div v-else-if="userData" class="user-details-container">
        <!-- View Mode: Descriptions -->
        <a-descriptions
          v-if="!isEditMode"
          bordered
          class="mb-6"
        >
          <a-descriptions-item label="用户名">{{ userData.username }}</a-descriptions-item>
          <a-descriptions-item :span="2" label="邮箱">{{ userData.email || '未设置' }}</a-descriptions-item>
          <a-descriptions-item label="昵称">{{ userData.nickname || '未设置' }}</a-descriptions-item>
          <a-descriptions-item label="账户状态">
            <a-tag :color="userData.status === 'active' ? 'green' : 'red'">{{ userData.status === 'active' ? '正常' : '禁用' }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :span="2" label="账户积分"><a-statistic :value="userData.creditsBalance" :precision="0" /></a-descriptions-item>
          <a-descriptions-item :span="2" label="注册时间">{{ formatDateCN(userData.createdAt) }}</a-descriptions-item>
        </a-descriptions>

        <!-- Edit Mode: Forms -->
        <div v-if="isEditMode" class="edit-mode-forms">
          <a-divider orientation="left">修改昵称</a-divider>
          <div class="form-section nickname-edit-section">
            <a-form :model="editData" layout="vertical" ref="nicknameFormRef">
              <a-form-item field="nickname" label="新昵称" :rules="[{ maxLength: 50, message: '昵称长度不能超过50个字符'}]">
                <a-input v-model="editData.nickname" placeholder="输入新昵称 (留空则清除)" allow-clear />
              </a-form-item>
            </a-form>
          </div>

          <a-divider orientation="left">修改密码</a-divider>
          <div class="form-section password-change-section">
            <a-form :model="editData.passwordFields" layout="vertical" ref="passwordFormRef">
              <a-form-item field="currentPassword" label="当前密码" :rules="[{ required: true, message: '当前密码不能为空' }]">
                <a-input-password v-model="editData.passwordFields.currentPassword" placeholder="输入当前密码" allow-clear />
              </a-form-item>
              <a-form-item field="newPassword" label="新密码" :rules="[{ required: true, message: '新密码不能为空' }, { minLength: 6, message: '新密码长度至少6位' }]">
                <a-input-password v-model="editData.passwordFields.newPassword" placeholder="输入新密码 (至少6位)" allow-clear />
              </a-form-item>
              <a-form-item field="confirmPassword" label="确认新密码" :rules="[{ required: true, message: '确认密码不能为空' }, { validator: validateConfirmPassword }]">
                <a-input-password v-model="editData.passwordFields.confirmPassword" placeholder="再次输入新密码" allow-clear />
              </a-form-item>
            </a-form>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <a-space v-if="!isEditMode">
            <a-button type="primary" @click="toggleEditMode(true)">编辑信息</a-button>
          </a-space>
          <div v-else>
            <a-button type="primary" @click="saveAllChanges" :loading="savingAll" style="margin-right: 10px;">保存更改</a-button>
            <a-button @click="cancelEditMode" style="margin-right: 10px;">取消</a-button>
          </div>
        </div>
      </div>
      <a-empty v-else-if="!loading" description="无法加载用户信息" />
    </a-spin>
  </a-modal>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import apiClient from '../services/apiService';
import {
  Alert as AAlert,
  Button as AButton,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Divider as ADivider,
  Empty as AEmpty,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputPassword as AInputPassword,
  InputNumber as AInputNumber,
  Modal as AModal,
  Spin as ASpin,
  Statistic as AStatistic,
  Tag as ATag,
  Message,
  RadioGroup as ARadioGroup,
  Radio as ARadio,
  Space as ASpace
} from '@arco-design/web-vue';
import { formatDateCN } from '@/client/utils/date';

// 定义 props 和 emits
const props = defineProps({
  // 通过 visible 控制显示/隐藏
  visible: {
    type: Boolean,
    default: false
  },
  // 可以直接传入用户数据
  userData: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:visible', 'update:userData']);

// 本地状态
const loading = ref(false);
const error = ref(null);
const isEditMode = ref(false);
const savingAll = ref(false);

// 编辑数据
const editData = reactive({
  nickname: '',
  passwordFields: {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }
});

// 表单引用
const nicknameFormRef = ref(null);
const passwordFormRef = ref(null);

// 初始编辑数据，用于取消时恢复
let initialEditData = {};

// 验证确认密码
const validateConfirmPassword = (value, cb) => {
  if (value !== editData.passwordFields.newPassword) {
    return cb('两次输入的密码不一致');
  }
  cb();
};

// 初始化编辑数据
const initEditData = (data) => {
  if (!data) return;

  editData.nickname = data.nickname || '';
  editData.passwordFields = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  // 保存初始数据，用于取消时恢复
  initialEditData = JSON.parse(JSON.stringify(editData));
};

// 获取用户数据
const fetchUserData = async () => {
  // 如果已经有用户数据，则不需要重新获取
  if (props.userData) {
    initEditData(props.userData);
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get('/auth/me');
    emit('update:userData', response.data);
    initEditData(response.data);
  } catch (err) {
    console.error("Failed to fetch user data:", err);
    error.value = err.response?.data?.message || '获取用户信息失败，请稍后再试。';
  } finally {
    loading.value = false;
  }
};


// 切换编辑模式
const toggleEditMode = (edit) => {
  isEditMode.value = edit;
  if (edit) {
    // 进入编辑模式时，同步编辑数据
    if (props.userData) {
      editData.nickname = props.userData.nickname || '';
    }
    editData.passwordFields = { currentPassword: '', newPassword: '', confirmPassword: '' };
    initialEditData = JSON.parse(JSON.stringify(editData));
  } else {
    // 可选：重置表单
    nicknameFormRef.value?.clearValidate();
    passwordFormRef.value?.resetFields();
    passwordFormRef.value?.clearValidate();
  }
};

// 取消编辑模式
const cancelEditMode = () => {
  // 恢复初始数据
  Object.assign(editData, initialEditData);
  toggleEditMode(false);
};

// 保存所有更改
const saveAllChanges = async () => {
  savingAll.value = true;

  // 检查token是否存在
  const token = localStorage.getItem('clientAccessToken');
  if (!token) {
    Message.error('您尚未登录或登录已过期，请重新登录');
    return;
  }

  try {
    // 保存昵称
    if (editData.nickname !== initialEditData.nickname) {
      await apiClient.patch('/auth/me', { nickname: editData.nickname });
      if (props.userData) {
        const updatedUserData = { ...props.userData, nickname: editData.nickname };
        emit('update:userData', updatedUserData);
      }
      Message.success('昵称更新成功');
    }

    // 修改密码
    const { currentPassword, newPassword, confirmPassword } = editData.passwordFields;
    if (currentPassword && newPassword && confirmPassword) {
      // 验证确认密码
      if (newPassword !== confirmPassword) {
        Message.error('两次输入的密码不一致');
        return;
      }


      // 手动添加认证头
      await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clientAccessToken')}`
        }
      });

      Message.success('密码修改成功');
      // 清空密码字段
      editData.passwordFields = { currentPassword: '', newPassword: '', confirmPassword: '' };
    }

    // 退出编辑模式
    toggleEditMode(false);
  } catch (err) {
    console.error("Failed to save changes:", err);
    Message.error(err.response?.data?.message || '保存失败，请稍后再试');
  } finally {
    savingAll.value = false;
  }
};

// 监听 visible 属性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    fetchUserData();
  }
});

// 组件挂载时的初始化
onMounted(() => {
  if (props.visible) {
    fetchUserData();
  }
});

// 处理弹窗取消
const handleCancel = () => {
  emit('update:visible', false);
  // 如果在编辑模式，退出编辑模式
  if (isEditMode.value) {
    cancelEditMode();
  }
};
</script>

<style scoped>

.action-buttons {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

.error-message {
  margin-bottom: 16px;
}

.promotion-item {
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 4px;
  background-color: rgba(var(--primary-6), 0.1);
}

.exchange-rate-info {
  padding: 8px;
  border-radius: 4px;
  background-color: rgba(var(--success-6), 0.1);
}

/* 暗色模式适配 */
:deep(.arco-descriptions-title) {
  color: var(--color-text-1);
}

:deep(.arco-descriptions-item-label),
:deep(.arco-descriptions-item-value) {
  color: var(--color-text-2);
}

:deep(.arco-form-item-label > label) {
  color: var(--color-text-1);
}

.mb-4 {
  margin-bottom: 16px;
}

.mb-6 {
  margin-bottom: 24px;
}

.text-sm {
  font-size: 0.875rem;
}

.text-gray-500 {
  color: var(--color-text-3);
}
</style>