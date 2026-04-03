import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../../src/services/auth.service';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const params = useLocalSearchParams<{ signup?: string; email?: string }>();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const showSignupNotice = params.signup === 'pending_verification';

  const handleEmailSignIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      Alert.alert('입력 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.signInWithEmail(normalizedEmail, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('로그인 실패', e.message ?? '로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await authService.signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Google 로그인 실패', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert('입력 오류', '인증 메일을 받을 이메일을 입력해주세요.');
      return;
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      Alert.alert('입력 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setIsResending(true);
    try {
      await authService.resendSignUpVerification(normalizedEmail);
      Alert.alert('재전송 완료', '인증 메일을 다시 보냈습니다. 메일함을 확인해주세요.');
    } catch (e: any) {
      Alert.alert('재전송 실패', e.message ?? '인증 메일 재전송에 실패했습니다.');
    } finally {
      setIsResending(false);
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
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-8">
            {/* 헤더 */}
            <TouchableOpacity
              className="mb-8 w-10 h-10 items-center justify-center"
              onPress={() => router.back()}
            >
              <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
            </TouchableOpacity>

            <Text className="text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-2">
              로그인
            </Text>
            <Text className="text-text-secondary dark:text-text-dark-secondary mb-8">
              계정에 로그인하세요
            </Text>

            {showSignupNotice && (
              <View className="mb-6 rounded-xl px-4 py-3 bg-primary/10 border border-primary/30">
                <Text className="text-sm font-semibold text-primary">
                  회원가입이 완료되었습니다.
                </Text>
                <Text className="text-xs text-primary mt-1">
                  {params.email
                    ? `${String(params.email)} 메일함에서 인증 후 로그인해주세요.`
                    : '메일함에서 인증 후 로그인해주세요.'}
                </Text>
              </View>
            )}

            {/* 이메일 입력 */}
            <View className="gap-y-4 mb-6">
              <View>
                <Text className="text-sm font-medium text-text-primary dark:text-text-dark-primary mb-2">
                  이메일
                </Text>
                <TextInput
                  className="border border-border dark:border-border-dark rounded-xl px-4 py-3.5 text-base text-text-primary dark:text-text-dark-primary bg-white dark:bg-surface-dark"
                  placeholder="이메일을 입력하세요"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-text-primary dark:text-text-dark-primary mb-2">
                  비밀번호
                </Text>
                <View className="relative">
                  <TextInput
                    className="border border-border dark:border-border-dark rounded-xl px-4 py-3.5 pr-12 text-base text-text-primary dark:text-text-dark-primary bg-white dark:bg-surface-dark"
                    placeholder="비밀번호를 입력하세요"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <View className="absolute right-4 inset-y-0 justify-center">
                    <TouchableOpacity
                      onPress={() => setShowPassword((prev) => !prev)}
                      hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
                    >
                      <Text className="text-lg text-text-secondary dark:text-text-dark-secondary">
                        {showPassword ? '🙈' : '👁'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View className="flex-row items-center justify-between mb-6">
              <TouchableOpacity
                onPress={handleResendVerification}
                disabled={isLoading || isResending}
              >
                <Text className="text-primary text-sm">
                  {isResending ? '재전송 중...' : '인증 메일 재전송'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/forgot-password')}
                disabled={isLoading || isResending}
              >
                <Text className="text-primary text-sm">비밀번호를 잊으셨나요?</Text>
              </TouchableOpacity>
            </View>

            {/* 로그인 버튼 */}
            <TouchableOpacity
              className={`py-4 rounded-2xl items-center mb-6 ${isLoading ? 'bg-primary/60' : 'bg-primary'}`}
              onPress={handleEmailSignIn}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text className="text-white text-base font-semibold">
                {isLoading ? '로그인 중...' : '로그인'}
              </Text>
            </TouchableOpacity>

            {/* 구분선 */}
            <View className="flex-row items-center mb-6">
              <View className="flex-1 h-px bg-border dark:bg-border-dark" />
              <Text className="px-4 text-sm text-text-secondary dark:text-text-dark-secondary">
                또는
              </Text>
              <View className="flex-1 h-px bg-border dark:bg-border-dark" />
            </View>

            {/* 소셜 로그인 */}
            <View className="gap-y-3">
              <SocialButton
                label="Google로 계속하기"
                emoji="🔵"
                onPress={handleGoogleSignIn}
                disabled={isLoading}
              />
              <SocialButton
                label="Apple로 계속하기"
                emoji="🍎"
                onPress={() => Alert.alert('준비 중', 'Apple 로그인은 곧 지원됩니다.')}
                disabled={isLoading}
              />
              <SocialButton
                label="카카오로 계속하기"
                emoji="💛"
                onPress={() => Alert.alert('준비 중', '카카오 로그인은 곧 지원됩니다.')}
                disabled={isLoading}
              />
            </View>
          </View>

          {/* 회원가입 링크 */}
          <View className="flex-row items-center justify-center py-8">
            <Text className="text-text-secondary dark:text-text-dark-secondary">
              계정이 없으신가요?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}>
              <Text className="text-primary font-semibold">회원가입</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SocialButton({
  label, emoji, onPress, disabled,
}: { label: string; emoji: string; onPress: () => void; disabled: boolean }) {
  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center border border-border dark:border-border-dark rounded-2xl py-3.5 gap-x-2 ${disabled ? 'opacity-50' : ''}`}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text className="text-lg">{emoji}</Text>
      <Text className="text-base font-medium text-text-primary dark:text-text-dark-primary">
        {label}
      </Text>
    </TouchableOpacity>
  );
}
