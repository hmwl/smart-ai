<template>
  <a-modal
    v-model:visible="internalVisible"
    title="登录"
    :footer="null"
    @cancel="handleCancel"
    :mask-closable="false"
  >
    <a-form
      ref="loginFormRef"
      :model="formState"
      layout="vertical"
      @submit="handleSubmit"
      class="login-form"
    >
      <a-form-item
        field="identifier"
        label="邮箱或用户名"
        :rules="[{ required: true, message: '请输入邮箱或用户名' }]"
      >
        <a-input v-model="formState.identifier" placeholder="请输入邮箱或用户名" />
      </a-form-item>
      <a-form-item
        field="password"
        label="密码"
        :rules="[{ required: true, message: '请输入密码' }]"
      >
        <a-input-password v-model="formState.password" placeholder="请输入密码" />
      </a-form-item>
      <a-form-item v-if="loginError">
        <a-alert type="error" :message="loginError" banner />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit" :loading="loading" long>
          登录
        </a-button>
      </a-form-item>
      <div class="text-center mt-2">
        <a-link @click="switchToRegister">没有账户？立即注册</a-link>
      </div>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import {
  Modal as AModal,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputPassword as AInputPassword,
  Button as AButton,
  Alert as AAlert,
  Link as ALink,
  Message
} from '@arco-design/web-vue';
import apiClient from '../services/apiService'; // Assuming client-side apiService

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:visible', 'loginSuccess', 'switchToRegister']);

const internalVisible = ref(false);
const loginFormRef = ref(null);
const formState = reactive({
  identifier: '',
  password: ''
});
const loading = ref(false);
const loginError = ref(null);

watch(() => props.visible, (newVal) => {
  internalVisible.value = newVal;
  if (newVal) {
    loginError.value = null; // Reset error when modal opens
    // formState.identifier = ''; // Optionally reset form
    // formState.password = '';
  }
});

const handleCancel = () => {
  emit('update:visible', false);
};

const handleSubmit = async () => {
  const validationResult = await loginFormRef.value.validate();
  if (validationResult) { // validationResult is an object of errors if any
    loginError.value = '请检查输入项。';
    return;
  }

  loading.value = true;
  loginError.value = null;
  try {
    const response = await apiClient.post('/auth/client/login', {
      username: formState.identifier,
      password: formState.password
    });

    if (response.data && response.data.token) {
      localStorage.setItem('clientAccessToken', response.data.token);
      if (response.data.user) {
        localStorage.setItem('clientUserInfo', JSON.stringify(response.data.user));
      }
      Message.success('登录成功！');
      emit('loginSuccess', response.data.user);
      emit('update:visible', false);
    } else {
      loginError.value = response.data?.message || '登录失败，未收到令牌。';
      Message.error(loginError.value);
    }
  } catch (error) {
    console.error("Login failed:", error);
    loginError.value = error.response?.data?.message || '登录失败，请检查您的凭据或网络连接。';
    Message.error(loginError.value);
  } finally {
    loading.value = false;
  }
};

const switchToRegister = () => {
  emit('update:visible', false); // Close login modal
  emit('switchToRegister'); // Signal to parent to open register modal
};

</script>

<style scoped>
.login-form {
  padding: 0 10px;
}
.mt-2 {
  margin-top: 0.5rem;
}
.text-center {
  text-align: center!important;
}
</style> 