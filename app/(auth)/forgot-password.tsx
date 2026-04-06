// 앱 화면/라우팅 로직: app/(auth)/forgot-password.tsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../../src/services/auth.service';

export default function ForgotPasswordScreen() {
  const [email, setEmail]     = useState('');
  const [isLoading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('입력 오류', '이메일을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(email.trim());
      setSent(true);
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <View className="flex-1 px-6 pt-8">
        <TouchableOpacity
          className="mb-8 w-10 h-10 items-center justify-center"
          onPress={() => router.back()}
        >
          <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
        </TouchableOpacity>

        <Text className="text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-2">
          비밀번호 찾기
        </Text>

        {sent ? (
          <View className="mt-8">
            <View className="items-center mb-8">
              <Text className="text-5xl mb-4">📧</Text>
              <Text className="text-xl font-semibold text-text-primary dark:text-text-dark-primary text-center mb-2">
                이메일을 확인하세요
              </Text>
              <Text className="text-text-secondary dark:text-text-dark-secondary text-center">
                {email}로 비밀번호 재설정 링크를{'\n'}발송했습니다.
              </Text>
            </View>
            <TouchableOpacity
              className="bg-primary py-4 rounded-2xl items-center"
              onPress={() => router.replace('/(auth)/sign-in')}
            >
              <Text className="text-white text-base font-semibold">로그인으로 돌아가기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text className="text-text-secondary dark:text-text-dark-secondary mb-8">
              가입하신 이메일을 입력하시면{'\n'}비밀번호 재설정 링크를 발송해 드립니다.
            </Text>

            <Text className="text-sm font-medium text-text-primary dark:text-text-dark-primary mb-2">
              이메일
            </Text>
            <TextInput
              className="border border-border dark:border-border-dark rounded-xl px-4 py-3.5 text-base text-text-primary dark:text-text-dark-primary bg-white dark:bg-surface-dark mb-6"
              placeholder="이메일을 입력하세요"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <TouchableOpacity
              className={`py-4 rounded-2xl items-center ${isLoading ? 'bg-primary/60' : 'bg-primary'}`}
              onPress={handleReset}
              disabled={isLoading}
            >
              <Text className="text-white text-base font-semibold">
                {isLoading ? '발송 중...' : '재설정 링크 발송'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
