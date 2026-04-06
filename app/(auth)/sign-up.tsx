// 앱 화면/라우팅 로직: app/(auth)/sign-up.tsx
import { ReactNode, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../../src/services/auth.service';

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignUp = async () => {
    if (isLoading) return;

    const trimmedName = displayName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setErrorMessage('');

    if (!trimmedName || !normalizedEmail || !password.trim()) {
      setErrorMessage('모든 항목을 입력해주세요.');
      return;
    }
    if (!emailRegex.test(normalizedEmail)) {
      setErrorMessage('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    if (password !== confirmPw) {
      setErrorMessage('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.signUpWithEmail(normalizedEmail, password, trimmedName);
      const needsEmailVerification = !data.session;

      if (needsEmailVerification) {
        router.replace({
          pathname: '/(auth)/sign-in',
          params: {
            signup: 'pending_verification',
            email: normalizedEmail,
          },
        });
        return;
      }

      Alert.alert(
        '회원가입 완료',
        '회원가입이 완료되어 바로 로그인되었습니다.',
        [{ text: '확인', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (e: any) {
      const message = e?.message ?? '회원가입에 실패했습니다.';
      setErrorMessage(message);
      Alert.alert('회원가입 실패', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="always"
        >
          <View className="flex-1 px-6 pt-8">
            <TouchableOpacity
              className="mb-8 w-10 h-10 items-center justify-center"
              onPress={() => router.back()}
            >
              <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
            </TouchableOpacity>

            <Text className="text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-2">
              회원가입
            </Text>
            <Text className="text-text-secondary dark:text-text-dark-secondary mb-8">
              Routinee와 함께 시작하세요
            </Text>

            <View className="gap-y-4 mb-6">
              <FormField
                label="이름"
                placeholder="이름을 입력하세요"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
              <FormField
                label="이메일"
                placeholder="이메일을 입력하세요"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <FormField
                label="비밀번호"
                placeholder="8자 이상 입력하세요"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                rightAccessory={(
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
                  >
                    <Text className="text-lg text-text-secondary dark:text-text-dark-secondary">
                      {showPassword ? '🙈' : '👁'}
                    </Text>
                  </TouchableOpacity>
                )}
              />
              <FormField
                label="비밀번호 확인"
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPw}
                onChangeText={setConfirmPw}
                secureTextEntry={!showConfirmPw}
                rightAccessory={(
                  <TouchableOpacity
                    onPress={() => setShowConfirmPw((prev) => !prev)}
                    hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
                  >
                    <Text className="text-lg text-text-secondary dark:text-text-dark-secondary">
                      {showConfirmPw ? '🙈' : '👁'}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            <TouchableOpacity
              className={`py-4 rounded-2xl items-center mb-6 ${isLoading ? 'bg-primary/60' : 'bg-primary'}`}
              onPress={handleSignUp}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text className="text-white text-base font-semibold">
                {isLoading ? '가입 중...' : '회원가입'}
              </Text>
            </TouchableOpacity>

            {errorMessage ? (
              <Text className="mb-4 text-sm text-red-500">
                {errorMessage}
              </Text>
            ) : null}
          </View>

          <View className="flex-row items-center justify-center py-8">
            <Text className="text-text-secondary dark:text-text-dark-secondary">
              이미 계정이 있으신가요?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
              <Text className="text-primary font-semibold">로그인</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({
  label, placeholder, value, onChangeText,
  keyboardType, autoCapitalize, autoCorrect, secureTextEntry, rightAccessory,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  rightAccessory?: ReactNode;
}) {
  return (
    <View>
      <Text className="text-sm font-medium text-text-primary dark:text-text-dark-primary mb-2">
        {label}
      </Text>
      <View className="relative">
        <TextInput
          className={`border border-border dark:border-border-dark rounded-xl px-4 py-3.5 text-base text-text-primary dark:text-text-dark-primary bg-white dark:bg-surface-dark ${rightAccessory ? 'pr-12' : ''}`}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          secureTextEntry={secureTextEntry}
        />
        {rightAccessory ? (
          <View className="absolute right-4 inset-y-0 justify-center">
            {rightAccessory}
          </View>
        ) : null}
      </View>
    </View>
  );
}
